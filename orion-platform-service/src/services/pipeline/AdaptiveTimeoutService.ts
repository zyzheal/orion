/**
 * AdaptiveTimeoutService - 自适应超时服务 (Phase 2: Autonomous Pipeline)
 *
 * 负责：
 * - 基于历史执行数据计算建议超时时间
 * - 记录执行数据更新基线统计
 * - 提供基线统计查询
 *
 * 超时计算策略：
 * - 使用历史平均执行时间 + N 倍标准差
 * - 保证覆盖 P95+ 的正常执行时间
 * - 新 stage 使用默认超时值，逐步学习
 */

import { DatabasePool } from '../database';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'LAdaptive-LTimeout-LService' });

export interface TimeoutBaseline {
  stageName: string;
  executionCount: number;
  avgDurationMs: number;
  stdDevMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  suggestedTimeoutMs: number;
  lastUpdated: Date;
}

export interface ExecutionRecord {
  stageName: string;
  durationMs: number;
  success: boolean;
  timedOut?: boolean;
}

// 默认超时配置（用于没有历史数据的 stage）
const DEFAULT_TIMEOUT_MS = 3_600_000; // 1 hour
const STD_DEV_MULTIPLIER = 2.0; // 2 倍标准差
const MIN_EXECUTIONS_FOR_BASELINE = 3; // 至少需要 3 次执行才计算基线

export class AdaptiveTimeoutService {
  constructor(private pool: DatabasePool) {}

  /**
   * 获取 stage 的建议超时时间
   *
   * @param stageName - Stage 名称
   * @param pipelineId - 可选，Pipeline ID（用于更精确的匹配）
   * @returns 建议超时时间（毫秒）
   */
  async getTimeoutForStage(stageName: string, _pipelineId?: string): Promise<number> {
    try {
      const result = await this.pool.query(
        `SELECT suggested_timeout_ms, execution_count
         FROM pipeline_timeout_baselines
         WHERE stage_name = $1`,
        [stageName]
      );

      if (result.rows.length === 0) {
        return DEFAULT_TIMEOUT_MS;
      }

      const row = result.rows[0];
      const executionCount = parseInt(row.execution_count, 10);

      // 如果执行次数不足，返回默认值（但开始使用计算值作为参考）
      if (executionCount < MIN_EXECUTIONS_FOR_BASELINE) {
        return DEFAULT_TIMEOUT_MS;
      }

      return parseInt(row.suggested_timeout_ms, 10);
    } catch (err) {
      logger.warn('[AdaptiveTimeout] Failed to get timeout for stage:', err);
      return DEFAULT_TIMEOUT_MS;
    }
  }

  /**
   * 获取基线统计信息
   *
   * @param stageName - Stage 名称
   * @returns 基线统计，如果没有数据则返回 null
   */
  async getBaselineStats(stageName: string): Promise<TimeoutBaseline | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM pipeline_timeout_baselines WHERE stage_name = $1`,
        [stageName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const executionCount = parseInt(row.execution_count, 10);

      return {
        stageName: row.stage_name,
        executionCount,
        avgDurationMs: executionCount > 0 ? Math.round(parseInt(row.total_duration_ms, 10) / executionCount) : 0,
        stdDevMs: this.calculateStdDev(
          executionCount,
          parseInt(row.total_duration_ms, 10),
          parseInt(row.total_duration_sq, 10)
        ),
        minDurationMs: parseInt(row.min_duration_ms, 10),
        maxDurationMs: parseInt(row.max_duration_ms, 10),
        successCount: parseInt(row.success_count, 10),
        failureCount: parseInt(row.failure_count, 10),
        timeoutCount: parseInt(row.timeout_count, 10),
        suggestedTimeoutMs: parseInt(row.suggested_timeout_ms, 10),
        lastUpdated: new Date(row.last_updated),
      };
    } catch (err) {
      logger.error('[AdaptiveTimeout] Failed to get baseline stats:', err);
      return null;
    }
  }

  /**
   * 记录执行数据
   *
   * @param stageName - Stage 名称
   * @param durationMs - 执行时长（毫秒）
   * @param success - 是否成功
   * @param timedOut - 是否超时
   */
  async recordExecution(
    stageName: string,
    durationMs: number,
    success: boolean,
    timedOut = false
  ): Promise<void> {
    try {
      await this.pool.query('BEGIN');

      // 尝试获取现有基线
      const existing = await this.pool.query(
        `SELECT * FROM pipeline_timeout_baselines WHERE stage_name = $1`,
        [stageName]
      );

      if (existing.rows.length === 0) {
        // 创建新基线
        await this.pool.query(
          `INSERT INTO pipeline_timeout_baselines
           (stage_name, execution_count, total_duration_ms, total_duration_sq,
            min_duration_ms, max_duration_ms, success_count, failure_count, timeout_count,
            suggested_timeout_ms)
           VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            stageName,
            durationMs,
            durationMs * durationMs,
            durationMs,
            durationMs,
            success ? 1 : 0,
            success ? 0 : 1,
            timedOut ? 1 : 0,
            DEFAULT_TIMEOUT_MS,
          ]
        );
      } else {
        // 更新现有基线
        const row = existing.rows[0];
        const count = parseInt(row.execution_count, 10) + 1;
        const totalDuration = parseInt(row.total_duration_ms, 10) + durationMs;
        const totalDurationSq = parseInt(row.total_duration_sq, 10) + durationMs * durationMs;
        const minDuration = Math.min(parseInt(row.min_duration_ms, 10), durationMs);
        const maxDuration = Math.max(parseInt(row.max_duration_ms, 10), durationMs);
        const successCount = parseInt(row.success_count, 10) + (success ? 1 : 0);
        const failureCount = parseInt(row.failure_count, 10) + (success ? 0 : 1);
        const timeoutCount = parseInt(row.timeout_count, 10) + (timedOut ? 1 : 0);

        // 计算建议超时
        const suggestedTimeout = this.calculateSuggestedTimeout(count, totalDuration, totalDurationSq);

        await this.pool.query(
          `UPDATE pipeline_timeout_baselines
           SET execution_count = $1,
               total_duration_ms = $2,
               total_duration_sq = $3,
               min_duration_ms = $4,
               max_duration_ms = $5,
               success_count = $6,
               failure_count = $7,
               timeout_count = $8,
               suggested_timeout_ms = $9,
               last_updated = NOW()
           WHERE stage_name = $10`,
          [
            count,
            totalDuration,
            totalDurationSq,
            minDuration,
            maxDuration,
            successCount,
            failureCount,
            timeoutCount,
            suggestedTimeout,
            stageName,
          ]
        );
      }

      await this.pool.query('COMMIT');
    } catch (err) {
      if (this.pool) {
        await this.pool.query('ROLLBACK').catch(() => {});
      }
      logger.error('[AdaptiveTimeout] Failed to record execution:', err);
    }
  }

  /**
   * 批量记录执行数据（用于批量导入历史数据）
   */
  async recordExecutions(records: ExecutionRecord[]): Promise<void> {
    for (const record of records) {
      await this.recordExecution(record.stageName, record.durationMs, record.success, record.timedOut);
    }
  }

  /**
   * 获取所有基线统计
   */
  async getAllBaselines(): Promise<TimeoutBaseline[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM pipeline_timeout_baselines ORDER BY execution_count DESC`
      );

      return result.rows.map((row) => {
        const executionCount = parseInt(row.execution_count, 10);
        return {
          stageName: row.stage_name,
          executionCount,
          avgDurationMs: executionCount > 0 ? Math.round(parseInt(row.total_duration_ms, 10) / executionCount) : 0,
          stdDevMs: this.calculateStdDev(
            executionCount,
            parseInt(row.total_duration_ms, 10),
            parseInt(row.total_duration_sq, 10)
          ),
          minDurationMs: parseInt(row.min_duration_ms, 10),
          maxDurationMs: parseInt(row.max_duration_ms, 10),
          successCount: parseInt(row.success_count, 10),
          failureCount: parseInt(row.failure_count, 10),
          timeoutCount: parseInt(row.timeout_count, 10),
          suggestedTimeoutMs: parseInt(row.suggested_timeout_ms, 10),
          lastUpdated: new Date(row.last_updated),
        };
      });
    } catch (err) {
      logger.error('[AdaptiveTimeout] Failed to get all baselines:', err);
      return [];
    }
  }

  /**
   * 计算标准差
   */
  private calculateStdDev(
    count: number,
    totalSum: number,
    totalSumSq: number
  ): number {
    if (count < 2) return 0;

    const mean = totalSum / count;
    const variance = totalSumSq / count - mean * mean;
    return Math.sqrt(Math.max(0, variance));
  }

  /**
   * 计算建议超时时间
   * 使用 avg + N * stdDev 策略，确保覆盖大部分正常执行
   */
  private calculateSuggestedTimeout(
    count: number,
    totalDuration: number,
    totalDurationSq: number
  ): number {
    if (count < MIN_EXECUTIONS_FOR_BASELINE) {
      return DEFAULT_TIMEOUT_MS;
    }

    const mean = totalDuration / count;
    const stdDev = this.calculateStdDev(count, totalDuration, totalDurationSq);

    // avg + 2 * stdDev，但至少是 avg 的 1.5 倍，且不超过默认值
    const suggested = Math.round(mean + STD_DEV_MULTIPLIER * stdDev);
    const minimum = Math.round(mean * 1.5);

    return Math.min(Math.max(suggested, minimum), DEFAULT_TIMEOUT_MS);
  }
}
