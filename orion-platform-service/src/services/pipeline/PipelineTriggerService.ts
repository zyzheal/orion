/**
 * PipelineTriggerService - Pipeline trigger engine
 *
 * Handles trigger registration, evaluation, and execution.
 * Supports git, webhook, schedule, and manual trigger types.
 * Uses Map-based in-memory storage.
 *
 * Phase 2 addition: Cron scheduler using cron-parser for schedule-based triggers.
 */

import { CronExpressionParser } from 'cron-parser';
import pino from 'pino';

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

export class PipelineTriggerService {
  private triggers: Map<string, Trigger> = new Map();
  private executionHistory: Map<string, TriggerExecutionRecord[]> = new Map();
  private counter = 0;

  // Cron scheduler: triggerId -> schedule entry
  private cronSchedules = new Map<string, CronScheduleEntry>();

  // Callback to execute when a cron trigger fires
  private onTickCallback?: (triggerId: string, pipelineId: string) => Promise<void>;

  constructor(onTickCallback?: (triggerId: string, pipelineId: string) => Promise<void>) {
    this.onTickCallback = onTickCallback;
  }

  // ==================== Trigger Registration ====================

  /**
   * Register a new trigger for a pipeline
   * For schedule-type triggers, automatically starts the cron scheduler
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
      createdAt: now,
      updatedAt: now,
    };

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
   * Get a trigger by ID
   */
  async getTrigger(triggerId: string): Promise<Trigger | null> {
    return this.triggers.get(triggerId) ?? null;
  }

  /**
   * List triggers for a pipeline
   */
  async listTriggersByPipeline(tenantId: string, pipelineId: string): Promise<Trigger[]> {
    const results: Trigger[] = [];
    for (const trigger of this.triggers.values()) {
      if (trigger.tenantId === tenantId && trigger.pipelineId === pipelineId) {
        results.push(trigger);
      }
    }
    return results;
  }

  /**
   * List all triggers for a tenant
   */
  async listTriggersByTenant(tenantId: string): Promise<Trigger[]> {
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
          await this.scheduleTrigger(triggerId, trigger.config.cronExpression).catch(() => {});
        }
      }
    }
    trigger.updatedAt = new Date();
    this.triggers.set(triggerId, trigger);
    return trigger;
  }

  /**
   * Update trigger status
   */
  async updateTriggerStatus(triggerId: string, status: TriggerStatus): Promise<Trigger> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new PipelineTriggerServiceError(`Trigger not found: ${triggerId}`, 'TRIGGER_NOT_FOUND');
    }
    trigger.status = status;
    trigger.updatedAt = new Date();
    this.triggers.set(triggerId, trigger);
    return trigger;
  }

  /**
   * Delete a trigger
   * Also unschedules any active cron timer
   */
  async deleteTrigger(triggerId: string): Promise<void> {
    await this.unscheduleTrigger(triggerId);
    this.triggers.delete(triggerId);
    this.executionHistory.delete(triggerId);
  }

  // ==================== Cron Scheduler ====================

  /**
   * Schedule a cron trigger for a pipeline
   * Creates an interval-based timer that fires on cron expression matches
   */
  async scheduleTrigger(triggerId: string, cronExpression: string): Promise<CronScheduleEntry> {
    // Validate the cron expression
    try {
      CronExpressionParser.parse(cronExpression);
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

    // Calculate the interval until next run
    const interval = this.calculateNextInterval(cronExpression);
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
    const interval = this.calculateNextInterval(entry.cronExpression);
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

        // Record success
        const record: TriggerExecutionRecord = {
          id: this.generateId('exec'),
          triggerId,
          pipelineId: trigger.pipelineId,
          tenantId: trigger.tenantId,
          status: 'success',
          executedAt: new Date(),
        };
        const history = this.executionHistory.get(triggerId) ?? [];
        history.push(record);
        this.executionHistory.set(triggerId, history);
      } catch (error) {
        logger.error(
          { triggerId, error },
          'Cron trigger execution failed'
        );
        await this.recordFailure(triggerId, error instanceof Error ? error.message : String(error));
      }
    } else {
      // No callback, just record the tick
      const record: TriggerExecutionRecord = {
        id: this.generateId('exec'),
        triggerId,
        pipelineId: trigger.pipelineId,
        tenantId: trigger.tenantId,
        status: 'success',
        executedAt: new Date(),
      };
      const history = this.executionHistory.get(triggerId) ?? [];
      history.push(record);
      this.executionHistory.set(triggerId, history);
    }
  }

  /**
   * Calculate the interval in ms until the next cron expression match
   * Uses cron-parser for accurate calculation
   */
  private calculateNextInterval(cronExpression: string): number {
    try {
      const interval = CronExpressionParser.parse(cronExpression);
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

    const record: TriggerExecutionRecord = {
      id: this.generateId('exec'),
      triggerId,
      pipelineId: trigger.pipelineId,
      tenantId: trigger.tenantId,
      status: 'success',
      executedAt: new Date(),
    };

    // Store execution record
    const history = this.executionHistory.get(triggerId) ?? [];
    history.push(record);
    this.executionHistory.set(triggerId, history);

    return record;
  }

  /**
   * Record a failed execution
   */
  async recordFailure(triggerId: string, message: string): Promise<TriggerExecutionRecord> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new PipelineTriggerServiceError(`Trigger not found: ${triggerId}`, 'TRIGGER_NOT_FOUND');
    }

    const record: TriggerExecutionRecord = {
      id: this.generateId('exec'),
      triggerId,
      pipelineId: trigger.pipelineId,
      tenantId: trigger.tenantId,
      status: 'failed',
      message,
      executedAt: new Date(),
    };

    const history = this.executionHistory.get(triggerId) ?? [];
    history.push(record);
    this.executionHistory.set(triggerId, history);

    // Mark trigger as failed if too many failures
    const recentFailures = history.filter(
      (r) => r.status === 'failed' && r.executedAt > new Date(Date.now() - 3600000)
    );
    if (recentFailures.length >= 5) {
      trigger.status = 'failed';
      trigger.updatedAt = new Date();
      this.triggers.set(triggerId, trigger);
    }

    return record;
  }

  // ==================== Trigger History ====================

  /**
   * Get execution history for a pipeline
   */
  async getTriggerHistory(pipelineId: string, tenantId?: string): Promise<TriggerExecutionRecord[]> {
    const results: TriggerExecutionRecord[] = [];
    for (const [triggerId, history] of this.executionHistory.entries()) {
      const trigger = this.triggers.get(triggerId);
      if (trigger && trigger.pipelineId === pipelineId) {
        if (!tenantId || trigger.tenantId === tenantId) {
          results.push(...history);
        }
      }
    }
    return results.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
  }

  /**
   * Get execution history for a specific trigger
   */
  async getTriggerHistoryById(triggerId: string): Promise<TriggerExecutionRecord[]> {
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
        const hasMatch = changedFiles.some((file) =>
          config.pathPatterns!.some((pattern) => this.matchesPattern(file, pattern))
        );
        if (!hasMatch) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesPattern(value: string, pattern: string): boolean {
    // Simple glob-like matching
    if (pattern === value) {
      return true;
    }
    if (pattern.startsWith('*')) {
      return value.endsWith(pattern.slice(1));
    }
    if (pattern.endsWith('*')) {
      return value.startsWith(pattern.slice(0, -1));
    }
    return false;
  }

  private generateId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${Date.now()}-${this.counter}`;
  }
}
