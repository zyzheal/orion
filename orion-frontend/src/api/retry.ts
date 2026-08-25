// ============================================================
// 请求重试策略 (Plan 01 — API Client 增强)
// 指数退避 + 抖动 (Jitter)，避免雷群效应
// ============================================================

import { OrionError, ErrorCode } from './errors';

/** 可重试的状态码 */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** 可重试的错误码 */
const RETRYABLE_CODES = new Set<ErrorCode>([
  ErrorCode.TIMEOUT,
  ErrorCode.BAD_GATEWAY,
  ErrorCode.UNAVAILABLE,
  ErrorCode.RATE_LIMITED,
  ErrorCode.NETWORK,
]);

/** 重试配置 */
export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;     // 基础延迟 ms，默认 1000
  maxDelay?: number;      // 最大延迟 ms，默认 30000
  jitter?: boolean;       // 是否添加随机抖动
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: true,
  onRetry: () => {},
};

/** 判断是否应该重试 */
export function shouldRetry(error: unknown): error is Error {
  if (error instanceof OrionError) {
    return RETRYABLE_CODES.has(error.code);
  }
  // AxiosError: 检查 response.status
  const axiosStatus = (error as { response?: { status?: number } })?.response?.status;
  if (axiosStatus) return RETRYABLE_STATUSES.has(axiosStatus);
  // 通用 status 字段
  const status = (error as { status?: number }).status;
  if (status) return RETRYABLE_STATUSES.has(status);
  // 网络错误 (无响应)
  const code = (error as { code?: string }).code;
  return code === 'ECONNABORTED' || code === 'ERR_NETWORK' || code === 'ERR_CONNECTION_REFUSED';
}

/** 计算退避延迟（指数 + 抖动） */
export function getRetryDelay(attempt: number, config: RetryConfig = {}): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const exponential = Math.min(
    cfg.baseDelay * Math.pow(2, attempt),
    cfg.maxDelay
  );
  if (cfg.jitter) {
    // 全抖动: [0, exponential]
    return Math.floor(Math.random() * exponential);
  }
  return exponential;
}

/** 休眠 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 带重试的执行器 */
export async function withRetry<T>(
  execute: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await execute();
    } catch (error) {
      lastError = error as Error;

      // 如果是 OrionError 且可重试，延迟后重试
      if (attempt < cfg.maxRetries && shouldRetry(error)) {
        const delay = getRetryDelay(attempt, cfg);
        cfg.onRetry?.(error as Error, attempt);
        await sleep(delay);
        continue;
      }

      // 不可重试或重试次数耗尽
      throw error;
    }
  }

  throw lastError;
}

export function createRetryHandler() {
  return {
    shouldRetry,
    getRetryDelay,
    withRetry,
  };
}
