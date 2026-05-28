/**
 * AutoRetryService - 自动重试服务 (Phase 2: Autonomous Pipeline)
 *
 * 负责：
 * - 判断是否应该重试（基于错误分类和重试策略）
 * - 执行带自动重试的 Stage
 * - 记录重试历史并提供统计
 *
 * 重试策略：
 * - immediate: 立即重试（适用于瞬时资源竞争）
 * - backoff: 指数退避重试（适用于网络、超时等临时错误）
 * - skip: 不重试（适用于永久错误、配置错误）
 */

import { ErrorClassifier, ErrorClassification, StageContext } from './ErrorClassifier';
import { DatabasePool } from '../database';
import pino from 'pino';

const logger = pino({ name: 'LAuto-LRetry-LService' });

export interface RetryConfig {
  maxRetries: number;
  strategy: 'immediate' | 'backoff' | 'skip';
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

export interface RetryStats {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  successRate: number;
  averageRetriesPerPipeline: number;
  byStrategy: Record<string, number>;
  byErrorType: Record<string, number>;
}

export interface RetryRecord {
  pipelineId?: string;
  runId: string;
  stageName: string;
  retryAttempt: number;
  errorType?: string;
  errorMessage?: string;
  retryStrategy?: string;
  delayMs?: number;
  success: boolean;
  durationMs?: number;
}

// 默认重试配置
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  strategy: 'backoff',
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  jitter: true,
};

export interface StageResult {
  success: boolean;
  error?: string;
  retryCount: number;
  durationMs: number;
}

export class AutoRetryService {
  private dbPool: DatabasePool | null;
  private errorClassifier: ErrorClassifier;

  constructor(dbPool: DatabasePool | null, errorClassifier: ErrorClassifier) {
    this.dbPool = dbPool;
    this.errorClassifier = errorClassifier;
  }

  /**
   * 判断是否应该重试
   *
   * @param error - 错误对象或消息
   * @param retryCount - 当前重试次数
   * @param stageContext - Stage 上下文
   * @returns 是否应该重试及重试策略
   */
  async shouldRetry(
    error: Error | string,
    retryCount: number,
    stageContext: StageContext
  ): Promise<{ shouldRetry: boolean; strategy: 'immediate' | 'backoff' | 'skip'; classification: ErrorClassification }> {
    const classification = await this.errorClassifier.classifyError(error, stageContext);

    return {
      shouldRetry: classification.shouldRetry && retryCount < stageContext.maxRetries,
      strategy: classification.retryStrategy,
      classification,
    };
  }

  /**
   * 执行带自动重试的 Stage
   *
   * @param stageFn - Stage 执行函数
   * @param maxRetries - 最大重试次数（默认 3）
   * @param context - 重试上下文
   * @returns 执行结果
   */
  async executeWithAutoRetry(
    stageFn: () => Promise<void>,
    maxRetries = 3,
    context?: {
      runId?: string;
      pipelineId?: string;
      stageName?: string;
      config?: Partial<RetryConfig>;
    }
  ): Promise<StageResult> {
    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...context?.config, maxRetries };
    let lastError: Error | undefined;
    let retryCount = 0;
    const startTime = Date.now();

    // 尝试执行（包含初始执行 + 重试）
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await stageFn();
        // 成功
        return {
          success: true,
          retryCount,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;

        if (attempt >= maxRetries) {
          // 已达到最大重试次数
          break;
        }

        // 判断是否应该重试
        const stageContext: StageContext = {
          stageName: context?.stageName || 'unknown',
          retryCount: attempt + 1,
          maxRetries,
        };

        const { shouldRetry, strategy, classification } = await this.shouldRetry(
          lastError,
          attempt + 1,
          stageContext
        );

        if (!shouldRetry) {
          // 不应重试，记录后退出
          await this.recordRetry({
            pipelineId: context?.pipelineId,
            runId: context?.runId || '',
            stageName: context?.stageName || 'unknown',
            retryAttempt: attempt + 1,
            errorType: classification.type,
            errorMessage: errorMessage.substring(0, 500),
            retryStrategy: strategy,
            delayMs: 0,
            success: false,
            durationMs: Date.now() - startTime,
          });
          break;
        }

        retryCount = attempt + 1;

        // 计算延迟
        const delayMs = this.calculateDelay(strategy, attempt + 1, config);

        // 记录重试
        await this.recordRetry({
          pipelineId: context?.pipelineId,
          runId: context?.runId || '',
          stageName: context?.stageName || 'unknown',
          retryAttempt: attempt + 1,
          errorType: classification.type,
          errorMessage: errorMessage.substring(0, 500),
          retryStrategy: strategy,
          delayMs,
          success: false,
          durationMs: Date.now() - startTime,
        });

        // 等待后重试
        if (delayMs > 0) {
          await this.sleep(delayMs);
        }
      }
    }

    // 所有尝试都失败
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      retryCount,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * 获取重试统计
   *
   * @param pipelineId - 可选，按 Pipeline 过滤
   * @returns 重试统计数据
   */
  async getRetryStats(pipelineId?: string): Promise<RetryStats> {
    if (!this.dbPool) {
      return {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        successRate: 0,
        averageRetriesPerPipeline: 0,
        byStrategy: {},
        byErrorType: {},
      };
    }

    try {
      const whereClause = pipelineId ? 'WHERE pipeline_id = $1' : '';
      const params = pipelineId ? [pipelineId] : [];

      // 总统计
      const statsResult = await this.dbPool.query(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
           SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed,
           COUNT(DISTINCT run_id) as unique_runs
         FROM pipeline_auto_retries ${whereClause}`,
        params
      );

      const statsRow = statsResult.rows[0];
      const totalRetries = parseInt(statsRow?.total || '0', 10);
      const successfulRetries = parseInt(statsRow?.successful || '0', 10);
      const failedRetries = parseInt(statsRow?.failed || '0', 10);
      const uniqueRuns = parseInt(statsRow?.unique_runs || '1', 10);

      // 按策略统计
      const strategyResult = await this.dbPool.query(
        `SELECT retry_strategy, COUNT(*) as count
         FROM pipeline_auto_retries ${whereClause}
         WHERE retry_strategy IS NOT NULL
         GROUP BY retry_strategy`,
        params
      );

      const byStrategy: Record<string, number> = {};
      for (const row of strategyResult.rows) {
        byStrategy[row.retry_strategy] = parseInt(row.count, 10);
      }

      // 按错误类型统计
      const errorTypeResult = await this.dbPool.query(
        `SELECT error_type, COUNT(*) as count
         FROM pipeline_auto_retries ${whereClause}
         WHERE error_type IS NOT NULL
         GROUP BY error_type`,
        params
      );

      const byErrorType: Record<string, number> = {};
      for (const row of errorTypeResult.rows) {
        byErrorType[row.error_type] = parseInt(row.count, 10);
      }

      return {
        totalRetries,
        successfulRetries,
        failedRetries,
        successRate: totalRetries > 0 ? successfulRetries / totalRetries : 0,
        averageRetriesPerPipeline: uniqueRuns > 0 ? totalRetries / uniqueRuns : 0,
        byStrategy,
        byErrorType,
      };
    } catch (err) {
      logger.error('[AutoRetry] Failed to get retry stats:', err);
      return {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        successRate: 0,
        averageRetriesPerPipeline: 0,
        byStrategy: {},
        byErrorType: {},
      };
    }
  }

  /**
   * 配置重试策略
   *
   * 保存重试配置到数据库（存储为 JSON 格式的持久化配置）
   */
  async configureRetry(config: {
    pipelineId?: string;
    stageName?: string;
    maxRetries?: number;
    strategy?: 'immediate' | 'backoff' | 'skip';
    baseDelayMs?: number;
    maxDelayMs?: number;
  }): Promise<RetryConfig> {
    // 返回合并后的配置（实际应用中可以持久化到数据库）
    const result: RetryConfig = {
      maxRetries: config.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries,
      strategy: config.strategy ?? DEFAULT_RETRY_CONFIG.strategy,
      baseDelayMs: config.baseDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelayMs,
      maxDelayMs: config.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs,
      jitter: DEFAULT_RETRY_CONFIG.jitter,
    };

    // 持久化配置到数据库（如果提供了 pipelineId 或 stageName）
    if (this.dbPool && (config.pipelineId || config.stageName)) {
      try {
        const target = config.pipelineId || config.stageName || 'default';
        const targetType = config.pipelineId ? 'pipeline' : 'stage';
        await this.dbPool.query(
          `INSERT INTO pipeline_retry_configs (target, target_type, config)
           VALUES ($1, $2, $3)
           ON CONFLICT (target, target_type)
           DO UPDATE SET config = $3, updated_at = NOW()`,
          [target, targetType, JSON.stringify(result)]
        );
      } catch (err) {
        logger.warn('[AutoRetry] Failed to persist retry config:', err);
      }
    }

    return result;
  }

  /**
   * 记录重试事件
   */
  private async recordRetry(record: RetryRecord): Promise<void> {
    if (!this.dbPool) {
      return;
    }

    try {
      await this.dbPool.query(
        `INSERT INTO pipeline_auto_retries
         (pipeline_id, run_id, stage_name, retry_attempt, error_type, error_message,
          retry_strategy, delay_ms, success, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          record.pipelineId || null,
          record.runId,
          record.stageName,
          record.retryAttempt,
          record.errorType || null,
          record.errorMessage || null,
          record.retryStrategy || null,
          record.delayMs || null,
          record.success,
          record.durationMs || null,
        ]
      );
    } catch (err) {
      logger.warn('[AutoRetry] Failed to record retry:', err);
    }
  }

  /**
   * 计算重试延迟
   */
  private calculateDelay(
    strategy: 'immediate' | 'backoff' | 'skip',
    attempt: number,
    config: RetryConfig
  ): number {
    switch (strategy) {
      case 'immediate':
        return 0;

      case 'backoff': {
        // 指数退避: baseDelay * 2^(attempt-1)
        const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt - 1);
        const delay = Math.min(exponentialDelay, config.maxDelayMs);

        // 添加 jitter（随机抖动）防止重试风暴
        if (config.jitter) {
          return Math.round(delay * (0.5 + Math.random() * 0.5));
        }
        return Math.round(delay);
      }

      case 'skip':
      default:
        return 0;
    }
  }

  /**
   * 工具函数：sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
