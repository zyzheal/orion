/**
 * 幂等性检查器 - 确保操作不会重复执行
 *
 * 功能：
 * - 基于 requestId 检查是否已处理
 * - 使用 Redis 存储处理状态
 * - 自动过期时间 24 小时
 */

import { RedisCache } from '../services/redis-cache';

/**
 * 幂等性检查结果
 */
export interface IdempotencyCheckResult {
  /** 是否可以执行（true = 首次执行，false = 已处理） */
  canExecute: boolean;
  /** 是否已处理 */
  isProcessed: boolean;
  /** 如果已处理，返回之前的结果 */
  previousResult?: unknown;
  /** 如果已处理，返回之前的错误 */
  previousError?: string;
  /** 处理时间 */
  processedAt?: Date;
}

/**
 * 幂等性记录
 */
interface IdempotencyRecord {
  requestId: string;
  status: 'processing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: string;
  completedAt?: string;
  transactionId?: string;
}

/**
 * 幂等性检查器选项
 */
export interface IdempotencyCheckerOptions {
  /** Redis 缓存服务 */
  redis?: RedisCache;
  /** 键前缀 */
  keyPrefix?: string;
  /** 过期时间（秒），默认 24 小时 */
  ttlSeconds?: number;
}

/**
 * 默认过期时间：24 小时
 */
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

/**
 * 内存存储（备用）
 */
class InMemoryStorage {
  private records = new Map<string, IdempotencyRecord>();
  private expiries = new Map<string, number>();

  set(key: string, record: IdempotencyRecord, ttlSeconds: number): void {
    this.records.set(key, record);
    this.expiries.set(key, Date.now() + ttlSeconds * 1000);
  }

  get(key: string): IdempotencyRecord | null {
    const expiry = this.expiries.get(key);
    if (expiry && Date.now() > expiry) {
      this.records.delete(key);
      this.expiries.delete(key);
      return null;
    }
    return this.records.get(key) || null;
  }

  delete(key: string): void {
    this.records.delete(key);
    this.expiries.delete(key);
  }
}

/**
 * 幂等性检查器
 */
export class IdempotencyChecker {
  private redis?: RedisCache;
  private keyPrefix: string;
  private ttlSeconds: number;
  private memoryStorage: InMemoryStorage;

  constructor(options: IdempotencyCheckerOptions = {}) {
    this.redis = options.redis;
    this.keyPrefix = options.keyPrefix || 'saga:idempotency:';
    this.ttlSeconds = options.ttlSeconds || DEFAULT_TTL_SECONDS;
    this.memoryStorage = new InMemoryStorage();
  }

  /**
   * 检查是否可以执行
   */
  async check(requestId: string): Promise<IdempotencyCheckResult> {
    const key = this.getKey(requestId);
    const record = await this.getRecord(key);

    if (!record) {
      return { canExecute: true, isProcessed: false };
    }

    // 正在处理中
    if (record.status === 'processing') {
      return {
        canExecute: false,
        isProcessed: false,
        processedAt: new Date(record.createdAt),
      };
    }

    // 已完成
    if (record.status === 'completed') {
      return {
        canExecute: false,
        isProcessed: true,
        previousResult: record.result,
        processedAt: record.completedAt ? new Date(record.completedAt) : undefined,
      };
    }

    // 已失败
    if (record.status === 'failed') {
      return {
        canExecute: false,
        isProcessed: true,
        previousError: record.error,
        processedAt: record.completedAt ? new Date(record.completedAt) : undefined,
      };
    }

    return { canExecute: true, isProcessed: false };
  }

  /**
   * 标记为处理中
   */
  async markProcessing(requestId: string, transactionId?: string): Promise<void> {
    const key = this.getKey(requestId);
    const record: IdempotencyRecord = {
      requestId,
      status: 'processing',
      createdAt: new Date().toISOString(),
      transactionId,
    };
    await this.setRecord(key, record);
  }

  /**
   * 标记为已完成
   */
  async markCompleted(requestId: string, result?: unknown, transactionId?: string): Promise<void> {
    const key = this.getKey(requestId);
    const existing = await this.getRecord(key);

    const record: IdempotencyRecord = {
      requestId,
      status: 'completed',
      result,
      createdAt: existing?.createdAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      transactionId: transactionId || existing?.transactionId,
    };
    await this.setRecord(key, record);
  }

  /**
   * 标记为失败
   */
  async markFailed(requestId: string, error: string, transactionId?: string): Promise<void> {
    const key = this.getKey(requestId);
    const existing = await this.getRecord(key);

    const record: IdempotencyRecord = {
      requestId,
      status: 'failed',
      error,
      createdAt: existing?.createdAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      transactionId: transactionId || existing?.transactionId,
    };
    await this.setRecord(key, record);
  }

  /**
   * 清除记录（用于重试）
   */
  async clear(requestId: string): Promise<void> {
    const key = this.getKey(requestId);

    if (this.redis?.isHealthy()) {
      await this.redis.delete(key);
    } else {
      this.memoryStorage.delete(key);
    }
  }

  /**
   * 获取处理状态
   */
  async getStatus(requestId: string): Promise<{
    status: 'none' | 'processing' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
    createdAt?: Date;
    completedAt?: Date;
  }> {
    const key = this.getKey(requestId);
    const record = await this.getRecord(key);

    if (!record) {
      return { status: 'none' };
    }

    return {
      status: record.status,
      result: record.result,
      error: record.error,
      createdAt: new Date(record.createdAt),
      completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
    };
  }

  /**
   * 获取键名
   */
  private getKey(requestId: string): string {
    return `${this.keyPrefix}${requestId}`;
  }

  /**
   * 获取记录
   */
  private async getRecord(key: string): Promise<IdempotencyRecord | null> {
    if (this.redis?.isHealthy()) {
      return await this.redis.get<IdempotencyRecord>(key);
    }
    return this.memoryStorage.get(key);
  }

  /**
   * 设置记录
   */
  private async setRecord(key: string, record: IdempotencyRecord): Promise<void> {
    if (this.redis?.isHealthy()) {
      await this.redis.set(key, record, this.ttlSeconds);
    } else {
      this.memoryStorage.set(key, record, this.ttlSeconds);
    }
  }
}