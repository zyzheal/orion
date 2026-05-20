/**
 * CacheCleanupService - 工作流缓存清理服务
 *
 * 定期清理工作流系统中的过期缓存数据：
 * - 审批缓存（WorkflowEngine approvalCache）
 * - 已完成/已取消的定时器记录
 * - 过期的人工任务记录
 *
 * 运行策略：
 * - 每日凌晨 2 点执行全量清理
 * - 每小时执行增量清理
 */

import { DatabasePool } from '../database';
import { WorkflowTimerRepository } from '../../repositories/WorkflowTimerRepository';
import { WorkflowTaskRepository } from '../../repositories/WorkflowTaskRepository';
import { WorkflowInstanceManager } from './WorkflowInstance';

const logger = require('pino')({ name: 'CacheCleanupService' });

/**
 * 清理配置
 */
export interface CacheCleanupConfig {
  /** 增量清理间隔（毫秒），默认 1 小时 */
  incrementalIntervalMs?: number;
  /** 全量清理 Cron 表达式，默认每天凌晨 2 点 */
  fullCleanupCron?: string;
  /** 已完成定时器保留天数，默认 30 天 */
  timerRetentionDays?: number;
  /** 已完成任务保留天数，默认 90 天 */
  taskRetentionDays?: number;
  /** 已完成实例保留天数，默认 90 天 */
  instanceRetentionDays?: number;
}

const DEFAULT_CONFIG: Required<CacheCleanupConfig> = {
  incrementalIntervalMs: 60 * 60 * 1000, // 1 小时
  fullCleanupCron: '0 2 * * *',          // 每天凌晨 2 点
  timerRetentionDays: 30,
  taskRetentionDays: 90,
  instanceRetentionDays: 90,
};

/**
 * 缓存清理结果
 */
export interface CleanupResult {
  type: string;
  deletedCount: number;
  durationMs: number;
}

/**
 * 缓存清理服务
 */
export class CacheCleanupService {
  private pool: InstanceType<typeof DatabasePool>;
  private timerRepo: WorkflowTimerRepository;
  private taskRepo: WorkflowTaskRepository;
  private instanceManager: WorkflowInstanceManager;
  private config: Required<CacheCleanupConfig>;
  private incrementalInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(
    databasePool?: DatabasePool,
    config?: CacheCleanupConfig,
  ) {
    this.pool = (databasePool ?? DatabasePool) as unknown as InstanceType<typeof DatabasePool>;
    this.timerRepo = new WorkflowTimerRepository();
    this.taskRepo = new WorkflowTaskRepository();
    this.instanceManager = new WorkflowInstanceManager();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动清理服务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('CacheCleanupService is already running');
      return;
    }

    logger.info('Starting CacheCleanupService...');
    this.isRunning = true;

    // 执行一次初始清理
    await this.runFullCleanup();

    // 定期增量清理
    this.incrementalInterval = setInterval(async () => {
      try {
        await this.runIncrementalCleanup();
      } catch (error) {
        logger.error({ error }, 'Incremental cleanup failed');
      }
    }, this.config.incrementalIntervalMs);

    logger.info(
      { incrementalIntervalMs: this.config.incrementalIntervalMs },
      'CacheCleanupService started'
    );
  }

  /**
   * 停止清理服务
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping CacheCleanupService...');

    if (this.incrementalInterval) {
      clearInterval(this.incrementalInterval);
      this.incrementalInterval = null;
    }

    this.isRunning = false;
    logger.info('CacheCleanupService stopped');
  }

  /**
   * 增量清理（定期执行）
   * 只清理最近过期的数据
   */
  async runIncrementalCleanup(): Promise<CleanupResult[]> {
    logger.info('Running incremental cache cleanup...');
    const results: CleanupResult[] = [];

    try {
      // 清理过期的审批缓存（内存中的，由 WorkflowEngine 自行管理）
      // 这里主要清理数据库中的过期数据

      // 清理过期的已完成定时器
      const timerResult = await this.cleanupExpiredTimers();
      results.push(timerResult);

      // 清理过期的已完成任务
      const taskResult = await this.cleanupExpiredTasks();
      results.push(taskResult);

      const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
      logger.info(
        { deletedCount: totalDeleted, durationMs: results.reduce((sum, r) => sum + r.durationMs, 0) },
        'Incremental cleanup completed'
      );
    } catch (error) {
      logger.error({ error }, 'Incremental cleanup failed');
    }

    return results;
  }

  /**
   * 全量清理（每日执行）
   * 清理所有过期数据
   */
  async runFullCleanup(): Promise<CleanupResult[]> {
    logger.info('Running full cache cleanup...');
    const results: CleanupResult[] = [];

    try {
      // 清理过期的已完成定时器
      const timerResult = await this.cleanupExpiredTimers();
      results.push(timerResult);

      // 清理过期的已完成任务
      const taskResult = await this.cleanupExpiredTasks();
      results.push(taskResult);

      // 清理过期的已完成/失败/已取消实例
      const instanceResult = await this.cleanupExpiredInstances();
      results.push(instanceResult);

      const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
      logger.info(
        { deletedCount: totalDeleted, durationMs: results.reduce((sum, r) => sum + r.durationMs, 0) },
        'Full cleanup completed'
      );
    } catch (error) {
      logger.error({ error }, 'Full cleanup failed');
    }

    return results;
  }

  /**
   * 清理过期的已完成定时器
   */
  private async cleanupExpiredTimers(): Promise<CleanupResult> {
    const startTime = Date.now();
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.timerRetentionDays);

    try {
      const result = await this.pool.query(
        `DELETE FROM workflow_timers
         WHERE status IN ('completed', 'cancelled')
         AND updated_at < $1`,
        [retentionDate],
      );

      const deletedCount = result.rowCount || 0;
      logger.info(
        { deletedCount, retentionDays: this.config.timerRetentionDays },
        'Cleaned up expired timers'
      );

      return {
        type: 'expired_timers',
        deletedCount,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup expired timers');
      return {
        type: 'expired_timers',
        deletedCount: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 清理过期的已完成任务
   */
  private async cleanupExpiredTasks(): Promise<CleanupResult> {
    const startTime = Date.now();
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.taskRetentionDays);

    try {
      const result = await this.pool.query(
        `DELETE FROM workflow_tasks
         WHERE status IN ('completed', 'cancelled')
         AND updated_at < $1`,
        [retentionDate],
      );

      const deletedCount = result.rowCount || 0;
      logger.info(
        { deletedCount, retentionDays: this.config.taskRetentionDays },
        'Cleaned up expired tasks'
      );

      return {
        type: 'expired_tasks',
        deletedCount,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup expired tasks');
      return {
        type: 'expired_tasks',
        deletedCount: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 清理过期的工作流实例
   * 注意：只清理已完成/失败/已取消的实例
   */
  private async cleanupExpiredInstances(): Promise<CleanupResult> {
    const startTime = Date.now();
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.instanceRetentionDays);

    try {
      // 直接通过 repository 清理数据库中的过期实例
      const deletedCount = await this.instanceManager.repository.cleanupExpiredInstances(retentionDate);

      logger.info(
        { deletedCount, retentionDays: this.config.instanceRetentionDays },
        'Cleaned up expired workflow instances'
      );

      return {
        type: 'expired_instances',
        deletedCount,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup expired instances');
      return {
        type: 'expired_instances',
        deletedCount: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 获取清理服务状态
   */
  getStatus(): { isRunning: boolean; config: CacheCleanupConfig } {
    return {
      isRunning: this.isRunning,
      config: this.config,
    };
  }

  /**
   * 手动触发全量清理
   */
  async triggerFullCleanup(): Promise<CleanupResult[]> {
    return this.runFullCleanup();
  }
}
