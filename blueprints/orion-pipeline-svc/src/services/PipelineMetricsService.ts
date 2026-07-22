/**
 * PipelineMetricsService - Pipeline 执行指标导出
 *
 * 负责：
 * - 跟踪总运行次数、成功率
 * - 按 Pipeline 统计平均持续时间
 * - 按错误类型统计失败次数
 * - 队列深度监控
 * - 可选导出 Prometheus 格式指标
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import { PipelineRun, PipelineRunStatus } from '../models/PipelineRun';
import { PipelineExecutionQueue, QueueStats } from './PipelineExecutionQueue';

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
  private executionQueue: PipelineExecutionQueue | null;
  private maxHistorySize: number;
  private maxAgeMs: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options?: {
    executionQueue?: PipelineExecutionQueue;
    maxHistorySize?: number;
    maxAgeHours?: number;
  }) {
    super();
    this.executionQueue = options?.executionQueue || null;
    this.maxHistorySize = options?.maxHistorySize || 10000;
    this.maxAgeMs = (options?.maxAgeHours ?? 24) * 60 * 60 * 1000; // Default: 24 hours
    this.startCleanupInterval();
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
      completedAt: run.completedAt ? new Date(run.completedAt) : new Date(),
    };

    if (run.status === PipelineRunStatus.FAILED && run.context?.error) {
      metrics.errorType = this.classifyError(String(run.context.error));
    }

    this.runMetrics.push(metrics);

    // 限制历史记录大小
    if (this.runMetrics.length > this.maxHistorySize) {
      this.runMetrics = this.runMetrics.slice(-this.maxHistorySize);
    }

    logger.debug(
      { runId: run.id, status: run.status, durationMs: run.durationMs },
      'Recorded pipeline run metrics'
    );
  }

  /**
   * 获取聚合指标
   */
  getMetrics(): PipelineMetrics {
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
      pendingRuns: 0, // Not tracked in metrics history
      runningRuns: 0, // Not tracked in metrics history
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
  clear(): void {
    this.runMetrics = [];
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
