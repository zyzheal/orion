/**
 * 工具函数
 */

/**
 * 生成 UUID v4
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 延迟执行
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重试执行
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    maxDelay?: number;
    multiplier?: number;
    onRetry?: (error: Error, retryCount: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    maxDelay = 30000,
    multiplier = 2,
    onRetry,
  } = options;

  let lastError: Error;
  let currentDelay = delay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        onRetry?.(lastError, attempt + 1);
        await sleep(currentDelay);
        currentDelay = Math.min(currentDelay * multiplier, maxDelay);
      }
    }
  }

  throw lastError!;
}

/**
 * 解析持续时间字符串（如 "1h", "30m", "300s"）为毫秒
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };

  return value * (multipliers[unit] || 1);
}

/**
 * 深拷贝对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 合并对象（浅合并）
 */
export function merge<T extends object>(...objects: Partial<T>[]): T {
  return Object.assign({}, ...objects) as T;
}
