/**
 * PipelineExecutionQueue - 全局执行队列与背压控制
 *
 * 负责：
 * - 基于优先级的队列管理 (HIGH, NORMAL, LOW)
 * - 最大并发数限制 (MAX_CONCURRENT_PIPELINES)
 * - 背压：队列满时拒绝新请求
 * - 完成后自动出队并触发下一个
 * - PostgreSQL 持久化（崩溃恢复、状态查询）
 *
 * PostgreSQL 表 (migration 369):
 *   pipeline_execution_queues (id PK, tenant_id, pipeline_id, run_id, status, priority,
 *   queued_at, started_at, completed_at, error_message, metadata JSONB)
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import { getCurrentTraceId } from '../../db/tenant-context-storage';
import { DatabasePool, QueryResult } from '../../services/database';

const logger = pino({ name: 'pipeline-execution-queue' });

// ==================== Type Definitions ====================

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

export interface DbQueueEntry {
  id: string;
  tenant_id: string;
  pipeline_id: string | null;
  run_id: string;
  status: string;
  priority: number;
  queued_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

/**
 * 优先级权重：用于排序，数字越小优先级越高
 */
const PRIORITY_WEIGHT: Record<QueuePriority, number> = {
  HIGH: 0,
  NORMAL: 1,
  LOW: 2,
};

/** PostgreSQL 表名 */
const TABLE_NAME = 'pipeline_execution_queues';

// ==================== PipelineExecutionQueue Class ====================

export class PipelineExecutionQueue extends EventEmitter {
  private config: PipelineExecutionQueueConfig;
  private queue: QueuedPipelineRun[] = [];
  private runningCount = 0;

  // 统计
  private totalEnqueued = 0;
  private totalDequeued = 0;
  private totalRejected = 0;
  private totalWaitTimeMs = 0;

  // Database layer
  private dbPool: DatabasePool | null = null;
  private dbEnabled = false;
  private dbErrorCount = 0;
  private readonly MAX_DB_ERRORS = 10;

  constructor(config?: Partial<PipelineExecutionQueueConfig>, dbPool?: DatabasePool) {
    super();
    this.config = {
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT_PIPELINES || '10', 10),
      maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || '100', 10),
      ...config,
    };
    this.dbPool = dbPool ?? null;
    logger.info({ config: this.config, dbAvailable: !!this.dbPool }, 'Pipeline execution queue initialized');
  }

  // ==================== Database Methods ====================

  /**
   * Initialize DB connectivity. Call once at startup if pool provided.
   */
  async initializeDatabase(): Promise<void> {
    if (!this.dbPool) {
      logger.debug('No database pool provided, running in pure in-memory mode');
      return;
    }

    try {
      await this.dbPool.query('SELECT 1');
      this.dbEnabled = true;
      logger.info('Pipeline execution queue database connection established');
    } catch (error) {
      this.dbEnabled = false;
      logger.warn(
        { error: error instanceof Error ? error.message : 'unknown' },
        'Database initialization failed, falling back to in-memory mode'
      );
    }
  }

  /**
   * Persist a queued run to PostgreSQL (append-only for crash recovery).
   */
  private async dbPersistEnqueue(
    runId: string,
    pipelineId: string | undefined,
    priorityWeight: number,
    queuedAt: Date,
    priorityLabel: string,
  ): Promise<void> {
    if (!this.dbEnabled) return;

    try {
      await this.dbPool!.query(
        `INSERT INTO ${TABLE_NAME} (tenant_id, pipeline_id, run_id, status, priority, queued_at, metadata)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6)`,
        [
          this.getTenantId(),
          pipelineId || null,
          runId,
          priorityWeight,
          queuedAt,
          JSON.stringify({ pipeline_id: pipelineId, priority: priorityLabel }),
        ]
      );
    } catch (error) {
      this.handleDbError('dbPersistEnqueue', error);
    }
  }

  /**
   * Non-async variant of dbPersistEnqueue for use when DB is disabled.
   * Avoids the microtask yield that `await` on an `async` function would cause.
   */
  private dbPersistEnqueueSync(
    runId: string,
    pipelineId: string | undefined,
    priorityWeight: number,
    queuedAt: Date,
    priorityLabel: string,
  ): void {
    // When dbEnabled is false, there's nothing to persist.
    // When dbEnabled is true but pool is unavailable, silently skip.
  }

  /**
   * Transition an entry to "running" in the database.
   */
  private async dbMarkRunning(runId: string): Promise<void> {
    if (!this.dbEnabled) return;

    try {
      await this.dbPool!.query(
        `UPDATE ${TABLE_NAME} SET status = 'running', started_at = now() WHERE run_id = $1`,
        [runId]
      );
    } catch (error) {
      this.handleDbError('dbMarkRunning', error);
    }
  }

  /**
   * Mark an entry as completed/failed in the database.
   */
  private async dbMarkDone(runId: string, isError: boolean, errorMessage?: string): Promise<void> {
    if (!this.dbEnabled) return;

    try {
      const statusValue = isError ? 'failed' : 'completed';
      if (errorMessage) {
        await this.dbPool!.query(
          `UPDATE ${TABLE_NAME} SET status = $1, completed_at = now(), error_message = $2 WHERE run_id = $3`,
          [statusValue, errorMessage, runId]
        );
      } else {
        await this.dbPool!.query(
          `UPDATE ${TABLE_NAME} SET status = $1, completed_at = now() WHERE run_id = $2`,
          [statusValue, runId]
        );
      }
    } catch (error) {
      this.handleDbError('dbMarkDone', error);
    }
  }

  /**
   * Remove a completed/failed entry from the database.
   */
  private async dbRemoveCompleted(runId: string): Promise<void> {
    if (!this.dbEnabled) return;

    try {
      await this.dbPool!.query(`DELETE FROM ${TABLE_NAME} WHERE run_id = $1`, [runId]);
    } catch (error) {
      this.handleDbError('dbRemoveCompleted', error);
    }
  }

  /**
   * Remove a pending entry from DB (used by remove/cancel).
   */
  private async dbRemovePending(runId: string): Promise<void> {
    if (!this.dbEnabled) return;

    try {
      await this.dbPool!.query(
        `DELETE FROM ${TABLE_NAME} WHERE run_id = $1 AND status = 'pending'`,
        [runId]
      );
    } catch (error) {
      this.handleDbError('dbRemovePending', error);
    }
  }

  /**
   * Load pending entries from PostgreSQL for crash recovery.
   * Re-enqueues them into the in-memory queue.
   */
  async recoverFromDatabase(): Promise<void> {
    if (!this.dbEnabled) return;

    try {
      const result: QueryResult = await this.dbPool!.query(
        `SELECT * FROM ${TABLE_NAME} WHERE status = 'pending'
         ORDER BY priority ASC, queued_at ASC`
      );

      for (const row of result.rows) {
        const entry = this.mapRowToDbEntry(row);
        const priorityLabel = entry.metadata?.priority as QueuePriority || 'NORMAL';

        logger.info(
          { runId: entry.run_id, priority: priorityLabel, queuedAt: entry.queued_at },
          'Recovered queued entry from database'
        );

        // Note: recovered entries have no executeFn - they serve as a log
        const recoveredRun: QueuedPipelineRun = {
          runId: entry.run_id,
          pipelineId: entry.pipeline_id ?? '',
          priority: priorityLabel,
          enqueueTime: entry.queued_at.getTime(),
          executeFn: async () => {
            logger.warn(
              { runId: entry.run_id },
              'Recovered pipeline run has no executeFn, marking as completed'
            );
          },
          resolve: () => {},
          reject: () => {},
        };

        this.queue.push(recoveredRun);
        this.totalEnqueued++;
      }

      // Sort recovered entries by priority
      this.queue.sort((a, b) => {
        const pd = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
        if (pd !== 0) return pd;
        return a.enqueueTime - b.enqueueTime;
      });

      logger.info({ recoveredCount: result.rows.length }, 'Database recovery complete');
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : 'unknown' },
        'Database recovery failed'
      );
    }
  }

  /**
   * Handle database errors with circuit-breaker pattern.
   * After MAX_DB_ERRORS consecutive failures, disable DB persistence.
   */
  private handleDbError(operation: string, error: unknown): void {
    this.dbErrorCount++;
    if (this.dbErrorCount >= this.MAX_DB_ERRORS) {
      this.dbEnabled = false;
      logger.warn(
        { operation, errorCount: this.dbErrorCount },
        'Database error threshold reached, disabling DB persistence for queue'
      );
    } else {
      logger.debug(
        { operation, errorCount: this.dbErrorCount, maxErrors: this.MAX_DB_ERRORS },
        'Database operation failed, falling back to in-memory'
      );
    }
  }

  /**
   * Map DB row to DbQueueEntry.
   */
  private mapRowToDbEntry(row: any): DbQueueEntry {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      pipeline_id: row.pipeline_id,
      run_id: row.run_id,
      status: row.status,
      priority: row.priority,
      queued_at: row.queued_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      error_message: row.error_message,
      metadata: row.metadata || {},
    };
  }

  /**
   * Resolve tenant_id from current context or default to wildcard.
   */
  private getTenantId(): string {
    try {
      const traceCtx = getCurrentTraceId();
      if (traceCtx) return traceCtx;
    } catch {
      // ignore
    }
    return '00000000-0000-0000-0000-000000000000';
  }

  // ==================== Public API ====================

  /**
   * 将 PipelineRun 加入队列
   * @returns Promise，当该 run 被执行完成后 resolve
   */
  async enqueue(run: Omit<QueuedPipelineRun, 'enqueueTime'>): Promise<void> {
    const priorityWeight = PRIORITY_WEIGHT[run.priority];
    const queuedAt = new Date();

    // 持久化到数据库（崩溃恢复用）- use sync call when DB disabled to avoid async yield
    this.dbEnabled
      ? await this.dbPersistEnqueue(run.runId, run.pipelineId, priorityWeight, queuedAt, run.priority)
      : this.dbPersistEnqueueSync(run.runId, run.pipelineId, priorityWeight, queuedAt, run.priority);

    // 背压检查：队列已满
    if (this.queue.length >= this.config.maxQueueSize) {
      this.totalRejected++;
      logger.warn(
        { runId: run.runId, queueDepth: this.queue.length },
        'Queue full, rejecting new pipeline run'
      );
      throw new Error(
        `Pipeline execution queue is full (max: ${this.config.maxQueueSize}). Try again later.`
      );
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

      // 标记 DB 中为 running
      this.dbMarkRunning(next.runId).catch(() => { /* ignore */ });

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

      // 持久化完成状态
      this.dbMarkDone(queued.runId, false).catch(() => { /* ignore */ });
      this.dbRemoveCompleted(queued.runId).catch(() => { /* ignore */ });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      queued.reject(error);
      this.emit('failed', { runId: queued.runId, error });

      // 持久化失败状态
      this.dbMarkDone(queued.runId, true, errorMessage).catch(() => { /* ignore */ });
      this.dbRemoveCompleted(queued.runId).catch(() => { /* ignore */ });
    } finally {
      this.runningCount--;
      logger.info(
        { runId: queued.runId, runningCount: this.runningCount },
        'Pipeline run finished, checking queue'
      );
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
    if (index === -1) {
      // 如果内存中没有，尝试从 DB 中移除
      this.dbRemovePending(runId).catch(() => { /* ignore */ });
      return false;
    }

    const removed = this.queue.splice(index, 1)[0];
    removed.reject(new Error('Pipeline run cancelled by user'));

    // 同时从 DB 中移除
    this.dbRemovePending(runId).catch(() => { /* ignore */ });

    logger.info({ runId }, 'Pipeline run removed from queue');
    return true;
  }

  /**
   * 清空队列（用于紧急停止）
   */
  async clear(): Promise<void> {
    const count = this.queue.length;

    for (const item of this.queue) {
      item.reject(new Error('Queue cleared by administrator'));
    }
    this.queue = [];

    logger.warn({ traceId: getCurrentTraceId(), clearedCount: count }, 'Pipeline execution queue cleared');

    // 清空 DB 中的排队条目
    if (this.dbEnabled) {
      try {
        await this.dbPool!.query(
          `DELETE FROM ${TABLE_NAME} WHERE status = 'pending'`
        );
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : 'unknown' },
          'Failed to clear DB queue entries'
        );
      }
    }
  }

  /**
   * 获取 DB 连接状态，供外部检查
   */
  isDatabaseEnabled(): boolean {
    return this.dbEnabled;
  }
}

// ==================== Factory Function ====================

/**
 * 创建 Pipeline 执行队列实例
 *
 * @param config 队列配置
 * @param dbPool PostgreSQL 连接池（可选，不提供则纯内存模式）
 */
export function createPipelineExecutionQueue(
  config?: Partial<PipelineExecutionQueueConfig>,
  dbPool?: DatabasePool,
): PipelineExecutionQueue {
  const queue = new PipelineExecutionQueue(config, dbPool);
  // 异步初始化 DB（不阻塞构造函数）
  queue.initializeDatabase().catch((err) => {
    logger.error(
      { error: err instanceof Error ? err.message : 'unknown' },
      'Failed to initialize queue database'
    );
  });
  return queue;
}

export default PipelineExecutionQueue;
