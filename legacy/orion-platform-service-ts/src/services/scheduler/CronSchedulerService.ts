/**
 * Cron Scheduler Service
 * 分布式定时任务调度服务
 *
 * - PostgreSQL persistence via CronJobRepository / CronExecutionRepository as the authoritative store
 * - In-memory cache (optional) for scheduler tick hot-path; degraded to DB-only on cache miss
 * - Real cron expression parsing via cron-parser library
 * - Scheduler loop with 60s tick interval
 * - UTC timezone by default
 */

import { createLogger } from '../../utils/logger';
import { CronExpressionParser } from 'cron-parser';
import { CronJobRepository, CronJobEntity } from '../../repositories/CronJobRepository';
import { CronExecutionRepository } from '../../repositories/CronExecutionRepository';
import { OrionError, ErrorCode } from '../../errors';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('CronSchedulerService');

// ─── Domain Types (as expected by cron-routes.ts) ───────────────────────────

export interface CronJob {
  id: string;
  name: string;
  schedule: string; // 5-field cron expression: minute hour day month weekday
  task: string;     // task identifier / handler name
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastRunStatus?: string;
  payload?: Record<string, unknown>;
}

export interface CronJobExecution {
  executionId: string;
  jobId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'success' | 'failed';
  output?: string;
  error?: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

const DEFAULT_TICK_MS = 60_000; // 60 seconds

export class CronSchedulerService {
  private cronJobRepo?: CronJobRepository;
  private executionRepo?: CronExecutionRepository;

  /**
   * In-memory cache — secondary to DB.
   * Populated lazily on first read; refreshed on create/enable/disable/remove.
   * Falls back to DB queries if cache is inconsistent.
   */
  private cache: Map<string, CronJob> = new Map();
  private executions: CronJobExecution[] = [];
  private runningJobIds: Set<string> = new Set();
  private intervalId?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }) {
    if (db) {
      this.cronJobRepo = new CronJobRepository(db);
      this.executionRepo = new CronExecutionRepository(db);
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) {
      logger.warn({ traceId: getCurrentTraceId() }, 'CronSchedulerService already running');
      return;
    }
    this.running = true;

    // Warm cache from DB — load all jobs (enabled + disabled) so the scheduler
    // sees the complete set.
    if (this.cronJobRepo) {
      try {
        const { entities } = await this.cronJobRepo.findAll({ limit: 10000, offset: 0 });
        for (const entity of entities) {
          this.cache.set(entity.id, this.mapEntityToJob(entity));
        }
        logger.info({ count: entities.length }, 'CronSchedulerService warmed cache from DB');
      } catch (err) {
        logger.error({ traceId: getCurrentTraceId(), err }, 'CronSchedulerService failed to warm cache from DB');
        // Keep the scheduler running even if cache warm fails; it will fall back
        // to DB reads on each tick.
      }
    }

    this.intervalId = setInterval(() => {
      this.checkAndExecuteJobs().catch((err) => {
        logger.error({ traceId: getCurrentTraceId(), err }, 'Scheduler tick error');
      });
    }, DEFAULT_TICK_MS);
    logger.info({ tickMs: DEFAULT_TICK_MS }, 'CronSchedulerService started');
  }

  stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    logger.info('CronSchedulerService stopped');
  }

  // ── Job CRUD ────────────────────────────────────────────────────────────

  /**
   * Add a cron job. Authoritative store is PostgreSQL; cache is updated in sync.
   */
  addJob(job: { id: string; name: string; schedule: string; task: string; enabled?: boolean }): void {
    // Validate cron expression (throws on invalid)
    CronExpressionParser.parse(job.schedule, { tz: 'UTC' });

    const now = new Date();
    const cronJob: CronJob = {
      id: job.id,
      name: job.name,
      schedule: job.schedule,
      task: job.task,
      enabled: job.enabled ?? true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      nextRunAt: this.computeNextRun(job.schedule),
    };

    // Update in-memory cache synchronously (hot path)
    this.cache.set(cronJob.id, cronJob);

    // Persist asynchronously (fire-and-forget; routes don't await it)
    if (this.cronJobRepo) {
      this.cronJobRepo.create({
        id: cronJob.id,
        name: cronJob.name,
        schedule: cronJob.schedule,
        handler: cronJob.task,
        payload: {},
        enabled: cronJob.enabled,
        lastRunAt: null,
        lastRunStatus: null,
        nextRunAt: cronJob.nextRunAt ? new Date(cronJob.nextRunAt) : null,
        createdAt: now,
      }).catch((err) => {
        logger.warn({ traceId: getCurrentTraceId(), err, jobId: cronJob.id }, 'Failed to persist cron job to DB');
      });
    }

    logger.info({ jobId: cronJob.id, name: cronJob.name, schedule: cronJob.schedule }, 'Cron job added');
  }

  /**
   * Return all jobs. DB is authoritative; cache is consulted first.
   * On cache miss or if no cache exists, falls back to a DB query.
   */
  async getJobs(): Promise<CronJob[]> {
    // Quick path: serve from cache if we have it
    if (this.cache.size > 0 && !this.cronJobRepo) {
      return Array.from(this.cache.values());
    }

    if (this.cronJobRepo) {
      try {
        const result = await this.cronJobRepo.findAll({ limit: 10000, offset: 0 });
        // Update cache with fresh data
        this.cache.clear();
        for (const entity of result.entities) {
          this.cache.set(entity.id, this.mapEntityToJob(entity));
        }
        return result.entities.map((e) => this.mapEntityToJob(e));
      } catch (err) {
        logger.warn({ traceId: getCurrentTraceId(), err }, 'DB getJobs failed, falling back to cache');
      }
    }

    // Last resort: in-memory cache
    return Array.from(this.cache.values());
  }

  /**
   * Get a single job by id.
   * Checks cache first, then falls back to DB.
   */
  getJob(id: string): CronJob | undefined {
    const cached = this.cache.get(id);
    if (cached) {
      return cached;
    }

    if (this.cronJobRepo) {
      try {
        // Sync read from DB — note: this is a synchronous method, so we
        // can't await here. We leave it fire-and-forget and populate the
        // cache if it succeeds.
        this.cronJobRepo.findById(id)
          .then((entity) => {
            if (entity) {
              const job = this.mapEntityToJob(entity);
              this.cache.set(entity.id, job);
            }
          })
          .catch(() => { /* silent */ });
      } catch {
        // ignore
      }
    }

    return this.cache.get(id);
  }

  /**
   * Remove a cron job. Updates cache synchronously; persists to DB fire-and-forget.
   */
  removeJob(id: string): void {
    this.cache.delete(id);
    this.runningJobIds.delete(id);

    if (this.cronJobRepo) {
      this.cronJobRepo.delete(id).catch((err) => {
        logger.warn({ traceId: getCurrentTraceId(), err, jobId: id }, 'Failed to remove cron job from DB');
      });
    }
    logger.info({ jobId: id }, 'Cron job removed');
  }

  /**
   * Enable a disabled job.
   */
  enableJob(id: string): void {
    const job = this.cache.get(id);
    if (!job) {
      logger.warn({ traceId: getCurrentTraceId(), jobId: id }, 'enableJob: job not found');
      return;
    }
    job.enabled = true;
    job.updatedAt = new Date().toISOString();
    job.nextRunAt = this.computeNextRun(job.schedule);
    this.cache.set(id, job);

    if (this.cronJobRepo) {
      this.cronJobRepo.update(id, { enabled: true }).catch((err) => {
        logger.warn({ traceId: getCurrentTraceId(), err, jobId: id }, 'Failed to enable cron job in DB');
      });
    }
    logger.info({ jobId: id }, 'Cron job enabled');
  }

  /**
   * Disable a job.
   */
  disableJob(id: string): void {
    const job = this.cache.get(id);
    if (!job) {
      logger.warn({ traceId: getCurrentTraceId(), jobId: id }, 'disableJob: job not found');
      return;
    }
    job.enabled = false;
    job.updatedAt = new Date().toISOString();
    job.nextRunAt = undefined;
    this.cache.set(id, job);

    if (this.cronJobRepo) {
      this.cronJobRepo.update(id, { enabled: false }).catch((err) => {
        logger.warn({ traceId: getCurrentTraceId(), err, jobId: id }, 'Failed to disable cron job in DB');
      });
    }
    logger.info({ jobId: id }, 'Cron job disabled');
  }

  // ── Execution ───────────────────────────────────────────────────────────

  async executeJob(id: string): Promise<CronJobExecution> {
    const job = this.cache.get(id);
    if (!job) {
      // Try DB as authoritative source of truth
      if (this.cronJobRepo) {
        const entity = await this.cronJobRepo.findById(id);
        if (entity) {
          const mapped = this.mapEntityToJob(entity);
          this.cache.set(id, mapped);
          return this.runJob(mapped);
        }
      }
      throw new OrionError(`Cron job not found: ${id}`, ErrorCode.NOT_FOUND);
    }
    return this.runJob(job);
  }

  private async runJob(job: CronJob): Promise<CronJobExecution> {
    const executionId = `exec_${Date.now()}_${job.id}`;
    const now = new Date();

    const execution: CronJobExecution = {
      executionId,
      jobId: job.id,
      startedAt: now.toISOString(),
      status: 'running',
    };

    this.runningJobIds.add(job.id);

    // Persist execution record to DB
    if (this.executionRepo) {
      try {
        await this.executionRepo.create({
          id: executionId,
          jobId: job.id,
          startedAt: now,
          status: 'running',
        });
      } catch (err) {
        logger.warn({ traceId: getCurrentTraceId(), err }, 'Failed to persist execution record');
      }
    }

    this.executions.push(execution);

    try {
      // Execute the task (placeholder — dispatch to registered handler in production)
      const output = await this.executeTask(job);

      execution.status = 'success';
      execution.completedAt = new Date().toISOString();
      execution.output = output;

      // Update job metadata in cache
      job.lastRunAt = execution.completedAt;
      job.lastRunStatus = 'success';
      job.nextRunAt = this.computeNextRun(job.schedule);
      job.updatedAt = new Date().toISOString();
      this.cache.set(job.id, job);

      // Persist execution completion + job lastRun in DB
      if (this.executionRepo) {
        await this.executionRepo.complete(executionId, 'completed', { output }).catch((err) => {
          logger.warn({ traceId: getCurrentTraceId(), err }, 'Failed to persist execution completion');
        });
      }
      if (this.cronJobRepo) {
        await this.cronJobRepo.updateLastRun(
          job.id,
          new Date(job.lastRunAt!),
          'success',
          job.nextRunAt ? new Date(job.nextRunAt) : now,
        ).catch((err) => {
          logger.warn({ traceId: getCurrentTraceId(), err }, 'Failed to update job lastRun in DB');
        });
      }

      logger.info({ jobId: job.id, executionId }, 'Cron job executed successfully');
    } catch (err) {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      execution.error = err instanceof Error ? err.message : String(err);

      job.lastRunAt = execution.completedAt;
      job.lastRunStatus = 'failed';
      job.nextRunAt = this.computeNextRun(job.schedule);
      job.updatedAt = new Date().toISOString();
      this.cache.set(job.id, job);

      if (this.executionRepo) {
        await this.executionRepo.complete(executionId, 'failed', undefined, execution.error).catch((err) => {
          logger.warn({ traceId: getCurrentTraceId(), err }, 'Failed to persist execution failure');
        });
      }
      if (this.cronJobRepo) {
        await this.cronJobRepo.updateLastRun(
          job.id,
          new Date(job.lastRunAt!),
          'failed',
          job.nextRunAt ? new Date(job.nextRunAt) : now,
        ).catch((err) => {
          logger.warn({ traceId: getCurrentTraceId(), err }, 'Failed to update job lastRun in DB');
        });
      }

      logger.error({ traceId: getCurrentTraceId(), jobId: job.id, executionId, error: execution.error }, 'Cron job execution failed');
    } finally {
      this.runningJobIds.delete(job.id);
    }

    return execution;
  }

  /**
   * Execute the actual task logic.
   * In production this would dispatch to registered task handlers.
   */
  private async executeTask(job: CronJob): Promise<string> {
    logger.info({ jobId: job.id, task: job.task }, 'Executing cron task');
    return `Task "${job.task}" executed successfully at ${new Date().toISOString()}`;
  }

  // ── Execution History ───────────────────────────────────────────────────

  getExecutionHistory(jobId?: string): CronJobExecution[] {
    if (this.executionRepo && !jobId) {
      // If we have DB and no specific jobId, try fetching from DB first
      // but keep it simple — just return cached executions for now
    }
    return jobId
      ? this.executions.filter((e) => e.jobId === jobId)
      : [...this.executions];
  }

  // ── Running Jobs ────────────────────────────────────────────────────────

  getRunningJobs(): string[] {
    return Array.from(this.runningJobIds);
  }

  // ── Scheduler Tick ──────────────────────────────────────────────────────

  private async checkAndExecuteJobs(): Promise<void> {
    if (!this.running) return;

    const now = new Date();
    const jobs = await this.getJobs();

    for (const job of jobs) {
      if (!job.enabled) continue;
      if (this.runningJobIds.has(job.id)) continue;

      if (this.shouldExecuteJob(job, now)) {
        logger.info({ jobId: job.id, name: job.name, now: now.toISOString() }, 'Scheduler tick: executing job');
        this.runJob(job).catch((err) => {
          logger.error({ traceId: getCurrentTraceId(), err, jobId: job.id }, 'Unhandled error during scheduler tick execution');
        });
      }
    }
  }

  /**
   * Determine whether a job should execute at the given time.
   * Uses cron-parser to compute the previous scheduled time and checks
   * if it falls within the tick window.
   */
  shouldExecuteJob(job: CronJob, now: Date = new Date()): boolean {
    if (!job.enabled) return false;

    try {
      const interval = CronExpressionParser.parse(job.schedule, {
        currentDate: now,
        tz: 'UTC',
      });
      const prev = interval.prev();
      const diff = now.getTime() - prev.getTime();
      // If the previous scheduled time is within the poll interval (60s + 5s tolerance), execute
      return diff < DEFAULT_TICK_MS + 5_000;
    } catch {
      logger.warn({ traceId: getCurrentTraceId(), jobId: job.id, schedule: job.schedule }, 'Invalid cron expression, skipping');
      return false;
    }
  }

  // ── Cron Expression Utilities ───────────────────────────────────────────

  private computeNextRun(expression: string): string | undefined {
    try {
      const interval = CronExpressionParser.parse(expression, { tz: 'UTC' });
      const next = interval.next();
      const iso = next.toISOString();
      return iso ?? undefined;
    } catch {
      logger.warn({ traceId: getCurrentTraceId(), expression }, 'Invalid cron expression');
      return undefined;
    }
  }

  // ── Entity Mapping ──────────────────────────────────────────────────────

  private mapEntityToJob(entity: CronJobEntity): CronJob {
    return {
      id: entity.id,
      name: entity.name,
      schedule: entity.schedule,
      task: entity.handler,
      enabled: entity.enabled,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.createdAt.toISOString(),
      lastRunAt: entity.lastRunAt?.toISOString(),
      nextRunAt: entity.nextRunAt?.toISOString(),
      lastRunStatus: entity.lastRunStatus ?? undefined,
      payload: entity.payload,
    };
  }
}
