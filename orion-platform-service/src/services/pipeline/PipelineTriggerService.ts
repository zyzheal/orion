/**
 * PipelineTriggerService - Pipeline trigger engine
 *
 * Handles trigger registration, evaluation, and execution.
 * Supports git, webhook, schedule, and manual trigger types.
 * Uses in-memory Map for runtime performance, backed by PostgreSQL persistence.
 *
 * Phase 2 addition: Cron scheduler using cron-parser for schedule-based triggers.
 * GAP-11: Added PostgreSQL persistence via TriggerRepository. On startup, active
 * triggers are loaded from the database. All mutations are persisted.
 * Graceful degradation: works with or without a repository.
 */

import { CronExpressionParser } from 'cron-parser';
import pino from 'pino';
import { TriggerRepository, type TriggerEntity } from '../../repositories/TriggerRepository';
import { PathFilter } from './PathFilter';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const pathFilter = new PathFilter();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export type TriggerType = 'git' | 'webhook' | 'schedule' | 'manual';
export type TriggerStatus = 'active' | 'inactive' | 'failed';
export type TriggerExecutionStatus = 'success' | 'failed' | 'pending';

export interface TriggerConfig {
  // git trigger config
  branch?: string;
  pathPatterns?: string[];
  // webhook trigger config
  webhookUrl?: string;
  secret?: string;
  // schedule trigger config
  cronExpression?: string;
  timezone?: string;
  // common
  [key: string]: unknown;
}

export interface Trigger {
  id: string;
  pipelineId: string;
  tenantId: string;
  type: TriggerType;
  config: TriggerConfig;
  status: TriggerStatus;
  // Enhanced run tracking (Task 6)
  lastRunId?: string;
  lastRunStatus?: TriggerExecutionStatus;
  lastRunAt?: Date;
  consecutiveFailures: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TriggerEvent {
  type: TriggerType;
  payload: Record<string, unknown>;
  timestamp: Date;
}

export interface TriggerExecutionRecord {
  id: string;
  triggerId: string;
  pipelineId: string;
  tenantId: string;
  status: TriggerExecutionStatus;
  message?: string;
  runId?: string;
  executedAt: Date;
}

export interface CreateTriggerInput {
  pipelineId: string;
  tenantId: string;
  type: TriggerType;
  config: TriggerConfig;
}

export interface UpdateTriggerInput {
  type?: TriggerType;
  config?: Partial<TriggerConfig>;
  status?: TriggerStatus;
}

/**
 * Cron schedule entry with its timer reference
 */
export interface CronScheduleEntry {
  triggerId: string;
  pipelineId: string;
  tenantId: string;
  cronExpression: string;
  intervalId: NodeJS.Timer;
  nextRunAt?: Date;
  lastRunAt?: Date;
}

export class PipelineTriggerServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PipelineTriggerServiceError';
  }
}

/**
 * Optional dependencies for the PipelineTriggerService.
 */
export interface PipelineTriggerServiceOptions {
  /** PostgreSQL database connection. Required for persistence. */
  db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
  /** Callback to execute when a cron trigger fires */
  onTickCallback?: (triggerId: string, pipelineId: string) => Promise<void>;
}

export class PipelineTriggerService {
  private triggers: Map<string, Trigger> = new Map();
  private executionHistory: Map<string, TriggerExecutionRecord[]> = new Map();
  private counter = 0;

  // Cron scheduler: triggerId -> schedule entry
  private cronSchedules = new Map<string, CronScheduleEntry>();

  // Optional PostgreSQL repository for persistence (GAP-11)
  private triggerRepository: TriggerRepository | null = null;

  // Callback to execute when a cron trigger fires
  private onTickCallback?: (triggerId: string, pipelineId: string) => Promise<void>;

  constructor(
    options?: PipelineTriggerServiceOptions | ((triggerId: string, pipelineId: string) => Promise<void>)
  ) {
    // Support both old signature (callback only) and new signature (options object)
    if (typeof options === 'function') {
      this.onTickCallback = options;
    } else if (options) {
      this.onTickCallback = options.onTickCallback;
      if (options.db) {
        this.triggerRepository = new TriggerRepository(options.db);
      }
    }
  }

  // ==================== Initialization ====================

  /**
   * Load active triggers from PostgreSQL on startup.
   * Re-hydrates the in-memory Map from persisted state.
   * Call this once after construction when using persistence.
   */
  async initialize(): Promise<void> {
    if (!this.triggerRepository) {
      logger.info('No TriggerRepository configured, skipping persistence initialization');
      return;
    }

    try {
      const activeTriggers = await this.triggerRepository.findActiveTriggers();
      for (const entity of activeTriggers) {
        const trigger: Trigger = {
          id: entity.id,
          pipelineId: entity.pipelineId,
          tenantId: entity.tenantId,
          type: entity.type as TriggerType,
          config: entity.config as TriggerConfig,
          status: entity.status as TriggerStatus,
          lastRunId: entity.lastRunId ?? undefined,
          lastRunStatus: entity.lastRunStatus as TriggerExecutionStatus | undefined,
          lastRunAt: entity.lastRunAt ?? undefined,
          consecutiveFailures: entity.consecutiveFailures,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        };
        this.triggers.set(trigger.id, trigger);

        // Re-schedule active schedule-type triggers
        if (trigger.type === 'schedule' && trigger.config.cronExpression) {
          try {
            await this.scheduleTrigger(trigger.id, trigger.config.cronExpression as string);
          } catch (error) {
            logger.warn(
              { triggerId: trigger.id, error },
              'Failed to re-schedule cron trigger on startup'
            );
          }
        }
      }
      logger.info({ count: activeTriggers.length }, 'Loaded active triggers from PostgreSQL');
    } catch (error) {
      logger.error({ traceId: getCurrentTraceId(), error }, 'Failed to load triggers from PostgreSQL on startup');
    }
  }

  // ==================== Trigger Registration ====================

  /**
   * Register a new trigger for a pipeline
   * For schedule-type triggers, automatically starts the cron scheduler
   * Persists to PostgreSQL if repository is available
   */
  async registerTrigger(input: CreateTriggerInput): Promise<Trigger> {
    if (!input.pipelineId || !input.tenantId || !input.type) {
      throw new PipelineTriggerServiceError(
        'Missing required fields: pipelineId, tenantId, type',
        'INVALID_INPUT'
      );
    }

    const now = new Date();
    const trigger: Trigger = {
      id: this.generateId('trigger'),
      pipelineId: input.pipelineId,
      tenantId: input.tenantId,
      type: input.type,
      config: input.config,
      status: 'active',
      consecutiveFailures: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Persist to PostgreSQL if repository is available
    if (this.triggerRepository) {
      try {
        await this.triggerRepository.create({
          id: trigger.id,
          tenantId: trigger.tenantId,
          pipelineId: trigger.pipelineId,
          type: trigger.type,
          config: trigger.config as Record<string, unknown>,
          status: trigger.status,
          lastRunId: null,
          lastRunStatus: null,
          lastRunAt: null,
          consecutiveFailures: 0,
        });
      } catch (error) {
        logger.error(
          { triggerId: trigger.id, error },
          'Failed to persist trigger to PostgreSQL'
        );
        // Continue anyway - in-memory state is still valid
      }
    }

    this.triggers.set(trigger.id, trigger);

    // Auto-schedule if this is a schedule-type trigger
    if (input.type === 'schedule' && input.config.cronExpression) {
      try {
        await this.scheduleTrigger(trigger.id, input.config.cronExpression);
      } catch (error) {
        logger.warn(
          { triggerId: trigger.id, error },
          'Failed to auto-schedule cron trigger'
        );
      }
    }

    return trigger;
  }

  /**
   * Get a trigger by ID.
   * Cache-first with DB fallback.
   */
  async getTrigger(triggerId: string): Promise<Trigger | null> {
    const cached = this.triggers.get(triggerId);
    if (cached) return cached;

    // Fallback to database
    if (this.triggerRepository) {
      try {
        const entity = await this.triggerRepository.findById(triggerId);
        if (entity) {
          const trigger: Trigger = {
            id: entity.id,
            pipelineId: entity.pipelineId,
            tenantId: entity.tenantId,
            type: entity.type as TriggerType,
            config: entity.config as TriggerConfig,
            status: entity.status as TriggerStatus,
            lastRunId: entity.lastRunId ?? undefined,
            lastRunStatus: entity.lastRunStatus as TriggerExecutionStatus | undefined,
            lastRunAt: entity.lastRunAt ?? undefined,
            consecutiveFailures: entity.consecutiveFailures,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
          };
          this.triggers.set(trigger.id, trigger);
          return trigger;
        }
      } catch (err) {
        logger.warn({ triggerId, err }, 'Failed to load trigger from database');
      }
    }

    return null;
  }

  /**
   * List triggers for a pipeline.
   * Queries DB (source of truth) and refreshes cache entries.
   */
  async listTriggersByPipeline(tenantId: string, pipelineId: string): Promise<Trigger[]> {
    if (this.triggerRepository) {
      try {
        const entities = await this.triggerRepository.findByPipeline(tenantId, pipelineId);
        const triggers: Trigger[] = entities.map(entity => {
          const trigger: Trigger = {
            id: entity.id,
            pipelineId: entity.pipelineId,
            tenantId: entity.tenantId,
            type: entity.type as TriggerType,
            config: entity.config as TriggerConfig,
            status: entity.status as TriggerStatus,
            lastRunId: entity.lastRunId ?? undefined,
            lastRunStatus: entity.lastRunStatus as TriggerExecutionStatus | undefined,
            lastRunAt: entity.lastRunAt ?? undefined,
            consecutiveFailures: entity.consecutiveFailures,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
          };
          this.triggers.set(trigger.id, trigger);
          return trigger;
        });
        return triggers;
      } catch (err) {
        logger.warn({ tenantId, pipelineId, err }, 'Failed to list triggers from database, falling back to cache');
      }
    }

    // Fallback to in-memory cache
    const results: Trigger[] = [];
    for (const trigger of this.triggers.values()) {
      if (trigger.tenantId === tenantId && trigger.pipelineId === pipelineId) {
        results.push(trigger);
      }
    }
    return results;
  }

  /**
   * List all triggers for a tenant.
   * Queries DB (source of truth) and refreshes cache entries.
   */
  async listTriggersByTenant(tenantId: string): Promise<Trigger[]> {
    if (this.triggerRepository) {
      try {
        const entities = await this.triggerRepository.findByTenant(tenantId);
        const triggers: Trigger[] = entities.map(entity => {
          const trigger: Trigger = {
            id: entity.id,
            pipelineId: entity.pipelineId,
            tenantId: entity.tenantId,
            type: entity.type as TriggerType,
            config: entity.config as TriggerConfig,
            status: entity.status as TriggerStatus,
            lastRunId: entity.lastRunId ?? undefined,
            lastRunStatus: entity.lastRunStatus as TriggerExecutionStatus | undefined,
            lastRunAt: entity.lastRunAt ?? undefined,
            consecutiveFailures: entity.consecutiveFailures,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
          };
          this.triggers.set(trigger.id, trigger);
          return trigger;
        });
        return triggers;
      } catch (err) {
        logger.warn({ tenantId, err }, 'Failed to list triggers from database, falling back to cache');
      }
    }

    // Fallback to in-memory cache
    const results: Trigger[] = [];
    for (const trigger of this.triggers.values()) {
      if (trigger.tenantId === tenantId) {
        results.push(trigger);
      }
    }
    return results;
  }

  /**
   * Update trigger configuration
   * If cron expression changes, reschedules the cron timer
   * Persists changes to PostgreSQL if repository is available
   */
  async updateTrigger(triggerId: string, input: UpdateTriggerInput): Promise<Trigger> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new PipelineTriggerServiceError(`Trigger not found: ${triggerId}`, 'TRIGGER_NOT_FOUND');
    }

    if (input.type !== undefined) {
      trigger.type = input.type;
    }
    if (input.config !== undefined) {
      // Check if cron expression changed
      const oldCron = trigger.config.cronExpression;
      const newCron = input.config.cronExpression;
      if (oldCron !== newCron && newCron) {
        try {
          await this.scheduleTrigger(triggerId, newCron);
        } catch (error) {
          logger.warn(
            { triggerId, error },
            'Failed to reschedule cron trigger on update'
          );
        }
      }
      trigger.config = { ...trigger.config, ...input.config };
    }
    if (input.status !== undefined) {
      trigger.status = input.status;
      // If status is inactive, unschedule cron
      if (input.status === 'inactive') {
        await this.unscheduleTrigger(triggerId);
      } else if (input.status === 'active' && trigger.type === 'schedule' && trigger.config.cronExpression) {
        // If status becomes active and it's a schedule trigger, ensure cron is scheduled
        if (!this.cronSchedules.has(triggerId)) {
          await this.scheduleTrigger(triggerId, trigger.config.cronExpression).catch((err) => logger.warn({ err, triggerId }, 'Failed to schedule trigger'));
        }
      }
    }
    trigger.updatedAt = new Date();
    this.triggers.set(triggerId, trigger);

    // Persist to PostgreSQL if repository is available
    if (this.triggerRepository) {
      try {
        await this.triggerRepository.updateTriggerConfig(triggerId, trigger.type, trigger.config);
      } catch (error) {
        logger.error(
          { triggerId, error },
          'Failed to persist trigger update to PostgreSQL'
        );
      }
    }

    return trigger;
  }

  /**
   * Update trigger status
   * Persists changes to PostgreSQL if repository is available
   */
  async updateTriggerStatus(triggerId: string, status: TriggerStatus): Promise<Trigger> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new PipelineTriggerServiceError(`Trigger not found: ${triggerId}`, 'TRIGGER_NOT_FOUND');
    }
    trigger.status = status;
    trigger.updatedAt = new Date();
    this.triggers.set(triggerId, trigger);

    // Persist to PostgreSQL if repository is available
    if (this.triggerRepository) {
      try {
        await this.triggerRepository.updateStatus(triggerId, trigger.status);
      } catch (error) {
        logger.error(
          { triggerId, error },
          'Failed to persist trigger status update to PostgreSQL'
        );
      }
    }

    // If status is inactive, unschedule cron
    if (status === 'inactive') {
      await this.unscheduleTrigger(triggerId);
    } else if (status === 'active' && trigger.type === 'schedule' && trigger.config.cronExpression) {
      if (!this.cronSchedules.has(triggerId)) {
        await this.scheduleTrigger(triggerId, trigger.config.cronExpression).catch(() => {});
      }
    }

    return trigger;
  }

  /**
   * Delete a trigger
   * Also unschedules any active cron timer
   * Deletes from PostgreSQL if repository is available
   */
  async deleteTrigger(triggerId: string): Promise<void> {
    await this.unscheduleTrigger(triggerId);
    this.triggers.delete(triggerId);
    this.executionHistory.delete(triggerId);

    // Delete from PostgreSQL if repository is available
    if (this.triggerRepository) {
      try {
        await this.triggerRepository.delete(triggerId);
      } catch (error) {
        logger.error(
          { triggerId, error },
          'Failed to delete trigger from PostgreSQL'
        );
      }
    }
  }

  // ==================== Cron Scheduler ====================

  /**
   * Schedule a cron trigger for a pipeline
   * Creates an interval-based timer that fires on cron expression matches
   */
  async scheduleTrigger(triggerId: string, cronExpression: string): Promise<CronScheduleEntry> {
    // Validate the cron expression
    try {
      const trigger = this.triggers.get(triggerId);
      const timezone = trigger?.config?.timezone as string | undefined;
      if (timezone) {
        CronExpressionParser.parse(cronExpression, { tz: timezone });
      } else {
        CronExpressionParser.parse(cronExpression);
      }
    } catch (error) {
      throw new PipelineTriggerServiceError(
        `Invalid cron expression: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_CRON_EXPRESSION'
      );
    }

    // Remove existing schedule if any
    await this.unscheduleTrigger(triggerId);

    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new PipelineTriggerServiceError(`Trigger not found: ${triggerId}`, 'TRIGGER_NOT_FOUND');
    }

    // Calculate the interval until next run (timezone-aware if configured)
    const interval = this.calculateNextInterval(cronExpression, trigger.config.timezone as string | undefined);
    const nextRunAt = new Date(Date.now() + interval);

    // Set up a timer that fires when the cron expression next matches
    const timerId = setTimeout(async () => {
      await this.onCronTick(triggerId);
    }, interval);

    timerId.unref(); // Don't prevent process exit

    const entry: CronScheduleEntry = {
      triggerId,
      pipelineId: trigger.pipelineId,
      tenantId: trigger.tenantId,
      cronExpression,
      intervalId: timerId,
      nextRunAt,
    };

    this.cronSchedules.set(triggerId, entry);
    logger.info(
      { triggerId, cronExpression, nextRunAt: nextRunAt.toISOString() },
      'Cron trigger scheduled'
    );

    return entry;
  }

  /**
   * Unschedule a cron trigger
   */
  async unscheduleTrigger(triggerId: string): Promise<void> {
    const entry = this.cronSchedules.get(triggerId);
    if (entry) {
      clearTimeout(entry.intervalId as unknown as number);
      this.cronSchedules.delete(triggerId);
      logger.info({ triggerId }, 'Cron trigger unscheduled');
    }
  }

  /**
   * Get all active cron schedules
   */
  getCronSchedules(): CronScheduleEntry[] {
    return Array.from(this.cronSchedules.values());
  }

  /**
   * Get cron schedule for a specific trigger
   */
  getCronSchedule(triggerId: string): CronScheduleEntry | undefined {
    return this.cronSchedules.get(triggerId);
  }

  /**
   * Get next run time for a trigger (uses cron-parser for accurate calculation)
   */
  getNextRunTime(cronExpression: string): Date | null {
    try {
      const interval = CronExpressionParser.parse(cronExpression);
      return interval.next().toDate();
    } catch {
      return null;
    }
  }

  /**
   * Called when a cron timer fires
   */
  private async onCronTick(triggerId: string): Promise<void> {
    const entry = this.cronSchedules.get(triggerId);
    if (!entry) return;

    const trigger = this.triggers.get(triggerId);
    if (!trigger || trigger.status !== 'active') {
      // Trigger is inactive, clean up
      await this.unscheduleTrigger(triggerId);
      return;
    }

    logger.info(
      { triggerId, pipelineId: trigger.pipelineId },
      'Cron trigger fired'
    );

    // Update schedule timestamps
    entry.lastRunAt = new Date();
    // Reschedule for the next run
    const interval = this.calculateNextInterval(entry.cronExpression, trigger.config.timezone as string | undefined);
    entry.nextRunAt = new Date(Date.now() + interval);

    const timerId = setTimeout(async () => {
      await this.onCronTick(triggerId);
    }, interval);
    timerId.unref();
    entry.intervalId = timerId;

    // Execute the pipeline trigger callback
    if (this.onTickCallback) {
      try {
        await this.onTickCallback(triggerId, trigger.pipelineId);

        // Record success with run tracking
        const runId = this.generateId('run');
        await this.recordExecution(triggerId, runId, 'success');

        // Record execution record for history
        const record: TriggerExecutionRecord = {
          id: this.generateId('exec'),
          triggerId,
          pipelineId: trigger.pipelineId,
          tenantId: trigger.tenantId,
          status: 'success',
          runId,
          executedAt: new Date(),
        };
        await this.saveExecutionRecord(record);
      } catch (error) {
        logger.error(
          { triggerId, error },
          'Cron trigger execution failed'
        );
        await this.recordFailure(triggerId, error instanceof Error ? error.message : String(error));
      }
    } else {
      // No callback, just record the tick
      const runId = this.generateId('run');
      await this.recordExecution(triggerId, runId, 'success');

      const record: TriggerExecutionRecord = {
        id: this.generateId('exec'),
        triggerId,
        pipelineId: trigger.pipelineId,
        tenantId: trigger.tenantId,
        status: 'success',
        runId,
        executedAt: new Date(),
      };
      await this.saveExecutionRecord(record);
    }
  }

  /**
   * Calculate the interval in ms until the next cron expression match
   * Uses cron-parser for accurate calculation. Supports timezone if configured.
   */
  private calculateNextInterval(cronExpression: string, timezone?: string): number {
    try {
      const options = timezone ? { tz: timezone } : undefined;
      const interval = CronExpressionParser.parse(cronExpression, options);
      const nextDate = interval.next().toDate();
      const ms = nextDate.getTime() - Date.now();
      // Ensure minimum of 1 second to avoid tight loops
      return Math.max(ms, 1000);
    } catch {
      // Fallback: 1 minute
      return 60000;
    }
  }

  // ==================== Trigger Evaluation ====================

  /**
   * Evaluate whether an event should trigger any pipelines
   * Returns list of trigger IDs that should fire
   */
  async evaluateTrigger(event: TriggerEvent): Promise<string[]> {
    const matchedTriggers: string[] = [];

    for (const trigger of this.triggers.values()) {
      if (trigger.status !== 'active') {
        continue;
      }

      if (trigger.type !== event.type) {
        continue;
      }

      const shouldFire = this.matchesConfig(trigger, event);
      if (shouldFire) {
        matchedTriggers.push(trigger.id);
      }
    }

    return matchedTriggers;
  }

  // ==================== Trigger Execution ====================

  /**
   * Execute a trigger and start a pipeline run
   */
  async executeTrigger(triggerId: string): Promise<TriggerExecutionRecord> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new PipelineTriggerServiceError(`Trigger not found: ${triggerId}`, 'TRIGGER_NOT_FOUND');
    }

    const runId = this.generateId('run');

    // Update trigger run tracking
    await this.recordExecution(triggerId, runId, 'success');

    const record: TriggerExecutionRecord = {
      id: this.generateId('exec'),
      triggerId,
      pipelineId: trigger.pipelineId,
      tenantId: trigger.tenantId,
      status: 'success',
      runId,
      executedAt: new Date(),
    };

    // Store execution record (persist if repository available)
    await this.saveExecutionRecord(record);

    return record;
  }

  /**
   * Save an execution record to both in-memory map and PostgreSQL.
   */
  private async saveExecutionRecord(record: TriggerExecutionRecord): Promise<void> {
    // Always store in-memory for backward compatibility and runtime performance
    const history = this.executionHistory.get(record.triggerId) ?? [];
    history.push(record);
    this.executionHistory.set(record.triggerId, history);

    // Persist to PostgreSQL if repository is available
    if (this.triggerRepository) {
      try {
        const contextJson: Record<string, unknown> = {};
        if (record.message) {
          contextJson.message = record.message;
        }
        await this.triggerRepository.saveExecutionRecord({
          id: record.id,
          triggerId: record.triggerId,
          runId: record.runId ?? null,
          status: record.status,
          contextJson,
          executedAt: record.executedAt,
        });
      } catch (error) {
        logger.error(
          { executionId: record.id, error },
          'Failed to persist execution record to PostgreSQL'
        );
      }
    }
  }

  /**
   * Record a failed execution
   */
  async recordFailure(triggerId: string, message: string): Promise<TriggerExecutionRecord> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new PipelineTriggerServiceError(`Trigger not found: ${triggerId}`, 'TRIGGER_NOT_FOUND');
    }

    // Increment consecutive failures counter
    trigger.consecutiveFailures += 1;

    const record: TriggerExecutionRecord = {
      id: this.generateId('exec'),
      triggerId,
      pipelineId: trigger.pipelineId,
      tenantId: trigger.tenantId,
      status: 'failed',
      message,
      executedAt: new Date(),
    };

    await this.saveExecutionRecord(record);

    // Update trigger run tracking in memory
    trigger.lastRunId = record.id;
    trigger.lastRunStatus = 'failed';
    trigger.lastRunAt = new Date();
    this.triggers.set(triggerId, trigger);

    // Persist run tracking to PostgreSQL
    if (this.triggerRepository) {
      try {
        await this.triggerRepository.updateRunInfo(
          triggerId,
          record.id,
          'failed',
          new Date(),
          trigger.consecutiveFailures
        );
      } catch (error) {
        logger.error(
          { triggerId, error },
          'Failed to persist run tracking to PostgreSQL'
        );
      }
    }

    // Auto-disable trigger after threshold consecutive failures
    if (trigger.consecutiveFailures >= 5) {
      trigger.status = 'failed';
      trigger.updatedAt = new Date();
      this.triggers.set(triggerId, trigger);

      // Persist status change to PostgreSQL
      if (this.triggerRepository) {
        try {
          await this.triggerRepository.updateStatus(triggerId, trigger.status);
        } catch (error) {
          logger.error(
            { triggerId, error },
            'Failed to persist trigger failure status to PostgreSQL'
          );
        }
      }
    }

    return record;
  }

  /**
   * Record execution metadata for a trigger (Task 6).
   * Updates lastRunId, lastRunStatus, lastRunAt, and consecutiveFailures.
   */
  async recordExecution(triggerId: string, runId: string, status: TriggerExecutionStatus): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      // Silently skip if trigger no longer exists
      return;
    }

    // Update in-memory state
    trigger.lastRunId = runId;
    trigger.lastRunStatus = status;
    trigger.lastRunAt = new Date();

    // Reset consecutive failures on success
    if (status === 'success' && trigger.consecutiveFailures > 0) {
      trigger.consecutiveFailures = 0;
    }

    this.triggers.set(triggerId, trigger);

    // Persist to PostgreSQL if repository is available
    if (this.triggerRepository) {
      try {
        await this.triggerRepository.updateRunInfo(
          triggerId,
          runId,
          status,
          new Date(),
          trigger.consecutiveFailures
        );
      } catch (error) {
        logger.error(
          { triggerId, error },
          'Failed to persist execution record to PostgreSQL'
        );
      }
    }
  }

  // ==================== Trigger History ====================

  /**
   * Get execution history for a pipeline.
   * Queries DB for authoritative execution records.
   */
  async getTriggerHistory(pipelineId: string, tenantId?: string): Promise<TriggerExecutionRecord[]> {
    // Find triggers for this pipeline, then query execution history from DB
    const triggers = await this.listTriggersByPipeline(tenantId || '', pipelineId);
    const results: TriggerExecutionRecord[] = [];

    for (const trigger of triggers) {
      if (this.triggerRepository) {
        try {
          const entities = await this.triggerRepository.findExecutionHistory(trigger.id);
          for (const entity of entities) {
            results.push({
              id: entity.id,
              triggerId: entity.triggerId,
              pipelineId: trigger.pipelineId,
              tenantId: trigger.tenantId,
              status: entity.status as TriggerExecutionStatus,
              message: (entity.contextJson?.message as string) || undefined,
              runId: entity.runId || undefined,
              executedAt: entity.executedAt,
            });
          }
        } catch (err) {
          logger.warn({ triggerId: trigger.id, err }, 'Failed to load execution history from database');
          // Fallback to in-memory
          const cached = this.executionHistory.get(trigger.id);
          if (cached) results.push(...cached);
        }
      } else {
        const cached = this.executionHistory.get(trigger.id);
        if (cached) results.push(...cached);
      }
    }

    return results.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
  }

  /**
   * Get execution history for a specific trigger.
   * Queries DB when repository is available.
   */
  async getTriggerHistoryById(triggerId: string): Promise<TriggerExecutionRecord[]> {
    if (this.triggerRepository) {
      try {
        const entities = await this.triggerRepository.findExecutionHistory(triggerId);
        const trigger = await this.getTrigger(triggerId);
        return entities.map(entity => ({
          id: entity.id,
          triggerId: entity.triggerId,
          pipelineId: trigger?.pipelineId || '',
          tenantId: trigger?.tenantId || '',
          status: entity.status as TriggerExecutionStatus,
          message: (entity.contextJson?.message as string) || undefined,
          runId: entity.runId || undefined,
          executedAt: entity.executedAt,
        }));
      } catch (err) {
        logger.warn({ triggerId, err }, 'Failed to load execution history from database, falling back to cache');
      }
    }

    return this.executionHistory.get(triggerId) ?? [];
  }

  // ==================== Internal Helpers ====================

  private matchesConfig(trigger: Trigger, event: TriggerEvent): boolean {
    const config = trigger.config;

    if (trigger.type === 'git' && config.branch) {
      const branch = event.payload.branch as string | undefined;
      if (branch && !this.matchesPattern(branch, config.branch as string)) {
        return false;
      }
    }

    if (trigger.type === 'git' && config.pathPatterns && config.pathPatterns.length > 0) {
      const changedFiles = event.payload.changedFiles as string[] | undefined;
      if (changedFiles && changedFiles.length > 0) {
        // Check if at least one changed file matches the path patterns (with negation support)
        const hasMatch = changedFiles.some((file) => pathFilter.matchesAny(file, config.pathPatterns!));
        if (!hasMatch) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesPattern(value: string, pattern: string): boolean {
    // Delegate to PathFilter for advanced pattern matching (**, !, [], {})
    return pathFilter.match(value, pattern);
  }

  private generateId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${Date.now()}-${this.counter}`;
  }
}
