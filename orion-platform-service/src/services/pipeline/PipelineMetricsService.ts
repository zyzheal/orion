/**
 * PipelineMetricsService - Pipeline 执行指标导出
 *
 * 负责：
 * - 跟踪总运行次数、成功率
 * - 按 Pipeline 统计平均持续时间
 * - 按错误类型统计失败次数
 * - 队列深度监控
 * - 可选导出 Prometheus 格式指标
 *
 * 持久化: PostgreSQL (migration 367) + 内存优雅降级
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { PipelineRun, PipelineRunStatus } from '../../models/PipelineRun';
import { PipelineExecutionQueue, QueueStats } from './PipelineExecutionQueue';
import { PipelineMetricsRepository } from '../../repositories/PipelineMetricsRepository';
import { DatabasePool } from '../database';

const logger = pino({ name: 'pipeline-metrics' });

/**
 * 单次运行的指标记录
 */
interface RunMetrics {
  runId: string;
  pipelineId: string;
  status: PipelineRunStatus;
  durationMs: number;
  errorType?: string;
  triggerType: string;
  completedAt: Date;
}

/**
 * 聚合指标
 */
export interface PipelineMetrics {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  pendingRuns: number;
  runningRuns: number;
  successRate: number;
  averageDurationMs: number;
  medianDurationMs: number;
  p95DurationMs: number;
  failuresByErrorType: Record<string, number>;
  runsByPipeline: Record<string, { total: number; success: number; avgDurationMs: number }>;
  runsByTriggerType: Record<string, number>;
  queueDepth: number;
  queueStats?: QueueStats;
  lastUpdated: string;
}

/**
 * Prometheus 格式的单条指标
 */
export interface PrometheusMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  labels?: Record<string, string>;
  value: number;
}

export class PipelineMetricsService extends EventEmitter {
  private runMetrics: RunMetrics[] = [];
  private dbPool: DatabasePool | null;
  private metricsRepo: PipelineMetricsRepository | null;
  private dbReady: boolean;
  private executionQueue: PipelineExecutionQueue | null;
  private maxHistorySize: number;
  private maxAgeMs: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options?: {
    executionQueue?: PipelineExecutionQueue;
    maxHistorySize?: number;
    maxAgeHours?: number;
    dbPool?: DatabasePool;
  }) {
    super();
    this.dbPool = options?.dbPool || null;
    this.metricsRepo = options?.dbPool ? new PipelineMetricsRepository(options.dbPool) : null;
    this.dbReady = false;
    this.executionQueue = options?.executionQueue || null;
    this.maxHistorySize = options?.maxHistorySize || 10000;
    this.maxAgeMs = (options?.maxAgeHours ?? 24) * 60 * 60 * 1000; // Default: 24 hours

    // 探测 DB 连接
    if (this.dbPool) {
      this._probeDb().catch(() => {
        logger.warn('pipeline_metrics table not available, falling back to memory-only mode');
      });
    }

    this.startCleanupInterval();
  }

  /**
   * 探测数据库表是否可用
   */
  private async _probeDb(): Promise<void> {
    try {
      await this.dbPool!.query('SELECT 1 FROM pipeline_metrics LIMIT 1');
      this.dbReady = true;
    } catch {
      this.dbReady = false;
    }
  }

  /**
   * 记录一次 Pipeline 运行完成
   */
  recordRun(run: PipelineRun): void {
    const metrics: RunMetrics = {
      runId: run.id,
      pipelineId: run.pipelineId,
      status: run.status,
      durationMs: run.durationMs || 0,
      triggerType: run.triggerType,
      completedAt: run.completedAt || new Date(),
    };

    if (run.status === PipelineRunStatus.FAILED && run.context?.error) {
      metrics.errorType = this.classifyError(String(run.context.error));
    }

    // 写内存（始终保留，用于降级和快速读取）
    this.runMetrics.push(metrics);

    // 限制历史记录大小
    if (this.runMetrics.length > this.maxHistorySize) {
      this.runMetrics = this.runMetrics.slice(-this.maxHistorySize);
    }

    // 写 DB（失败则静默忽略，优雅降级到内存）
    this._persistToDb(metrics).catch(err => {
      if (!this.dbReady) {
        this.dbReady = false;
        logger.debug({ error: err.message }, 'DB write failed, using memory-only');
      }
    });

    logger.debug(
      { runId: run.id, status: run.status, durationMs: run.durationMs },
      'Recorded pipeline run metrics'
    );
  }

  /**
   * 持久化单条指标到 DB（通过 Repository）
   */
  private async _persistToDb(metrics: RunMetrics): Promise<void> {
    if (!this.metricsRepo || !this.dbReady) return;

    await this.metricsRepo.insert({
      runId: metrics.runId,
      pipelineId: metrics.pipelineId,
      status: metrics.status,
      durationMs: metrics.durationMs,
      triggerType: metrics.triggerType,
      errorType: metrics.errorType,
    });
  }

  /**
   * 获取聚合指标（同步，从内存计算 — 保证向后兼容）
   */
  getMetrics(): PipelineMetrics {
    return this._getMetricsFromMemory();
  }

  /**
   * 获取聚合指标（异步，优先从 DB 读取）
   */
  async getMetricsAsync(): Promise<PipelineMetrics> {
    if (this.dbReady) {
      try {
        return await this._aggregateFromDb();
      } catch (err) {
        this.dbReady = false;
        logger.debug({ error: (err as Error).message }, 'DB aggregate failed, falling back to memory');
        return this._getMetricsFromMemory();
      }
    }
    return this._getMetricsFromMemory();
  }

  /**
   * 从 DB 聚合指标（通过 Repository）
   */
  private async _aggregateFromDb(): Promise<PipelineMetrics> {
    if (!this.metricsRepo) {
      return this._getMetricsFromMemory();
    }

    const [overview, percentiles, failuresByErrorType, aggregatesByPipeline, countsByTriggerType] =
      await Promise.all([
        this.metricsRepo.getOverview(),
        this.metricsRepo.getPercentiles(),
        this.metricsRepo.getFailuresByErrorType(),
        this.metricsRepo.getAggregatesByPipeline(),
        this.metricsRepo.getCountsByTriggerType(),
      ]);

    const failuresMap: Record<string, number> = {};
    for (const item of failuresByErrorType) {
      failuresMap[item.errorType] = item.count;
    }

    const pipelineMap: Record<string, { total: number; success: number; avgDurationMs: number }> = {};
    for (const item of aggregatesByPipeline) {
      pipelineMap[item.pipelineId] = {
        total: item.total,
        success: item.success,
        avgDurationMs: item.avgDurationMs,
      };
    }

    const triggerMap: Record<string, number> = {};
    for (const item of countsByTriggerType) {
      triggerMap[item.triggerType] = item.count;
    }

    const queueDepth = this.executionQueue?.getDepth() || 0;

    return {
      totalRuns: overview.totalRuns,
      successRuns: overview.successRuns,
      failedRuns: overview.failedRuns,
      cancelledRuns: overview.cancelledRuns,
      pendingRuns: 0,
      runningRuns: 0,
      successRate: overview.totalRuns > 0 ? overview.successRuns / overview.totalRuns : 0,
      averageDurationMs: overview.avgDurationMs,
      medianDurationMs: percentiles.medianDurationMs,
      p95DurationMs: percentiles.p95DurationMs,
      failuresByErrorType: failuresMap,
      runsByPipeline: pipelineMap,
      runsByTriggerType: triggerMap,
      queueDepth,
      queueStats: this.executionQueue?.getStats(),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 从内存计算聚合指标（原始逻辑，用于降级场景）
   */
  private _getMetricsFromMemory(): PipelineMetrics {
    const totalRuns = this.runMetrics.length;
    const successRuns = this.runMetrics.filter(r => r.status === PipelineRunStatus.SUCCESS).length;
    const failedRuns = this.runMetrics.filter(r => r.status === PipelineRunStatus.FAILED).length;
    const cancelledRuns = this.runMetrics.filter(r => r.status === PipelineRunStatus.CANCELLED).length;

    const durations = this.runMetrics
      .filter(r => r.durationMs > 0)
      .map(r => r.durationMs)
      .sort((a, b) => a - b);

    const averageDurationMs = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    const medianDurationMs = durations.length > 0
      ? durations[Math.floor(durations.length / 2)]
      : 0;

    const p95Index = durations.length > 0 ? Math.floor(durations.length * 0.95) : 0;
    const p95DurationMs = durations.length > 0 ? durations[Math.min(p95Index, durations.length - 1)] : 0;

    // 按错误类型统计
    const failuresByErrorType: Record<string, number> = {};
    for (const run of this.runMetrics) {
      if (run.status === PipelineRunStatus.FAILED && run.errorType) {
        failuresByErrorType[run.errorType] = (failuresByErrorType[run.errorType] || 0) + 1;
      }
    }

    // 按 Pipeline 统计
    const runsByPipeline: Record<string, { total: number; success: number; avgDurationMs: number }> = {};
    const pipelineRuns = new Map<string, RunMetrics[]>();
    for (const run of this.runMetrics) {
      if (!pipelineRuns.has(run.pipelineId)) {
        pipelineRuns.set(run.pipelineId, []);
      }
      pipelineRuns.get(run.pipelineId)!.push(run);
    }
    for (const [pipelineId, runs] of pipelineRuns) {
      const totalDurations = runs.filter(r => r.durationMs > 0).reduce((sum, r) => sum + r.durationMs, 0);
      runsByPipeline[pipelineId] = {
        total: runs.length,
        success: runs.filter(r => r.status === PipelineRunStatus.SUCCESS).length,
        avgDurationMs: runs.length > 0 ? totalDurations / runs.length : 0,
      };
    }

    // 按触发类型统计
    const runsByTriggerType: Record<string, number> = {};
    for (const run of this.runMetrics) {
      runsByTriggerType[run.triggerType] = (runsByTriggerType[run.triggerType] || 0) + 1;
    }

    // 队列深度
    const queueDepth = this.executionQueue?.getDepth() || 0;

    return {
      totalRuns,
      successRuns,
      failedRuns,
      cancelledRuns,
      pendingRuns: 0,
      runningRuns: 0,
      successRate: totalRuns > 0 ? successRuns / totalRuns : 0,
      averageDurationMs,
      medianDurationMs,
      p95DurationMs,
      failuresByErrorType,
      runsByPipeline,
      runsByTriggerType,
      queueDepth,
      queueStats: this.executionQueue?.getStats(),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Duration histogram bucket boundaries (in seconds).
   * Prometheus convention: cumulative buckets where each bucket counts
   * observations <= the upper bound.
   */
  private static readonly DURATION_BUCKETS = [10, 30, 60, 300, 900, 1800, 3600]; // 10s, 30s, 1m, 5m, 15m, 30m, 1h

  /**
   * 获取 Prometheus 格式指标
   */
  getPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    // 辅助函数
    const counter = (name: string, help: string, value: number, labels?: Record<string, string>) => {
      let line = `# HELP ${name} ${help}\n# TYPE ${name} counter\n`;
      if (labels) {
        const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
        line += `${name}{${labelStr}} ${value}\n`;
      } else {
        line += `${name} ${value}\n`;
      }
      lines.push(line);
    };

    const gauge = (name: string, help: string, value: number, labels?: Record<string, string>) => {
      let line = `# HELP ${name} ${help}\n# TYPE ${name} gauge\n`;
      if (labels) {
        const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
        line += `${name}{${labelStr}} ${value}\n`;
      } else {
        line += `${name} ${value}\n`;
      }
      lines.push(line);
    };

    // 总体指标
    counter('pipeline_runs_total', 'Total number of pipeline runs', metrics.totalRuns);
    counter('pipeline_runs_success_total', 'Total number of successful pipeline runs', metrics.successRuns);
    counter('pipeline_runs_failed_total', 'Total number of failed pipeline runs', metrics.failedRuns);
    counter('pipeline_runs_cancelled_total', 'Total number of cancelled pipeline runs', metrics.cancelledRuns);
    gauge('pipeline_success_rate', 'Success rate of pipeline runs (0-1)', metrics.successRate);

    // 持续时间指标 (保留毫秒 gauge 以便向后兼容)
    gauge('pipeline_duration_avg_ms', 'Average pipeline run duration in milliseconds', metrics.averageDurationMs);
    gauge('pipeline_duration_median_ms', 'Median pipeline run duration in milliseconds', metrics.medianDurationMs);
    gauge('pipeline_duration_p95_ms', 'P95 pipeline run duration in milliseconds', metrics.p95DurationMs);

    // 持续时间直方图 (Prometheus 标准秒单位)
    this.appendDurationHistogram(lines);

    // 队列深度
    gauge('pipeline_queue_depth', 'Number of pipeline runs waiting in the queue', metrics.queueDepth);

    // 按 Pipeline 统计
    for (const [pipelineId, stats] of Object.entries(metrics.runsByPipeline)) {
      counter('pipeline_runs_by_pipeline_total', 'Total runs by pipeline', stats.total, { pipeline_id: pipelineId });
      counter('pipeline_runs_by_pipeline_success', 'Successful runs by pipeline', stats.success, { pipeline_id: pipelineId });
      gauge('pipeline_runs_by_pipeline_avg_duration_ms', 'Average duration by pipeline', stats.avgDurationMs, { pipeline_id: pipelineId });
    }

    // 按触发类型统计
    for (const [triggerType, count] of Object.entries(metrics.runsByTriggerType)) {
      counter('pipeline_runs_by_trigger_type', 'Runs by trigger type', count, { trigger_type: triggerType });
    }

    // 按错误类型统计
    for (const [errorType, count] of Object.entries(metrics.failuresByErrorType)) {
      counter('pipeline_failures_by_error_type', 'Failures by error type', count, { error_type: errorType });
    }

    return lines.join('');
  }

  /**
   * 构建持续时间直方图的 Prometheus 输出。
   * 使用累积桶：每个桶包含 <= 上界的观察数。
   */
  private appendDurationHistogram(lines: string[]): void {
    // 计算每个桶的累积计数
    const buckets = PipelineMetricsService.DURATION_BUCKETS.map(upperBoundSec => {
      const upperBoundMs = upperBoundSec * 1000;
      const count = this.runMetrics.filter(r => r.durationMs > 0 && r.durationMs <= upperBoundMs).length;
      return { le: String(upperBoundSec), count };
    });

    // 所有运行的总数（durationMs > 0）
    const totalWithDuration = this.runMetrics.filter(r => r.durationMs > 0).length;
    const sumSeconds = this.runMetrics.reduce((sum, r) => sum + (r.durationMs > 0 ? r.durationMs / 1000 : 0), 0);

    lines.push('# HELP pipeline_run_duration_seconds Pipeline run duration in seconds');
    lines.push('# TYPE pipeline_run_duration_seconds histogram');

    for (const bucket of buckets) {
      lines.push(`pipeline_run_duration_seconds_bucket{le="${bucket.le}"} ${bucket.count}`);
    }
    // +Inf bucket: all observations
    lines.push(`pipeline_run_duration_seconds_bucket{le="+Inf"} ${totalWithDuration}`);
    lines.push(`pipeline_run_duration_seconds_sum ${sumSeconds}`);
    lines.push(`pipeline_run_duration_seconds_count ${totalWithDuration}`);
  }

  /**
   * 获取最近 N 次运行的指标
   */
  getRecentRuns(limit = 50): RunMetrics[] {
    return this.runMetrics.slice(-limit);
  }

  /**
   * 从 DB 获取最近 N 次运行记录（通过 Repository）
   */
  async getRecentRunsAsync(limit = 50): Promise<RunMetrics[]> {
    if (!this.metricsRepo) {
      return this.runMetrics.slice(-limit);
    }
    try {
      const rows = await this.metricsRepo.getRecentRuns(limit);
      return rows.map(r => ({
        runId: r.runId,
        pipelineId: r.pipelineId,
        status: r.status as PipelineRunStatus,
        durationMs: r.durationMs,
        errorType: r.errorType || undefined,
        triggerType: r.triggerType,
        completedAt: r.completedAt,
      }));
    } catch (err) {
      logger.debug({ error: (err as Error).message }, 'DB getRecentRuns failed, using memory');
      return this.runMetrics.slice(-limit);
    }
  }

  /**
   * 按 Pipeline ID 获取指标
   */
  getMetricsByPipeline(pipelineId: string): {
    total: number;
    success: number;
    failed: number;
    successRate: number;
    avgDurationMs: number;
    recentRuns: RunMetrics[];
  } {
    return this._getMetricsByPipelineFromMemory(pipelineId);
  }

  /**
   * 按 Pipeline ID 获取指标（异步，从 DB 读取）
   */
  async getMetricsByPipelineAsync(pipelineId: string): Promise<{
    total: number;
    success: number;
    failed: number;
    successRate: number;
    avgDurationMs: number;
    recentRuns: RunMetrics[];
  }> {
    if (this.dbReady) {
      try {
        return await this._metricsByPipelineFromDb(pipelineId);
      } catch (err) {
        this.dbReady = false;
        logger.debug({ error: (err as Error).message }, 'DB getMetricsByPipeline failed, falling back to memory');
        return this._getMetricsByPipelineFromMemory(pipelineId);
      }
    }
    return this._getMetricsByPipelineFromMemory(pipelineId);
  }

  /**
   * 从 DB 按 Pipeline 获取指标（通过 Repository）
   */
  private async _metricsByPipelineFromDb(pipelineId: string): Promise<{
    total: number;
    success: number;
    failed: number;
    successRate: number;
    avgDurationMs: number;
    recentRuns: RunMetrics[];
  }> {
    if (!this.metricsRepo) {
      return this._getMetricsByPipelineFromMemory(pipelineId);
    }

    const data = await this.metricsRepo.getAggregateByPipelineId(pipelineId);

    return {
      total: data.total,
      success: data.success,
      failed: data.failed,
      successRate: data.total > 0 ? data.success / data.total : 0,
      avgDurationMs: data.avgDurationMs,
      recentRuns: data.recentRuns.map(r => ({
        runId: r.runId,
        pipelineId: r.pipelineId,
        status: r.status as PipelineRunStatus,
        durationMs: r.durationMs,
        errorType: r.errorType || undefined,
        triggerType: r.triggerType,
        completedAt: r.completedAt,
      })),
    };
  }

  /**
   * 从内存按 Pipeline 获取指标（原始逻辑）
   */
  private _getMetricsByPipelineFromMemory(pipelineId: string): {
    total: number;
    success: number;
    failed: number;
    successRate: number;
    avgDurationMs: number;
    recentRuns: RunMetrics[];
  } {
    const runs = this.runMetrics.filter(r => r.pipelineId === pipelineId);
    const success = runs.filter(r => r.status === PipelineRunStatus.SUCCESS).length;
    const failed = runs.filter(r => r.status === PipelineRunStatus.FAILED).length;
    const durations = runs.filter(r => r.durationMs > 0).map(r => r.durationMs);

    return {
      total: runs.length,
      success,
      failed,
      successRate: runs.length > 0 ? success / runs.length : 0,
      avgDurationMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      recentRuns: runs.slice(-20),
    };
  }

  /**
   * 清空历史指标（用于测试）
   */
  async clear(): Promise<void> {
    // 清空内存
    this.runMetrics = [];

    // 清空 DB
    if (this.metricsRepo && this.dbReady) {
      try {
        await this.metricsRepo.deleteAll();
      } catch (err) {
        logger.debug({ error: (err as Error).message }, 'Failed to clear pipeline_metrics from DB');
      }
    }
  }

  /**
   * 关闭指标服务（清理定时器）
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * 清理过期的指标记录
   */
  private cleanupExpiredMetrics(): void {
    const now = Date.now();
    const before = this.runMetrics.length;
    this.runMetrics = this.runMetrics.filter(m =>
      now - m.completedAt.getTime() <= this.maxAgeMs
    );
    const removed = before - this.runMetrics.length;
    if (removed > 0) {
      logger.debug({ removed, remaining: this.runMetrics.length }, 'Cleaned up expired metrics');
    }

    // 同时清理 DB 中的过期数据
    if (this.metricsRepo && this.dbReady) {
      const cutoff = new Date(now - this.maxAgeMs);
      this.metricsRepo.deleteOlderThan(cutoff).catch(err => {
        logger.debug({ error: err.message }, 'Failed to clean up expired metrics from DB');
      });
    }
  }

  /**
   * 启动定期清理
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredMetrics();
    }, 15 * 60 * 1000); // Every 15 minutes
    this.cleanupInterval.unref();
  }

  /**
   * 将错误消息分类为错误类型
   */
  private classifyError(errorMessage: string): string {
    const lower = errorMessage.toLowerCase();
    if (lower.includes('timeout') || lower.includes('timed out')) return 'timeout';
    if (lower.includes('permission') || lower.includes('unauthorized') || lower.includes('forbidden')) return 'permission';
    if (lower.includes('not found') || lower.includes('missing')) return 'not_found';
    if (lower.includes('network') || lower.includes('connection') || lower.includes('econn')) return 'network';
    if (lower.includes('syntax') || lower.includes('compilation')) return 'compilation';
    if (lower.includes('cancelled')) return 'cancelled';
    return 'unknown';
  }
}
