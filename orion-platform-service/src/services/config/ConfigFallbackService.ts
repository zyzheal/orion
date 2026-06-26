/**
 * Configuration Multi-Level Fallback Service
 * 
 * 配置多级降级服务 - 多级缓存与故障恢复
 */

import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'ConfigFallback' });

// ==================== 配置级别 ====================

export enum ConfigLevel {
  MEMORY = 'memory',       // 内存缓存 (最快)
  REDIS = 'redis',         // Redis 缓存
  DATABASE = 'database',   // 数据库 (最慢)
  DEFAULT = 'default',     // 默认值 (最终兜底)
}

// ==================== 降级配置 ====================

export interface FallbackConfig {
  // 内存缓存
  memoryCacheEnabled: boolean;
  memoryCacheTtlSeconds: number;
  memoryCacheMaxSize: number;
  
  // Redis 缓存
  redisCacheEnabled: boolean;
  redisCacheTtlSeconds: number;
  
  // Stale-While-Revalidate
  swrEnabled: boolean;
  swrStaleSeconds: number;
  
  // 默认值
  defaultFallbackEnabled: boolean;
  
  // 软删除/回收站
  softDeleteEnabled: boolean;
  recoveryWindowDays: number;
}

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  memoryCacheEnabled: true,
  memoryCacheTtlSeconds: 300,      // 5 分钟
  memoryCacheMaxSize: 10000,       // 最大 10000 条
  
  redisCacheEnabled: true,
  redisCacheTtlSeconds: 3600,      // 1 小时
  
  swrEnabled: true,
  swrStaleSeconds: 600,            // 10 秒 stale 窗口
  
  defaultFallbackEnabled: true,
  
  softDeleteEnabled: true,
  recoveryWindowDays: 30,
};

// ==================== 内存缓存 ====================

interface MemoryCacheEntry<T> {
  value: T;
  expiresAt: number;
  staleAt?: number;
  level: ConfigLevel;
}

class MemoryCache<T = any> {
  private cache = new Map<string, MemoryCacheEntry<T>>();
  private maxSize: number;
  private ttlSeconds: number;

  constructor(maxSize: number = 10000, ttlSeconds: number = 300) {
    this.maxSize = maxSize;
    this.ttlSeconds = ttlSeconds;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds?: number, staleSeconds?: number): void {
    // LRU 淘汰
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    const now = Date.now();
    const ttl = (ttlSeconds || this.ttlSeconds) * 1000;
    const stale = staleSeconds ? staleSeconds * 1000 : undefined;
    
    this.cache.set(key, {
      value,
      expiresAt: now + ttl,
      staleAt: stale ? now + stale : undefined,
      level: ConfigLevel.MEMORY,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStale(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // 返回 stale 数据
    if (entry.staleAt && Date.now() > entry.staleAt) {
      return entry.value;
    }
    
    return null;
  }

  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry || !entry.staleAt) return false;
    return Date.now() > entry.staleAt;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlSeconds: this.ttlSeconds,
    };
  }
}

// ==================== 降级服务 ====================

export class ConfigFallbackService {
  private memoryCache: MemoryCache;
  private redis: Redis | null = null;
  private config: FallbackConfig;
  private dbQueryFn: ((domain: string, key: string) => Promise<any>) | null = null;
  private defaultConfig: Record<string, any> = {};

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
    this.memoryCache = new MemoryCache(
      this.config.memoryCacheMaxSize,
      this.config.memoryCacheTtlSeconds
    );
  }

  /**
   * 初始化 Redis 连接
   */
  async initializeRedis(url?: string): Promise<void> {
    if (!this.config.redisCacheEnabled) return;
    
    try {
      this.redis = new Redis(url || process.env.REDIS_URL || 'redis://localhost:6379', {
        retryStrategy: (times) => Math.min(times * 100, 3000),
        maxRetriesPerRequest: 3,
      });
      
      this.redis.on('error', (err) => {
        logger.error({ err }, 'Redis connection error');
        this.redis = null;
      });
      
      logger.info('ConfigFallback Redis connected');
    } catch (error) {
      logger.warn({ error }, 'Redis connection failed, using memory only');
      this.redis = null;
    }
  }

  /**
   * 设置数据库查询函数
   */
  setDbQueryFn(fn: (domain: string, key: string) => Promise<any>): void {
    this.dbQueryFn = fn;
  }

  /**
   * 设置默认配置
   */
  setDefaultConfig(defaults: Record<string, any>): void {
    this.defaultConfig = defaults;
  }

  /**
   * 获取配置 (带多级降级)
   */
  async getConfig(domain: string, key: string): Promise<{
    value: any;
    level: ConfigLevel;
    fromCache: boolean;
  }> {
    const cacheKey = `${domain}:${key}`;
    
    // 1. 内存缓存
    if (this.config.memoryCacheEnabled) {
      const memValue = this.memoryCache.get(cacheKey);
      if (memValue !== null) {
        logger.debug({ domain, key, level: 'memory' }, 'Config loaded from memory');
        return { value: memValue, level: ConfigLevel.MEMORY, fromCache: true };
      }
      
      // SWR: 返回 stale 数据同时异步刷新
      if (this.config.swrEnabled) {
        const staleValue = this.memoryCache.getStale(cacheKey);
        if (staleValue !== null) {
          // 异步刷新
          this.refreshConfig(domain, key).catch((err) => logger.warn({ err, domain, key }, 'SWR background refresh failed'));
          return { value: staleValue, level: ConfigLevel.MEMORY, fromCache: true };
        }
      }
    }

    // 2. Redis 缓存
    if (this.config.redisCacheEnabled && this.redis) {
      try {
        const redisValue = await this.redis.get(`config:${cacheKey}`);
        if (redisValue) {
          const value = JSON.parse(redisValue);
          
          // 回填内存缓存
          if (this.config.memoryCacheEnabled) {
            this.memoryCache.set(cacheKey, value, this.config.memoryCacheTtlSeconds);
          }
          
          logger.debug({ domain, key, level: 'redis' }, 'Config loaded from Redis');
          return { value, level: ConfigLevel.REDIS, fromCache: true };
        }
      } catch (error) {
        logger.warn({ error, domain, key }, 'Redis read failed');
      }
    }

    // 3. 数据库
    if (this.dbQueryFn) {
      try {
        const value = await this.dbQueryFn(domain, key);
        if (value !== null && value !== undefined) {
          await this.setConfig(domain, key, value);
          return { value, level: ConfigLevel.DATABASE, fromCache: false };
        }
      } catch (error) {
        logger.warn({ error, domain, key }, 'Database read failed');
      }
    }

    // 4. 默认值
    if (this.config.defaultFallbackEnabled) {
      const defaultValue = this.getDefaultValue(domain, key);
      if (defaultValue !== undefined) {
        logger.debug({ domain, key, level: 'default' }, 'Config loaded from defaults');
        return { value: defaultValue, level: ConfigLevel.DEFAULT, fromCache: false };
      }
    }

    return { value: null, level: ConfigLevel.DEFAULT, fromCache: false };
  }

  /**
   * 设置配置 (更新所有缓存)
   */
  async setConfig(domain: string, key: string, value: any): Promise<void> {
    const cacheKey = `${domain}:${key}`;
    
    // 更新内存缓存
    if (this.config.memoryCacheEnabled) {
      this.memoryCache.set(cacheKey, value, this.config.memoryCacheTtlSeconds);
    }
    
    // 更新 Redis
    if (this.config.redisCacheEnabled && this.redis) {
      try {
        await this.redis.set(
          `config:${cacheKey}`,
          JSON.stringify(value),
          'EX',
          this.config.redisCacheTtlSeconds
        );
      } catch (error) {
        logger.warn({ error }, 'Redis write failed');
      }
    }
  }

  /**
   * 删除配置 (软删除)
   */
  async deleteConfig(domain: string, key: string): Promise<void> {
    const cacheKey = `${domain}:${key}`;
    
    if (this.config.softDeleteEnabled) {
      // 软删除: 标记而不是真正删除
      if (this.config.redisCacheEnabled && this.redis) {
        await this.redis.set(
          `config:deleted:${cacheKey}`,
          JSON.stringify({ deletedAt: Date.now() }),
          'EX',
          this.config.recoveryWindowDays * 86400
        );
      }
    }
    
    // 清除缓存
    this.memoryCache.delete(cacheKey);
    if (this.config.redisCacheEnabled && this.redis) {
      await this.redis.del(`config:${cacheKey}`);
    }
  }

  /**
   * 刷新配置
   */
  private async refreshConfig(domain: string, key: string): Promise<void> {
    if (!this.dbQueryFn) return;
    
    try {
      const value = await this.dbQueryFn(domain, key);
      if (value !== null) {
        await this.setConfig(domain, key, value);
      }
    } catch (error) {
      logger.warn({ error, domain, key }, 'Config refresh failed');
    }
  }

  /**
   * 获取默认值
   */
  private getDefaultValue(domain: string, key: string): any {
    const domainConfig = this.defaultConfig[domain];
    if (!domainConfig) return undefined;
    return domainConfig[key];
  }

  /**
   * 预热缓存
   */
  async warmup(configs: Array<{ domain: string; key: string; value: any }>): Promise<void> {
    logger.info({ count: configs.length }, 'Starting cache warmup');
    
    for (const config of configs) {
      await this.setConfig(config.domain, config.key, config.value);
    }
    
    logger.info('Cache warmup completed');
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      memory: this.memoryCache.getStats(),
      redis: this.redis?.status || 'disconnected',
      config: this.config,
    };
  }

  /**
   * 清除所有缓存
   */
  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.redis) {
      const keys = await this.redis.keys('config:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
    
    logger.info('Cache cleared');
  }
}

export default ConfigFallbackService;