/**
 * PipelineExecutionQueue - 全局执行队列与背压控制
 *
 * 负责：
 * - 基于优先级的队列管理 (HIGH, NORMAL, LOW)
 * - 最大并发数限制 (MAX_CONCURRENT_PIPELINES)
 * - 背压：队列满时拒绝新请求
 * - 完成后自动出队并触发下一个
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'pipeline-execution-queue' });

export type QueuePriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface QueuedPipelineRun {
  runId: string;
  pipelineId: string;
  priority: QueuePriority;
  enqueueTime: number;
  executeFn: () => Promise<void>;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

export interface QueueStats {
  totalEnqueued: number;
  totalDequeued: number;
  totalRejected: number;
  currentQueueDepth: number;
  currentRunning: number;
  averageWaitTimeMs: number;
}

export interface PipelineExecutionQueueConfig {
  maxConcurrent: number;
  maxQueueSize: number;
}

/**
 * 优先级权重：用于排序，数字越小优先级越高
 */
const PRIORITY_WEIGHT: Record<QueuePriority, number> = {
  HIGH: 0,
  NORMAL: 1,
  LOW: 2,
};

export class PipelineExecutionQueue extends EventEmitter {
  private config: PipelineExecutionQueueConfig;
  private queue: QueuedPipelineRun[] = [];
  private runningCount = 0;

  // 统计
  private totalEnqueued = 0;
  private totalDequeued = 0;
  private totalRejected = 0;
  private totalWaitTimeMs = 0;

  constructor(config?: Partial<PipelineExecutionQueueConfig>) {
    super();
    this.config = {
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT_PIPELINES || '10', 10),
      maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || '100', 10),
      ...config,
    };
    logger.info({ config: this.config }, 'Pipeline execution queue initialized');
  }

  /**
   * 将 PipelineRun 加入队列
   * @returns Promise，当该 run 被执行完成后 resolve
   */
  async enqueue(run: Omit<QueuedPipelineRun, 'enqueueTime'>): Promise<void> {
    // 背压检查：队列已满
    if (this.queue.length >= this.config.maxQueueSize) {
      this.totalRejected++;
      const error = new Error(
        `Pipeline execution queue is full (max: ${this.config.maxQueueSize}). Try again later.`
      );
      logger.warn(
        { runId: run.runId, queueDepth: this.queue.length },
        'Queue full, rejecting new pipeline run'
      );
      throw error;
    }

    const queued: QueuedPipelineRun = {
      ...run,
      enqueueTime: Date.now(),
    };

    this.queue.push(queued);
    this.totalEnqueued++;

    // 按优先级排序（先入队的同优先级中优先）
    this.queue.sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.enqueueTime - b.enqueueTime;
    });

    logger.info(
      { runId: run.runId, priority: run.priority, queueDepth: this.queue.length },
      'Pipeline run enqueued'
    );

    // 尝试触发执行
    this.tryDequeue();

    // 等待该 run 执行完成
    return new Promise<void>((resolve, reject) => {
      // 替换原有的 resolve/reject 为包装版本
      const originalResolve = queued.resolve;
      const originalReject = queued.reject;
      queued.resolve = (value: any) => {
        originalResolve(value);
        resolve();
      };
      queued.reject = (reason: any) => {
        originalReject(reason);
        reject(reason);
      };
    });
  }

  /**
   * 尝试从队列中取出并执行下一个 run
   */
  private tryDequeue(): void {
    while (this.runningCount < this.config.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) break;

      this.runningCount++;
      this.totalDequeued++;

      // 记录等待时间
      const waitTime = Date.now() - next.enqueueTime;
      this.totalWaitTimeMs += waitTime;

      logger.info(
        {
          runId: next.runId,
          waitTimeMs: waitTime,
          runningCount: this.runningCount,
        },
        'Dequeueing and executing pipeline run'
      );

      this.emit('dequeue', { runId: next.runId, waitTimeMs: waitTime });

      // 执行
      this.executeRun(next).catch((err) => {
        logger.error({ traceId: getCurrentTraceId(), runId: next.runId, error: err }, 'Pipeline execution error');
      });
    }
  }

  /**
   * 执行单个 PipelineRun
   */
  private async executeRun(queued: QueuedPipelineRun): Promise<void> {
    try {
      await queued.executeFn();
      queued.resolve(undefined);
      this.emit('completed', { runId: queued.runId });
    } catch (error) {
      queued.reject(error);
      this.emit('failed', { runId: queued.runId, error });
    } finally {
      this.runningCount--;
      logger.info(
        { runId: queued.runId, runningCount: this.runningCount },
        'Pipeline run finished, checking queue'
      );
      // 完成后尝试触发下一个
      this.tryDequeue();
    }
  }

  /**
   * 获取当前队列深度
   */
  getDepth(): number {
    return this.queue.length;
  }

  /**
   * 获取当前运行中的数量
   */
  getRunningCount(): number {
    return this.runningCount;
  }

  /**
   * 获取队列统计信息
   */
  getStats(): QueueStats {
    return {
      totalEnqueued: this.totalEnqueued,
      totalDequeued: this.totalDequeued,
      totalRejected: this.totalRejected,
      currentQueueDepth: this.queue.length,
      currentRunning: this.runningCount,
      averageWaitTimeMs: this.totalDequeued > 0 ? this.totalWaitTimeMs / this.totalDequeued : 0,
    };
  }

  /**
   * 获取队列中等待的 runs 列表
   */
  getQueuedRuns(): Array<{ runId: string; pipelineId: string; priority: QueuePriority; position: number }> {
    return this.queue.map((item, index) => ({
      runId: item.runId,
      pipelineId: item.pipelineId,
      priority: item.priority,
      position: index + 1,
    }));
  }

  /**
   * 从队列中移除指定的 run（如被取消）
   */
  remove(runId: string): boolean {
    const index = this.queue.findIndex((item) => item.runId === runId);
    if (index === -1) return false;

    const removed = this.queue.splice(index, 1)[0];
    removed.reject(new Error('Pipeline run cancelled by user'));
    logger.info({ runId }, 'Pipeline run removed from queue');
    return true;
  }

  /**
   * 清空队列（用于紧急停止）
   */
  clear(): void {
    const count = this.queue.length;
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared by administrator'));
    }
    this.queue = [];
    logger.warn({ traceId: getCurrentTraceId(), clearedCount: count }, 'Pipeline execution queue cleared');
  }
}
