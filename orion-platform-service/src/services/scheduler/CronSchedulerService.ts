/**
 * Cron Scheduler Service
 * 分布式定时任务调度服务
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import { DistributedLockService } from './DistributedLockService';
import { EventBusService } from '../event-bus-service';

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
  private jobs: Map<string, CronJob> = new Map();
  private executions: Map<string, CronJobExecution> = new Map();
  private lockService: DistributedLockService;
  private eventBus?: EventBusService;
  private runningJobs: Set<string> = new Set();

  constructor(config?: CronSchedulerConfig, eventBus?: EventBusService) {
    super();
    this.eventBus = eventBus;
    this.lockService = new DistributedLockService(config?.redisUrl ? 
      { url: config?.redisUrl } : undefined);
  }

  /**
   * 添加定时任务
   */
  addJob(job: CronJob): void {
    this.jobs.set(job.id, job);
    logger.info({ jobId: job.id, name: job.name }, 'Cron job added');
  }

  /**
   * 移除定时任务
   */
  removeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobs.delete(jobId);
      logger.info({ jobId }, 'Cron job removed');
    }
  }

  /**
   * 启用定时任务
   */
  enableJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.enabled = true;
      logger.info({ jobId }, 'Cron job enabled');
    }
  }

  /**
   * 禁用定时任务
   */
  disableJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.enabled = false;
      logger.info({ jobId }, 'Cron job disabled');
    }
  }

  /**
   * 获取定时任务
   */
  getJob(jobId: string): CronJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * 获取所有定时任务
   */
  getJobs(): CronJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * 执行定时任务（带分布式锁）
   */
  async executeJob(jobId: string): Promise<CronJobExecution> {
    const job = this.jobs.get(jobId);
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
            
            logger.info({ jobId, executionId }, 'Cron job completed successfully');
          } catch (error) {
            execution.status = 'failed';
            execution.endTime = new Date();
            execution.error = error instanceof Error ? error.message : String(error);
            
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
    
    for (const [jobId, job] of this.jobs) {
      if (!job.enabled) continue;

      try {
        // 检查是否应该执行任务
        const shouldExecute = this.shouldExecuteJob(job, now);
        
        if (shouldExecute) {
          // 在后台执行任务
          this.executeJob(jobId).catch(error => {
            logger.error({ jobId, error }, 'Failed to execute job');
          });
        }
      } catch (error) {
        logger.error({ jobId, error }, 'Failed to check job');
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