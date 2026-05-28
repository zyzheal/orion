/**
 * ErrorClassifier - 错误分类服务 (Phase 2: Autonomous Pipeline)
 *
 * 负责：
 * - 分类错误类型（transient / permanent / flaky / config）
 * - 决定重试策略（immediate / backoff / skip）
 * - 基于错误模式和历史数据计算置信度
 *
 * 错误类型定义：
 * - transient: 临时性错误（网络超时、连接断开、资源不足），可重试
 * - permanent: 永久性错误（代码编译失败、语法错误、权限不足），不应重试
 * - flaky: 间歇性错误（有时成功有时失败），需要更谨慎重试
 * - config: 配置错误（缺少环境变量、无效参数），不应重试
 */

import { DatabasePool } from '../database';
import pino from 'pino';

const logger = pino({ name: 'LError-LClassifier' });

export type ErrorType = 'transient' | 'permanent' | 'flaky' | 'config';
export type RetryStrategy = 'immediate' | 'backoff' | 'skip';

export interface ErrorClassification {
  type: ErrorType;
  shouldRetry: boolean;
  retryStrategy: RetryStrategy;
  confidence: number;
  reasoning: string;
}

export interface StageContext {
  stageName: string;
  retryCount: number;
  maxRetries: number;
  previousErrors?: string[];
  [key: string]: unknown;
}

/**
 * 错误模式匹配规则
 */
interface ErrorPatternRule {
  patterns: RegExp[];
  type: ErrorType;
  strategy: RetryStrategy;
  baseConfidence: number;
}

// 预定义的错误模式规则
const ERROR_PATTERN_RULES: ErrorPatternRule[] = [
  // Transient errors - 网络/连接类
  {
    patterns: [
      /ETIMEDOUT/i,
      /ECONNRESET/i,
      /ECONNREFUSED/i,
      /socket hang up/i,
      /network error/i,
      /timeout/i,
      /connection (?:refused|reset|timed out)/i,
      /temporary failure/i,
      /dial tcp.*connection/i,
      /i\/o timeout/i,
      /resource temporarily unavailable/i,
      /too many open files/i,
      /rate limit/i,
      /429/i,
      /throttl/i,
    ],
    type: 'transient',
    strategy: 'backoff',
    baseConfidence: 0.9,
  },
  // Transient errors - Docker/K8s 资源类
  {
    patterns: [
      /OOMKilled/i,
      /out of memory/i,
      /insufficient resources/i,
      /node.*not ready/i,
      /pod.*evicted/i,
      /container.*failed to start/i,
      /image pull failed/i,
      /back-off restarting/i,
    ],
    type: 'transient',
    strategy: 'backoff',
    baseConfidence: 0.85,
  },
  // Permanent errors - 编译/语法类
  {
    patterns: [
      /syntax error/i,
      /compilation failed/i,
      /cannot find module/i,
      /type error/i,
      /undeclared identifier/i,
      /missing.*argument/i,
      /undefined.*is not a function/i,
    ],
    type: 'permanent',
    strategy: 'skip',
    baseConfidence: 0.95,
  },
  // Permanent errors - 权限/认证类
  {
    patterns: [
      /permission denied/i,
      /access denied/i,
      /unauthorized/i,
      /forbidden/i,
      /401/i,
      /403/i,
      /not enough privileges/i,
      /authentication failed/i,
    ],
    type: 'permanent',
    strategy: 'skip',
    baseConfidence: 0.95,
  },
  // Config errors - 配置/环境变量类
  {
    patterns: [
      /env.*not (?:set|defined)/i,
      /missing.*config/i,
      /invalid configuration/i,
      /required.*parameter/i,
      /invalid.*value/i,
      /malformed/i,
      /unexpected token/i,
      /ENOENT/i,
      /no such file or directory/i,
    ],
    type: 'config',
    strategy: 'skip',
    baseConfidence: 0.9,
  },
  // Permanent errors - 仓库/依赖类
  {
    patterns: [
      /repository not found/i,
      /404/i,
      /not found/i,
      /package.*not found/i,
      /version.*not found/i,
      /deprecated.*removed/i,
    ],
    type: 'permanent',
    strategy: 'skip',
    baseConfidence: 0.95,
  },
];

/**
 * 检查错误是否为间歇性 (flaky)
 * 基于历史记录判断：如果同一个 stage 在相同错误模式下有时成功有时失败
 */
function detectFlaky(
  errorMessage: string,
  stageContext: StageContext,
  historicalPattern?: { flakyRate: number }
): boolean {
  // 如果有历史数据显示该模式经常间歇性失败
  if (historicalPattern && historicalPattern.flakyRate > 0.2) {
    return true;
  }

  // 如果已经有过多次重试且每次结果不一致，标记为 flaky
  if (stageContext.previousErrors && stageContext.previousErrors.length >= 2) {
    // 检查历史错误中是否有相同模式也有成功记录
    const patternMatches = stageContext.previousErrors.filter((e) =>
      normalizePattern(e) === normalizePattern(errorMessage)
    );
    // 如果错误出现次数少但重试次数多，可能是 flaky
    if (stageContext.retryCount >= 2 && patternMatches.length < stageContext.retryCount) {
      return true;
    }
  }

  return false;
}

/**
 * 规范化错误消息，提取模式
 */
function normalizePattern(message: string): string {
  return message
    .replace(/\d+/g, '<NUM>')
    .replace(/\/[a-zA-Z0-9_./-]+/g, '<PATH>')
    .replace(/[a-f0-9]{8,}/g, '<HASH>')
    .trim()
    .toLowerCase();
}

export class ErrorClassifier {
  constructor(private pool: DatabasePool) {}

  /**
   * 分类错误
   *
   * @param error - 错误对象或错误消息
   * @param stageContext - Stage 执行上下文
   * @returns 错误分类结果
   */
  async classifyError(
    error: Error | string,
    stageContext: StageContext
  ): Promise<ErrorClassification> {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = error instanceof Error ? (error.stack || '') : '';

    // 1. 模式匹配
    const patternMatch = this.matchPattern(errorMessage, errorStack);

    // 2. 检查是否为 flaky
    const isFlaky = detectFlaky(errorMessage, stageContext);

    // 3. 结合历史数据调整置信度
    let classification: ErrorClassification;

    if (isFlaky && patternMatch) {
      // 标记为 flaky，降低置信度
      classification = {
        type: 'flaky',
        shouldRetry: true,
        retryStrategy: 'backoff',
        confidence: Math.min(patternMatch.baseConfidence, 0.7),
        reasoning: `Error appears to be flaky. Base pattern: ${patternMatch.type}.`,
      };
    } else if (patternMatch) {
      classification = {
        type: patternMatch.type,
        shouldRetry: patternMatch.type === 'transient' || (isFlaky),
        retryStrategy: patternMatch.strategy,
        confidence: patternMatch.baseConfidence,
        reasoning: `Matched pattern for ${patternMatch.type} error`,
      };
    } else {
      // 未知错误类型，默认视为 transient（保守策略）
      classification = {
        type: 'transient',
        shouldRetry: true,
        retryStrategy: 'backoff',
        confidence: 0.3,
        reasoning: 'Unknown error type, defaulting to transient with low confidence',
      };
    }

    // 4. 检查是否超过最大重试次数
    if (stageContext.retryCount >= stageContext.maxRetries) {
      classification.shouldRetry = false;
      classification.retryStrategy = 'skip';
      classification.reasoning += '; max retries exceeded';
    }

    // 5. 保存分类结果到数据库
    await this.saveClassification(errorMessage, stageContext, classification);

    return classification;
  }

  /**
   * 匹配错误模式
   */
  private matchPattern(
    errorMessage: string,
    errorStack: string
  ): ErrorPatternRule | null {
    const fullText = `${errorMessage}\n${errorStack || ''}`;

    for (const rule of ERROR_PATTERN_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(fullText)) {
          return rule;
        }
      }
    }

    return null;
  }

  /**
   * 保存分类结果到数据库
   */
  private async saveClassification(
    errorMessage: string,
    stageContext: StageContext,
    classification: ErrorClassification
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO pipeline_error_classifications
         (stage_name, error_type, error_message, error_pattern, should_retry, retry_strategy, confidence, retry_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          stageContext.stageName,
          classification.type,
          errorMessage.substring(0, 1000),
          normalizePattern(errorMessage),
          classification.shouldRetry,
          classification.retryStrategy,
          classification.confidence,
          stageContext.retryCount,
        ]
      );
    } catch (err) {
      // 数据库写入失败不影响分类结果返回
      logger.warn('[ErrorClassifier] Failed to save classification:', err);
    }
  }

  /**
   * 获取错误统计
   *
   * @param stageName - 可选，按 stage 名称过滤
   * @returns 错误类型统计
   */
  async getErrorStats(stageName?: string): Promise<{
    total: number;
    byType: Record<ErrorType, number>;
    retrySuccessRate: number;
    topErrors: Array<{ pattern: string; count: number; type: ErrorType }>;
  }> {
    const whereClause = stageName ? 'WHERE stage_name = $1' : '';
    const params = stageName ? [stageName] : [];

    try {
      // 按类型统计
      const typeStats = await this.pool.query(
        `SELECT error_type, COUNT(*) as count
         FROM pipeline_error_classifications ${whereClause}
         GROUP BY error_type`,
        params
      );

      const byType: Record<ErrorType, number> = {
        transient: 0,
        permanent: 0,
        flaky: 0,
        config: 0,
      };
      for (const row of typeStats.rows) {
        byType[row.error_type as ErrorType] = parseInt(row.count, 10);
      }

      // 总计数
      const totalResult = await this.pool.query(
        `SELECT COUNT(*) as total FROM pipeline_error_classifications ${whereClause}`,
        params
      );
      const total = parseInt(totalResult.rows[0]?.total || '0', 10);

      // 重试成功率
      const retryStats = await this.pool.query(
        `SELECT
           COUNT(*) as total_classified,
           SUM(CASE WHEN should_retry = true AND resolved = true THEN 1 ELSE 0 END) as retry_success
         FROM pipeline_error_classifications ${whereClause}
         WHERE should_retry = true`,
        params
      );
      const retryRow = retryStats.rows[0];
      const retryTotal = parseInt(retryRow?.total_classified || '0', 10);
      const retrySuccess = parseInt(retryRow?.retry_success || '0', 10);
      const retrySuccessRate = retryTotal > 0 ? retrySuccess / retryTotal : 0;

      // 常见错误模式 Top 10
      const topErrorsResult = await this.pool.query(
        `SELECT error_pattern as pattern, error_type as type, COUNT(*) as count
         FROM pipeline_error_classifications ${whereClause}
         GROUP BY error_pattern, error_type
         ORDER BY count DESC
         LIMIT 10`,
        params
      );

      const topErrors = topErrorsResult.rows.map((row) => ({
        pattern: row.pattern,
        count: parseInt(row.count, 10),
        type: row.type as ErrorType,
      }));

      return { total, byType, retrySuccessRate, topErrors };
    } catch (err) {
      logger.error('[ErrorClassifier] Failed to get error stats:', err);
      return { total: 0, byType: { transient: 0, permanent: 0, flaky: 0, config: 0 }, retrySuccessRate: 0, topErrors: [] };
    }
  }
}
