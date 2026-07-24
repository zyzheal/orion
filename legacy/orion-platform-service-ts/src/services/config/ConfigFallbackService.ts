/**
 * Configuration Multi-Level Fallback Service
 *
 * 配置多级降级服务 - 多级缓存与故障恢复
 *
 * 持久化: PostgreSQL config_fallback (migration 364)
 * 降级路径: memory -> Redis -> database -> default
 */

import Redis from 'ioredis';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ConfigFallback');

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

export interface DbPoolLike {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}

export class ConfigFallbackService {
  private memoryCache: MemoryCache;
  private redis: Redis | null = null;
  private config: FallbackConfig;
  private dbQueryFn: ((domain: string, key: string) => Promise<any>) | null = null;
  private defaultConfig: Record<string, any> = {};

  // PostgreSQL Repository with graceful degradation
  private dbRepository: import('../../repositories/ConfigFallbackRepository').ConfigFallbackRepository | null = null;
  private dbPool: DbPoolLike | null = null;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
    this.memoryCache = new MemoryCache(
      this.config.memoryCacheMaxSize,
      this.config.memoryCacheTtlSeconds
    );
  }

  /**
   * Initialize with a database pool (PostgreSQL Repository pattern)
   * If DB is unavailable, falls back to memory-only mode gracefully.
   */
  initDatabase(db: DbPoolLike): void {
    try {
      // Lazy-load to avoid circular dependency
      const { ConfigFallbackRepository } = require('../repositories/ConfigFallbackRepository');
      this.dbPool = db;
      this.dbRepository = new ConfigFallbackRepository(db);

      // Verify DB actually works with a lightweight ping
      db.query('SELECT 1').catch(() => {
        logger.warn('ConfigFallback: DB ping failed, operating in memory-only mode');
        this.dbPool = null;
        this.dbRepository = null;
      });

      logger.info('ConfigFallback PostgreSQL persistence initialized');
    } catch (error) {
      logger.warn({ error }, 'ConfigFallback: failed to initialize DB repository, memory-only mode');
      this.dbPool = null;
      this.dbRepository = null;
    }
  }

  /**
   * Deprecated alias — kept for compatibility with existing callers.
   * Use `initDatabase(db)` instead.
   */
  setDatabasePool(pool: DbPoolLike): void {
    this.initDatabase(pool);
  }

  /**
   * Set database query function (legacy pattern, superseded by initDatabase)
   * Kept for backward compatibility with existing code.
   */
  setDbQueryFn(fn: (domain: string, key: string) => Promise<any>): void {
    this.dbQueryFn = fn;
  }

  /**
   * Set default config values
   */
  setDefaultConfig(defaults: Record<string, any>): void {
    this.defaultConfig = defaults;
  }

  /**
   * Get config value with multi-level fallback chain:
   * memory -> Redis -> database -> default
   */
  async getConfig(domain: string, key: string): Promise<{
    value: any;
    level: ConfigLevel;
    fromCache: boolean;
  }> {
    const cacheKey = `${domain}:${key}`;

    // 1. Memory cache
    if (this.config.memoryCacheEnabled) {
      const memValue = this.memoryCache.get(cacheKey);
      if (memValue !== null) {
        logger.debug({ domain, key, level: 'memory' }, 'Config loaded from memory');
        return { value: memValue, level: ConfigLevel.MEMORY, fromCache: true };
      }

      // SWR: return stale data and refresh asynchronously
      if (this.config.swrEnabled) {
        const staleValue = this.memoryCache.getStale(cacheKey);
        if (staleValue !== null) {
          this.refreshConfig(domain, key).catch((err) => logger.warn({ err, domain, key }, 'SWR background refresh failed'));
          return { value: staleValue, level: ConfigLevel.MEMORY, fromCache: true };
        }
      }
    }

    // 2. Redis cache
    if (this.config.redisCacheEnabled && this.redis) {
      try {
        const redisValue = await this.redis.get(`config:${cacheKey}`);
        if (redisValue) {
          const value = JSON.parse(redisValue);

          // Fill memory cache
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

    // 3. PostgreSQL database (repository pattern)
    if (this.dbRepository && this.dbRepository.isDbAvailable()) {
      try {
        const entity = await this.dbRepository.findByDomainKey(domain, key);
        if (entity && entity.fallbackValue !== null && entity.fallbackValue !== undefined) {
          await this.setConfig(domain, key, entity.fallbackValue);
          return { value: entity.fallbackValue, level: ConfigLevel.DATABASE, fromCache: false };
        }
      } catch (error) {
        logger.warn({ error, domain, key }, 'PostgreSQL read failed, falling back');
      }
    }

    // 3b. Legacy DB query function (backward compatibility)
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

    // 4. Default values
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
   * Set config value (persists to all caches)
   */
  async setConfig(domain: string, key: string, value: any): Promise<void> {
    const cacheKey = `${domain}:${key}`;

    // Update memory cache
    if (this.config.memoryCacheEnabled) {
      this.memoryCache.set(cacheKey, value, this.config.memoryCacheTtlSeconds);
    }

    // Update Redis
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

    // Persist to PostgreSQL with grace degradation
    if (this.dbRepository && this.dbRepository.isDbAvailable()) {
      try {
        await this.dbRepository.upsert(domain, key, value);
      } catch (error) {
        logger.warn({ error, domain, key }, 'PostgreSQL write failed, using memory-only');
      }
    }
  }

  /**
   * Delete config (soft disable in DB)
   */
  async deleteConfig(domain: string, key: string): Promise<void> {
    const cacheKey = `${domain}:${key}`;

    if (this.config.softDeleteEnabled) {
      // Soft delete: mark as disabled instead of hard deleting
      if (this.dbRepository && this.dbRepository.isDbAvailable()) {
        try {
          await this.dbRepository.disable(domain, key);
        } catch (error) {
          logger.warn({ error, domain, key }, 'PostgreSQL soft-delete failed');
        }
      }

      if (this.config.redisCacheEnabled && this.redis) {
        try {
          await this.redis.set(
            `config:deleted:${cacheKey}`,
            JSON.stringify({ deletedAt: Date.now() }),
            'EX',
            this.config.recoveryWindowDays * 86400
          );
        } catch (error) {
          logger.warn({ error }, 'Redis soft-delete marker write failed');
        }
      }
    }

    // Clear from memory
    this.memoryCache.delete(cacheKey);
    if (this.config.redisCacheEnabled && this.redis) {
      try {
        await this.redis.del(`config:${cacheKey}`);
      } catch (error) {
        logger.warn({ error }, 'Redis delete failed');
      }
    }
  }

  /**
   * Refresh config from database
   */
  private async refreshConfig(domain: string, key: string): Promise<void> {
    // Use PostgreSQL repository if available
    if (this.dbRepository && this.dbRepository.isDbAvailable()) {
      try {
        const entity = await this.dbRepository.findByDomainKey(domain, key);
        if (entity && entity.fallbackValue !== null) {
          await this.setConfig(domain, key, entity.fallbackValue);
          return;
        }
      } catch (error) {
        logger.warn({ error, domain, key }, 'Config refresh from PostgreSQL failed');
      }
    }

    // Fallback to legacy DB query function
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
   * Get default value from registered defaults
   */
  private getDefaultValue(domain: string, key: string): any {
    const domainConfig = this.defaultConfig[domain];
    if (!domainConfig) return undefined;
    return domainConfig[key];
  }

  /**
   * Warmup memory cache from database
   */
  async warmup(configs: Array<{ domain: string; key: string; value: any }>): Promise<void> {
    logger.info({ count: configs.length }, 'Starting cache warmup');

    for (const config of configs) {
      await this.setConfig(config.domain, config.key, config.value);
    }

    logger.info('Cache warmup completed');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memory: this.memoryCache.getStats(),
      redis: this.redis?.status || 'disconnected',
      config: this.config,
    };
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    this.memoryCache.clear();

    if (this.redis) {
      try {
        const keys = await this.redis.keys('config:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        logger.warn({ error }, 'Redis clearCache failed');
      }
    }

    logger.info('Cache cleared');
  }
}

export default ConfigFallbackService;
