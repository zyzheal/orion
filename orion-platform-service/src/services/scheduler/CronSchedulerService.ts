/**
 * Cron Scheduler Service
 * 分布式定时任务调度服务
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import { DistributedLockService } from './DistributedLockService';
import { EventBusService } from '../event-bus-service';
import { CronJobRepository, CronJobEntity } from '../../repositories/CronJobRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface CronJob {
  id: string;
  name: string;
  schedule: string; // Cron 表达式
  task: () => Promise<void>;
  enabled: boolean;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CronJobExecution {
  jobId: string;
  executionId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  result?: any;
}

export interface CronSchedulerConfig {
  redisUrl?: string;
  lockTtl?: number;
  lockRetryCount?: number;
  lockRetryDelay?: number;
}

export class CronSchedulerService extends EventEmitter {
  private taskHandlers: Map<string, () => Promise<void>> = new Map(); // Keep task handlers in memory
  private executions: Map<string, CronJobExecution> = new Map();
  private cronJobRepository?: CronJobRepository;
  private lockService: DistributedLockService;
  private eventBus?: EventBusService;
  private runningJobs: Set<string> = new Set();

  constructor(config?: CronSchedulerConfig, eventBus?: EventBusService, db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super();
    this.eventBus = eventBus;
    if (db) {
      this.cronJobRepository = new CronJobRepository(db);
    }
    this.lockService = new DistributedLockService(config?.redisUrl ?
      { url: config?.redisUrl } : undefined);
  }

  /**
   * 添加定时任务
   */
  async addJob(job: CronJob): Promise<void> {
    // Store task handler in memory
    this.taskHandlers.set(job.id, job.task);

    if (this.cronJobRepository) {
      await this.cronJobRepository.create({
        id: job.id,
        name: job.name,
        schedule: job.schedule,
        handler: job.id, // Handler reference
        payload: job.metadata ?? {},
        enabled: job.enabled,
        lastRunAt: null,
        lastRunStatus: null,
        nextRunAt: null,
        createdAt: new Date(),
      });
    }
    logger.info({ jobId: job.id, name: job.name }, 'Cron job added');
  }

  /**
   * 移除定时任务
   */
  async removeJob(jobId: string): Promise<void> {
    this.taskHandlers.delete(jobId);
    if (this.cronJobRepository) {
      await this.cronJobRepository.delete(jobId);
    }
    logger.info({ jobId }, 'Cron job removed');
  }

  /**
   * 启用定时任务
   */
  async enableJob(jobId: string): Promise<void> {
    if (this.cronJobRepository) {
      await this.cronJobRepository.update(jobId, { enabled: true });
    }
    logger.info({ jobId }, 'Cron job enabled');
  }

  /**
   * 禁用定时任务
   */
  async disableJob(jobId: string): Promise<void> {
    if (this.cronJobRepository) {
      await this.cronJobRepository.update(jobId, { enabled: false });
    }
    logger.info({ jobId }, 'Cron job disabled');
  }

  /**
   * 获取定时任务
   */
  async getJob(jobId: string): Promise<CronJob | undefined> {
    if (this.cronJobRepository) {
      const entity = await this.cronJobRepository.findById(jobId);
      if (!entity) return undefined;
      const task = this.taskHandlers.get(jobId);
      if (!task) return undefined;
      return this.mapEntityToJob(entity, task);
    }
    return undefined;
  }

  /**
   * 获取所有定时任务
   */
  async getJobs(): Promise<CronJob[]> {
    if (this.cronJobRepository) {
      const result = await this.cronJobRepository.findAll();
      return result.entities
        .filter(e => this.taskHandlers.has(e.id))
        .map(e => this.mapEntityToJob(e, this.taskHandlers.get(e.id)!));
    }
    return [];
  }

  private mapEntityToJob(entity: CronJobEntity, task: () => Promise<void>): CronJob {
    return {
      id: entity.id,
      name: entity.name,
      schedule: entity.schedule,
      task,
      enabled: entity.enabled,
      metadata: entity.payload,
    };
  }

  /**
   * 执行定时任务（带分布式锁）
   */
  async executeJob(jobId: string): Promise<CronJobExecution> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (!job.enabled) {
      throw new Error(`Job ${jobId} is disabled`);
    }

    const executionId = `${jobId}-${Date.now()}`;
    const execution: CronJobExecution = {
      jobId,
      executionId,
      startTime: new Date(),
      status: 'running',
    };

    this.executions.set(executionId, execution);
    this.runningJobs.add(jobId);

    try {
      // 使用分布式锁确保只有一个实例执行
      await this.lockService.executeWithLock(
        `cron:${jobId}`,
        async () => {
          logger.info({ jobId, executionId }, 'Executing cron job with lock');

          try {
            await job.task();
            execution.status = 'completed';
            execution.endTime = new Date();

            // Update repository with last run status
            if (this.cronJobRepository) {
              await this.cronJobRepository.updateLastRun(jobId, execution.startTime, 'completed', new Date());
            }

            logger.info({ jobId, executionId }, 'Cron job completed successfully');
          } catch (error) {
            execution.status = 'failed';
            execution.endTime = new Date();
            execution.error = error instanceof Error ? error.message : String(error);

            // Update repository with failed status
            if (this.cronJobRepository) {
              await this.cronJobRepository.updateLastRun(jobId, execution.startTime, 'failed', new Date());
            }

            logger.error({
              jobId,
              executionId,
              error: execution.error
            }, 'Cron job failed');
          }
        },
        {
          ttl: this.lockService['defaultTtl'],
          retryCount: this.lockService['defaultRetryCount'],
          retryDelay: this.lockService['defaultRetryDelay']
        }
      );

      // 发布事件
      await this.publishEvent('cron.job.completed', {
        jobId,
        executionId,
        status: execution.status,
        error: execution.error
      });

      return execution;
    } finally {
      this.runningJobs.delete(jobId);
      this.executions.delete(executionId);
    }
  }

  /**
   * 获取任务执行历史
   */
  getExecutionHistory(jobId?: string): CronJobExecution[] {
    if (jobId) {
      return Array.from(this.executions.values()).filter(exec => exec.jobId === jobId);
    }
    return Array.from(this.executions.values());
  }

  /**
   * 获取正在运行的任务
   */
  getRunningJobs(): string[] {
    return Array.from(this.runningJobs);
  }

  /**
   * 发布事件
   */
  private async publishEvent(type: string, data: any): Promise<void> {
    if (this.eventBus) {
      try {
        await this.eventBus.publish(type, data, { source: 'cron-scheduler' });
      } catch (error) {
        logger.warn({ error, type }, 'Failed to publish event');
      }
    }
  }

  /**
   * 启动调度器
   */
  start(): void {
    logger.info('Cron scheduler started');
    
    // 定期检查和执行任务
    setInterval(() => {
      this.checkAndExecuteJobs();
    }, 60000); // 每分钟检查一次
  }

  /**
   * 停止调度器
   */
  stop(): void {
    logger.info('Cron scheduler stopped');
  }

  /**
   * 检查并执行任务
   */
  private async checkAndExecuteJobs(): Promise<void> {
    const now = new Date();

    const jobs = await this.getJobs();
    for (const job of jobs) {
      if (!job.enabled) continue;

      try {
        // 检查是否应该执行任务
        const shouldExecute = this.shouldExecuteJob(job, now);

        if (shouldExecute) {
          // 在后台执行任务
          this.executeJob(job.id).catch(error => {
            logger.error({ jobId: job.id, error }, 'Failed to execute job');
          });
        }
      } catch (error) {
        logger.error({ jobId: job.id, error }, 'Failed to check job');
      }
    }
  }

  /**
   * 判断是否应该执行任务
   */
  private shouldExecuteJob(job: CronJob, now: Date): boolean {
    // 这里应该解析 Cron 表达式并判断是否应该执行
    // 简化实现：总是返回 true 用于演示
    return true;
  }
}