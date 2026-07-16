/**
 * CMDB 缓存服务
 *
 * 使用 Redis 缓存拓扑数据，TTL 5 分钟
 * 遵循项目统一使用 createLogger 规范
 */

import Redis from 'ioredis';
import { createLogger } from '../utils/logger';

const logger = createLogger('cmdb-cache');

export interface CacheOptions {
  redis?: Redis;
  ttlSeconds?: number;
}

export class CmdbCacheService {
  private redis: Redis | null = null;
  private ttlSeconds: number;
  private memoryCache: Map<string, { data: any; expiresAt: number }>;
  private useMemoryFallback: boolean;

  constructor(options: CacheOptions = {}) {
    this.redis = options.redis || null;
    this.ttlSeconds = options.ttlSeconds || 300; // 默认 5 分钟
    this.memoryCache = new Map();
    this.useMemoryFallback = !this.redis;

    if (this.redis) {
      logger.info('CMDB cache initialized with Redis');
    } else {
      logger.warn('CMDB cache running in memory fallback mode (no Redis provided)');
    }
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `cmdb:${prefix}:${sortedParams}`;
  }

  /**
   * 获取缓存数据
   */
  async get(prefix: string, params: Record<string, any>): Promise<any | null> {
    const key = this.getCacheKey(prefix, params);

    // 优先使用 Redis
    if (this.redis) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          logger.debug({ key }, 'CMDB cache hit (Redis)');
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.warn({ err: error, key }, 'Redis get failed, falling back to memory');
        this.redis = null;
        this.useMemoryFallback = true;
      }
    }

    // 内存缓存 fallback
    if (this.useMemoryFallback) {
      const entry = this.memoryCache.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        logger.debug({ key }, 'CMDB cache hit (memory)');
        return entry.data;
      }
      // 清理过期条目
      if (entry) {
        this.memoryCache.delete(key);
      }
    }

    logger.debug({ key }, 'CMDB cache miss');
    return null;
  }

  /**
   * 设置缓存数据
   */
  async set(prefix: string, params: Record<string, any>, data: any): Promise<void> {
    const key = this.getCacheKey(prefix, params);

    // 优先使用 Redis
    if (this.redis) {
      try {
        await this.redis.setex(key, this.ttlSeconds, JSON.stringify(data));
        logger.debug({ key, ttl: this.ttlSeconds }, 'CMDB cache set (Redis)');
        return;
      } catch (error) {
        logger.warn({ err: error, key }, 'Redis set failed, falling back to memory');
        this.redis = null;
        this.useMemoryFallback = true;
      }
    }

    // 内存缓存 fallback
    if (this.useMemoryFallback) {
      this.memoryCache.set(key, {
        data,
        expiresAt: Date.now() + this.ttlSeconds * 1000,
      });
      logger.debug({ key, ttl: this.ttlSeconds }, 'CMDB cache set (memory)');
    }
  }

  /**
   * 删除缓存数据
   */
  async delete(prefix: string, params: Record<string, any>): Promise<void> {
    const key = this.getCacheKey(prefix, params);

    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        logger.warn({ err: error, key }, 'Redis delete failed');
      }
    }

    this.memoryCache.delete(key);
  }

  /**
   * 批量删除缓存（使用模式匹配）
   */
  async deletePattern(prefix: string): Promise<void> {
    const pattern = `cmdb:${prefix}:*`;

    if (this.redis) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          logger.debug({ pattern, count: keys.length }, 'CMDB cache deleted (Redis)');
        }
      } catch (error) {
        logger.warn({ err: error, pattern }, 'Redis deletePattern failed');
      }
    }

    // 清理内存缓存中的匹配键
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`cmdb:${prefix}:`)) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * 清除所有 CMDB 缓存
   */
  async clearAll(): Promise<void> {
    if (this.redis) {
      try {
        await this.deletePattern('topology');
        await this.deletePattern('ci');
        await this.deletePattern('relation');
        logger.info('Cleared all CMDB cache (Redis)');
      } catch (error) {
        logger.warn({ err: error }, 'Redis clearAll failed');
      }
    }

    this.memoryCache.clear();
    logger.info('Cleared all CMDB cache (memory)');
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { redis: boolean; memorySize: number; ttlSeconds: number } {
    return {
      redis: !!this.redis,
      memorySize: this.memoryCache.size,
      ttlSeconds: this.ttlSeconds,
    };
  }
}
