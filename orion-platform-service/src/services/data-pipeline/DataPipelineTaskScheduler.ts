/**
 * DataPipelineTaskScheduler — DataPipeline 任务调度器
 *
 * 职责：
 * - 全局并发控制
 * - 优先级队列管理
 * - 任务入队/出队
 * - 背压控制
 * - 调度统计
 *
 * 作为 DataPipelineAsyncEngine 的底层调度组件。
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'data-pipeline-scheduler' });

// ==================== Type Definitions ====================

export type TaskPriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface ScheduledTask {
  id: string;
  pipelineId: string;
  tenantId: string;
  priority: TaskPriority;
  execute: () => Promise<void>;
  enqueuedAt: number;
}

export interface SchedulerConfig {
  maxConcurrent: number;
  maxQueueSize: number;
}

export interface SchedulerStats {
  totalEnqueued: number;
  totalDequeued: number;
  totalRejected: number;
  totalCompleted: number;
  totalFailed: number;
  currentQueueDepth: number;
  currentRunning: number;
  averageWaitMs: number;
}

// ==================== DataPipelineTaskScheduler ====================

export class DataPipelineTaskScheduler extends EventEmitter {
  private config: SchedulerConfig;
  private queue: ScheduledTask[] = [];
  private running = new Map<string, ScheduledTask>();
  private runningCount = 0;

  // Stats
  private totalEnqueued = 0;
  private totalDequeued = 0;
  private totalRejected = 0;
  private totalCompleted = 0;
  private totalFailed = 0;
  private totalWaitMs = 0;

  constructor(config?: Partial<SchedulerConfig>) {
    super();
    this.config = {
      maxConcurrent: config?.maxConcurrent ?? parseInt(process.env.DATA_PIPELINE_MAX_CONCURRENT || '4', 10),
      maxQueueSize: config?.maxQueueSize ?? parseInt(process.env.DATA_PIPELINE_MAX_QUEUE_SIZE || '100', 10),
    };

    logger.info({ config: this.config }, 'DataPipelineTaskScheduler initialized');
  }

  // ==================== Public API ====================

  /**
   * 入队任务
   */
  enqueue(task: ScheduledTask): boolean {
    if (this.runningCount >= this.config.maxConcurrent) {
      if (this.queue.length >= this.config.maxQueueSize) {
        this.totalRejected++;
        logger.warn(
          { taskId: task.id, queueDepth: this.queue.length, running: this.runningCount },
          'Queue full, rejecting task'
        );
        return false;
      }
    }

    this.queue.push(task);
    this.totalEnqueued++;
    this.emit('task:enqueued', { taskId: task.id, priority: task.priority });

    this.tryDequeue();
    return true;
  }

  /**
   * 取消任务
   */
  cancel(taskId: string): boolean {
    // 检查队列中
    const queueIndex = this.queue.findIndex((t) => t.id === taskId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
      this.emit('task:cancelled', { taskId, reason: 'cancelled before start' });
      return true;
    }

    // 运行中的任务无法直接取消（需要引擎层协作）
    return false;
  }

  /**
   * 获取调度统计
   */
  getStats(): SchedulerStats {
    return {
      totalEnqueued: this.totalEnqueued,
      totalDequeued: this.totalDequeued,
      totalRejected: this.totalRejected,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
      currentQueueDepth: this.queue.length,
      currentRunning: this.runningCount,
      averageWaitMs: this.totalDequeued > 0 ? Math.round(this.totalWaitMs / this.totalDequeued) : 0,
    };
  }

  /**
   * 获取当前运行任务数
   */
  getRunningCount(): number {
    return this.runningCount;
  }

  /**
   * 获取队列深度
   */
  getQueueDepth(): number {
    return this.queue.length;
  }

  /**
   * 清空调度器
   */
  destroy(): void {
    this.queue = [];
    this.running.clear();
    this.runningCount = 0;
    this.totalEnqueued = 0;
    this.totalDequeued = 0;
    this.totalRejected = 0;
    this.totalCompleted = 0;
    this.totalFailed = 0;
    this.totalWaitMs = 0;
  }

  // ==================== Internal ====================

  /**
   * 尝试出队并执行
   */
  private tryDequeue(): void {
    if (this.runningCount >= this.config.maxConcurrent) return;

    // 按优先级排序
    const priorityWeight = { HIGH: 0, NORMAL: 1, LOW: 2 };
    this.queue.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);

    const task = this.queue.shift();
    if (!task) return;

    this.runningCount++;
    this.running.set(task.id, task);
    this.totalDequeued++;
    this.totalWaitMs += Date.now() - task.enqueuedAt;

    this.executeTask(task);
  }

  /**
   * 执行任务
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    this.emit('task:started', { taskId: task.id });

    try {
      await task.execute();
      this.totalCompleted++;
      this.emit('task:completed', { taskId: task.id });
    } catch (error) {
      this.totalFailed++;
      this.emit('task:failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running.delete(task.id);
      this.runningCount = Math.max(0, this.runningCount - 1);
      this.tryDequeue();
    }
  }
}
