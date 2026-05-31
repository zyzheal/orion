/**
 * Cron Scheduler Service
 * 分布式定时任务调度服务
 *
 * - PostgreSQL persistence via CronJobRepository / CronExecutionRepository
 * - In-memory fallback for environments without DB
 * - Real cron expression parsing via cron-parser library
 * - Scheduler loop with 60s tick interval
 * - UTC timezone by default
 */

import pino from 'pino';
import { CronExpressionParser } from 'cron-parser';
import { CronJobRepository, CronJobEntity } from '../../repositories/CronJobRepository';
import { CronExecutionRepository, CronExecutionEntity } from '../../repositories/CronExecutionRepository';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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
  private cronJobRepository?: CronJobRepository;
  private executionRepository?: CronExecutionRepository;

  // In-memory fallback (for tests / no-DB environments)
  private jobs: Map<string, CronJob> = new Map();
  private executions: CronJobExecution[] = [];
  private runningJobIds: Set<string> = new Set();
  private intervalId?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.cronJobRepository = new CronJobRepository(db);
      this.executionRepository = new CronExecutionRepository(db);
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) {
      logger.warn('CronSchedulerService already running');
      return;
    }
    this.running = true;

    // Restore enabled jobs from DB into in-memory map
    if (this.cronJobRepository) {
      try {
        const enabledJobs = await this.cronJobRepository.findEnabled();
        for (const entity of enabledJobs) {
          const job = this.mapEntityToJob(entity);
          this.jobs.set(job.id, job);
        }
        logger.info({ count: enabledJobs.length }, 'CronSchedulerService restored jobs from DB');
      } catch (err) {
        logger.error({ err }, 'CronSchedulerService failed to restore jobs from DB');
      }
    }

    this.intervalId = setInterval(() => {
      this.checkAndExecuteJobs().catch((err) => {
        logger.error({ err }, 'Scheduler tick error');
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
   * Add a cron job.
   * Sync — routes don't await it. DB writes happen fire-and-forget.
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

    // Persist (fire-and-forget)
    if (this.cronJobRepository) {
      this.cronJobRepository.create({
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
        logger.warn({ err, jobId: cronJob.id }, 'Failed to persist cron job, using in-memory');
      });
    }

    this.jobs.set(cronJob.id, cronJob);
    logger.info({ jobId: cronJob.id, name: cronJob.name, schedule: cronJob.schedule }, 'Cron job added');
  }

  async getJobs(): Promise<CronJob[]> {
    if (this.cronJobRepository) {
      try {
        const result = await this.cronJobRepository.findAll();
        return result.entities.map((e) => this.mapEntityToJob(e));
      } catch (err) {
        logger.warn({ err }, 'DB getJobs failed, falling back to in-memory');
      }
    }
    return Array.from(this.jobs.values());
  }

  getJob(id: string): CronJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Remove a cron job. Sync — routes don't await it.
   */
  removeJob(id: string): void {
    if (this.cronJobRepository) {
      this.cronJobRepository.delete(id).catch((err) => {
        logger.warn({ err, jobId: id }, 'Failed to remove cron job from DB');
      });
    }
    this.jobs.delete(id);
    this.runningJobIds.delete(id);
    logger.info({ jobId: id }, 'Cron job removed');
  }

  /**
   * Enable a disabled job. Sync.
   */
  enableJob(id: string): void {
    const job = this.jobs.get(id);
    if (!job) {
      logger.warn({ jobId: id }, 'enableJob: job not found');
      return;
    }
    job.enabled = true;
    job.updatedAt = new Date().toISOString();
    job.nextRunAt = this.computeNextRun(job.schedule);
    this.jobs.set(id, job);

    if (this.cronJobRepository) {
      this.cronJobRepository.update(id, { enabled: true }).catch((err) => {
        logger.warn({ err, jobId: id }, 'Failed to enable cron job in DB');
      });
    }
    logger.info({ jobId: id }, 'Cron job enabled');
  }

  /**
   * Disable a job. Sync.
   */
  disableJob(id: string): void {
    const job = this.jobs.get(id);
    if (!job) {
      logger.warn({ jobId: id }, 'disableJob: job not found');
      return;
    }
    job.enabled = false;
    job.updatedAt = new Date().toISOString();
    job.nextRunAt = undefined;
    this.jobs.set(id, job);

    if (this.cronJobRepository) {
      this.cronJobRepository.update(id, { enabled: false }).catch((err) => {
        logger.warn({ err, jobId: id }, 'Failed to disable cron job in DB');
      });
    }
    logger.info({ jobId: id }, 'Cron job disabled');
  }

  // ── Execution ───────────────────────────────────────────────────────────

  async executeJob(id: string): Promise<CronJobExecution> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Cron job not found: ${id}`);
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

    // Persist execution record
    if (this.executionRepository) {
      try {
        await this.executionRepository.create({
          id: executionId,
          jobId: job.id,
          startedAt: now,
          status: 'running',
        });
      } catch (err) {
        logger.warn({ err }, 'Failed to persist execution record');
      }
    }

    this.executions.push(execution);

    try {
      // Execute the task (placeholder — dispatch to registered handler in production)
      const output = await this.executeTask(job);

      execution.status = 'success';
      execution.completedAt = new Date().toISOString();
      execution.output = output;

      // Update job lastRunAt
      job.lastRunAt = execution.completedAt;
      job.lastRunStatus = 'success';
      job.nextRunAt = this.computeNextRun(job.schedule);
      job.updatedAt = new Date().toISOString();
      this.jobs.set(job.id, job);

      // Persist completion
      if (this.executionRepository) {
        await this.executionRepository.complete(executionId, 'completed', { output }).catch((err) => {
          logger.warn({ err }, 'Failed to persist execution completion');
        });
      }
      if (this.cronJobRepository) {
        await this.cronJobRepository.updateLastRun(
          job.id,
          new Date(job.lastRunAt!),
          'success',
          job.nextRunAt ? new Date(job.nextRunAt) : new Date(),
        ).catch((err) => {
          logger.warn({ err }, 'Failed to update job lastRun in DB');
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
      this.jobs.set(job.id, job);

      if (this.executionRepository) {
        await this.executionRepository.complete(executionId, 'failed', undefined, execution.error).catch((err) => {
          logger.warn({ err }, 'Failed to persist execution failure');
        });
      }
      if (this.cronJobRepository) {
        await this.cronJobRepository.updateLastRun(
          job.id,
          new Date(job.lastRunAt!),
          'failed',
          job.nextRunAt ? new Date(job.nextRunAt) : new Date(),
        ).catch((err) => {
          logger.warn({ err }, 'Failed to update job lastRun in DB');
        });
      }

      logger.error({ jobId: job.id, executionId, error: execution.error }, 'Cron job execution failed');
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
          logger.error({ err, jobId: job.id }, 'Unhandled error during scheduler tick execution');
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
      logger.warn({ jobId: job.id, schedule: job.schedule }, 'Invalid cron expression, skipping');
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
      logger.warn({ expression }, 'Invalid cron expression');
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
      updatedAt: entity.createdAt.toISOString(), // entity doesn't have updatedAt; use createdAt
      lastRunAt: entity.lastRunAt?.toISOString(),
      nextRunAt: entity.nextRunAt?.toISOString(),
      lastRunStatus: entity.lastRunStatus ?? undefined,
      payload: entity.payload,
    };
  }
}
