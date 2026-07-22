/**
 * Distributed Configuration Cache with Redis
 * 
 * 分布式配置缓存 - Redis 集群支持 + 读写分离
 */

import Redis, { Cluster, RedisOptions } from 'ioredis';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ConfigRedisCache');

// ==================== 缓存配置 ====================

export interface RedisCacheConfig {
  // 集群模式
  clusterEnabled: boolean;
  clusterNodes?: string[];
  
  // 单节点模式
  host?: string;
  port?: number;
  password?: string;
  database?: number;
  
  // 连接池
  minConnections?: number;
  maxConnections?: number;
  
  // 缓存策略
  defaultTtlSeconds?: number;
  enableReadReplicas?: boolean;
  replicaUrls?: string[];
  
  // 性能优化
  enablePipeline?: boolean;
  pipelineBatchSize?: number;
  enableCompression?: boolean;
  compressionThreshold?: number;
  
  // 故障处理
  retryStrategy?: {
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier: number;
  };
  fallbackToMemory?: boolean;
}

const DEFAULT_CONFIG: RedisCacheConfig = {
  clusterEnabled: false,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  database: parseInt(process.env.REDIS_DB || '0', 10),
  
  minConnections: 5,
  maxConnections: 50,
  
  defaultTtlSeconds: 3600,
  enableReadReplicas: false,
  replicaUrls: [],
  
  enablePipeline: true,
  pipelineBatchSize: 100,
  enableCompression: true,
  compressionThreshold: 1024,
  
  retryStrategy: {
    maxRetries: 3,
    retryDelayMs: 100,
    backoffMultiplier: 2,
  },
  fallbackToMemory: true,
};

// ==================== 缓存条目 ====================

interface CacheEntry<T = any> {
  value: T;
  version: number;
  createdAt: number;
  expiresAt: number;
  compressed?: boolean;
}

// ==================== Redis 缓存服务 ====================

export class RedisConfigCache {
  private master: Redis | Cluster | null = null;
  private replicas: Redis[] = [];
  private memoryCache: Map<string, CacheEntry> = new Map();
  private config: RedisCacheConfig;
  private isInitialized: boolean = false;
  
  // 统计
  private stats = {
    hits: 0,
    misses: 0,
    errors: 0,
    writes: 0,
    deletes: 0,
  };

  constructor(config: Partial<RedisCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化 Redis 连接
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.clusterEnabled) {
        await this.initializeCluster();
      } else {
        await this.initializeStandalone();
      }
      
      this.isInitialized = true;
      logger.info('Redis cache initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Redis cache');
      if (!this.config.fallbackToMemory) {
        throw error;
      }
    }
  }

  /**
   * 集群模式初始化
   */
  private async initializeCluster(): Promise<void> {
    const nodes = this.config.clusterNodes || [
      { host: this.config.host!, port: this.config.port! },
    ];

    this.master = new Cluster(nodes) as any;

    this.master!.on('error', (err) => {
      logger.error({ err }, 'Redis cluster error');
      this.stats.errors++;
    });

    // 等待集群就绪
    await this.master!.ping();
  }

  /**
   * 单节点模式初始化
   */
  private async initializeStandalone(): Promise<void> {
    const masterOptions = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.database,
      
      retryStrategy: (times: number) => {
        if (times > (this.config.retryStrategy?.maxRetries || 3)) {
          return null;
        }
        const delay = (this.config.retryStrategy?.retryDelayMs || 100) * 
          Math.pow(this.config.retryStrategy?.backoffMultiplier || 2, times - 1);
        return delay;
      },
      
      // 性能优化
      enableOfflineQueue: true,
      lazyConnect: false,
      connectTimeout: 10000,
      commandTimeout: 5000,
    };

    this.master = new Redis(masterOptions);
    
    this.master.on('error', (err) => {
      logger.error({ err }, 'Redis master error');
      this.stats.errors++;
    });

    // 初始化读写分离 (如果启用)
    if (this.config.enableReadReplicas && this.config.replicaUrls?.length) {
      await this.initializeReplicas();
    }

    await this.master.ping();
  }

  /**
   * 初始化读副本
   */
  private async initializeReplicas(): Promise<void> {
    for (const url of this.config.replicaUrls || []) {
      const replica = new Redis(url, {
        retryStrategy: () => null, // 副本不重试
        maxRetriesPerRequest: 1,
      });
      
      replica.on('error', (err) => {
        logger.warn({ err, url }, 'Replica error');
      });
      
      this.replicas.push(replica);
    }
    
    logger.info({ count: this.replicas.length }, 'Read replicas initialized');
  }

  /**
   * 获取缓存 (自动读写分离)
   */
  async get<T = any>(key: string): Promise<T | null> {
    // 1. 尝试本地内存缓存
    const memEntry = this.memoryCache.get(key);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      this.stats.hits++;
      return this.decompress<T>(memEntry.value, memEntry.compressed);
    }

    if (!this.master) {
      this.stats.misses++;
      return null;
    }

    try {
      // 2. 读写分离: 优先读副本
      const redis = this.replicas.length > 0 
        ? this.replicas[Math.floor(Math.random() * this.replicas.length)]
        : this.master;

      const data = await redis.get(`orion:config:${key}`);
      
      if (data) {
        const entry: CacheEntry<T> = JSON.parse(data);
        
        // 回填本地内存
        this.memoryCache.set(key, entry);
        
        this.stats.hits++;
        return this.decompress<T>(entry.value, entry.compressed);
      }
      
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error({ error, key }, 'Redis get error');
      this.stats.errors++;
      
      // 降级到内存
      return memEntry ? this.decompress<T>(memEntry.value, memEntry.compressed) : null;
    }
  }

  /**
   * 批量获取
   */
  async mget<T = any>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    
    if (!this.master || keys.length === 0) {
      return result;
    }

    try {
      // 使用 pipeline 批量获取
      if (this.config.enablePipeline && keys.length > 1) {
        const pipeline = this.master.pipeline();
        
        for (const key of keys) {
          pipeline.get(`orion:config:${key}`);
        }
        
        const values = await pipeline.exec();
        
        if (values) {
          for (let i = 0; i < keys.length; i++) {
            const [err, data] = values[i];
            if (!err && data) {
              const entry: CacheEntry<T> = JSON.parse(data as string);
              result.set(keys[i], this.decompress<T>(entry.value, entry.compressed));
              this.memoryCache.set(keys[i], entry);
            }
          }
        }
      } else {
        // 单个获取
        for (const key of keys) {
          const value = await this.get<T>(key);
          if (value !== null) {
            result.set(key, value);
          }
        }
      }
    } catch (error) {
      logger.error({ error, keys: keys.length }, 'Redis mget error');
      this.stats.errors++;
    }

    return result;
  }

  /**
   * 设置缓存
   */
  async set<T = any>(
    key: string, 
    value: T, 
    ttlSeconds?: number
  ): Promise<void> {
    const ttl = ttlSeconds || this.config.defaultTtlSeconds || 3600;
    const now = Date.now();
    
    const { compressed, data } = this.compress(value);
    
    const entry: CacheEntry<any> = {
      value: data,
      version: 1,
      createdAt: now,
      expiresAt: now + (ttl * 1000),
      compressed,
    };

    // 写入本地内存
    this.memoryCache.set(key, entry);

    if (!this.master) {
      return;
    }

    try {
      await this.master.set(
        `orion:config:${key}`,
        JSON.stringify(entry),
        'EX',
        ttl
      );
      
      this.stats.writes++;
    } catch (error) {
      logger.error({ error, key }, 'Redis set error');
      this.stats.errors++;
    }
  }

  /**
   * 批量设置
   */
  async mset<T = any>(
    entries: Array<{ key: string; value: T; ttlSeconds?: number }>
  ): Promise<void> {
    if (!this.master || entries.length === 0) {
      return;
    }

    try {
      if (this.config.enablePipeline && entries.length > 1) {
        const pipeline = this.master.pipeline();
        
        for (const { key, value, ttlSeconds } of entries) {
          const entry = {
            value,
            version: 1,
            createdAt: Date.now(),
            expiresAt: Date.now() + ((ttlSeconds || this.config.defaultTtlSeconds || 3600) * 1000),
          };
          
          pipeline.set(
            `orion:config:${key}`,
            JSON.stringify(entry),
            'EX',
            ttlSeconds || this.config.defaultTtlSeconds || 3600
          );
          
          this.memoryCache.set(key, entry);
        }
        
        await pipeline.exec();
        this.stats.writes += entries.length;
      } else {
        for (const { key, value, ttlSeconds } of entries) {
          await this.set(key, value, ttlSeconds);
        }
      }
    } catch (error) {
      logger.error({ error, count: entries.length }, 'Redis mset error');
      this.stats.errors++;
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    // 删除本地内存
    this.memoryCache.delete(key);

    if (!this.master) {
      return;
    }

    try {
      await this.master.del(`orion:config:${key}`);
      this.stats.deletes++;
    } catch (error) {
      logger.error({ error, key }, 'Redis delete error');
      this.stats.errors++;
    }
  }

  /**
   * 批量删除
   */
  async mdelete(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.memoryCache.delete(key);
    }

    if (!this.master || keys.length === 0) {
      return;
    }

    try {
      const pipeline = this.master.pipeline();
      
      for (const key of keys) {
        pipeline.del(`orion:config:${key}`);
      }
      
      await pipeline.exec();
      this.stats.deletes += keys.length;
    } catch (error) {
      logger.error({ error, count: keys.length }, 'Redis mdelete error');
      this.stats.errors++;
    }
  }

  /**
   * 原子递增
   */
  async incr(key: string, delta: number = 1): Promise<number> {
    if (!this.master) {
      return 0;
    }

    try {
      const result = await this.master.incrby(`orion:config:${key}`, delta);
      return result;
    } catch (error) {
      logger.error({ error, key }, 'Redis incr error');
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      total,
      hitRate: hitRate.toFixed(2) + '%',
      memoryCacheSize: this.memoryCache.size,
      connected: this.isInitialized,
    };
  }

  /**
   * 清除所有缓存
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.master) {
      const keys = await this.master.keys('orion:config:*');
      if (keys.length > 0) {
        await this.master.del(...keys);
      }
    }
    
    logger.info('Cache cleared');
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.master) {
      await this.master.quit();
    }
    
    for (const replica of this.replicas) {
      await replica.quit();
    }
    
    this.memoryCache.clear();
    this.isInitialized = false;
    
    logger.info('Redis cache closed');
  }

  // ==================== 私有方法 ====================

  private compress<T>(value: T): { compressed: boolean; data: T | string } {
    if (!this.config.enableCompression) {
      return { compressed: false, data: value };
    }

    const str = JSON.stringify(value);
    
    // 小值不压缩
    if (str.length < (this.config.compressionThreshold || 1024)) {
      return { compressed: false, data: value };
    }

    // 使用 zlib 压缩
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(str, { level: 6 });
    
    return {
      compressed: true,
      data: compressed.toString('base64'),
    };
  }

  private decompress<T>(value: T, compressed?: boolean): T {
    if (!compressed || typeof value !== 'string') {
      return value;
    }

    const zlib = require('zlib');
    const decompressed = zlib.inflateSync(Buffer.from(value, 'base64'));
    
    return JSON.parse(decompressed.toString());
  }
}

// 单例
export const redisConfigCache = new RedisConfigCache();

export default RedisConfigCache;