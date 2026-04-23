/**
 * Distributed Lock Service
 * 分布式锁服务
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface LockOptions {
  ttl?: number; // 锁的生存时间（毫秒）
  retryCount?: number; // 重试次数
  retryDelay?: number; // 重试延迟（毫秒）
}

export interface Lock {
  key: string;
  acquiredAt: Date;
  ttl?: number;
  release(): Promise<void>;
}

export class DistributedLockService {
  private redis: any;
  private defaultTtl = 30000; // 30秒默认锁超时
  private defaultRetryCount = 3;
  private defaultRetryDelay = 1000; // 1秒重试延迟

  constructor(redisClient?: any) {
    this.redis = redisClient || this.createRedisClient();
  }

  /**
   * 获取分布式锁
   */
  async acquireLock(key: string, options: LockOptions = {}): Promise<Lock> {
    const {
      ttl = this.defaultTtl,
      retryCount = this.defaultRetryCount,
      retryDelay = this.defaultRetryDelay
    } = options;

    const lockKey = `lock:${key}`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    const acquiredAt = new Date();

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < retryCount) {
      try {
        // 使用 SET 命令获取锁，NX 表示不存在才设置，EX 设置过期时间
        const result = await this.redis.set(lockKey, lockValue, 'PX', ttl, 'NX');
        
        if (result === 'OK') {
          logger.info({
            key,
            lockValue,
            ttl,
            attempt: attempt + 1
          }, 'Lock acquired successfully');

          return {
            key,
            acquiredAt,
            ttl,
            release: async () => {
              await this.releaseLock(lockKey, lockValue);
            }
          };
        }

        // 锁已被占用，等待重试
        attempt++;
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        lastError = error as Error;
        logger.warn({
          key,
          attempt: attempt + 1,
          error: error.message
        }, 'Failed to acquire lock');
        
        attempt++;
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw new Error(`Failed to acquire lock after ${retryCount} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * 释放锁
   */
  async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    try {
      // 使用 Lua 脚本确保只有锁的持有者才能释放锁
      const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(luaScript, 1, lockKey, lockValue);
      
      if (result === 1) {
        logger.info({ lockKey, lockValue }, 'Lock released successfully');
      } else {
        logger.warn({ lockKey, lockValue }, 'Failed to release lock - lock not found or value mismatch');
      }
    } catch (error) {
      logger.error({
        lockKey,
        lockValue,
        error: error.message
      }, 'Failed to release lock');
      throw error;
    }
  }

  /**
   * 尝试获取锁（不重试）
   */
  async tryLock(key: string, ttl?: number): Promise<Lock | null> {
    const lockKey = `lock:${key}`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    
    try {
      const result = await this.redis.set(lockKey, lockValue, 'PX', ttl || this.defaultTtl, 'NX');
      
      if (result === 'OK') {
        return {
          key,
          acquiredAt: new Date(),
          ttl: ttl || this.defaultTtl,
          release: async () => {
            await this.releaseLock(lockKey, lockValue);
          }
        };
      }
      
      return null;
    } catch (error) {
      logger.error({
        key,
        error: error.message
      }, 'Failed to try lock');
      throw error;
    }
  }

  /**
   * 检查锁是否存在
   */
  async isLocked(key: string): Promise<boolean> {
    try {
      const lockKey = `lock:${key}`;
      const result = await this.redis.exists(lockKey);
      return result === 1;
    } catch (error) {
      logger.error({
        key,
        error: error.message
      }, 'Failed to check lock');
      return false;
    }
  }

  /**
   * 获取锁信息
   */
  async getLockInfo(key: string): Promise<{ exists: boolean; ttl?: number } | null> {
    try {
      const lockKey = `lock:${key}`;
      const result = await this.redis.ttl(lockKey);
      
      if (result === -2) {
        return { exists: false };
      } else if (result === -1) {
        return { exists: true };
      } else {
        return { exists: true, ttl: result * 1000 };
      }
    } catch (error) {
      logger.error({
        key,
        error: error.message
      }, 'Failed to get lock info');
      return null;
    }
  }

  /**
   * 自动续期锁
   */
  async renewLock(lock: Lock, additionalTtl?: number): Promise<void> {
    const lockKey = `lock:${lock.key}`;
    const newTtl = additionalTtl || lock.ttl || this.defaultTtl;
    
    try {
      // 使用 PEXPIRE 命令续期
      const result = await this.redis.pexpire(lockKey, newTtl);
      
      if (result === 1) {
        logger.info({
          key: lock.key,
          newTtl
        }, 'Lock renewed successfully');
      } else {
        throw new Error('Failed to renew lock - lock may have expired');
      }
    } catch (error) {
      logger.error({
        key: lock.key,
        error: error.message
      }, 'Failed to renew lock');
      throw error;
    }
  }

  /**
   * 执行带锁的操作
   */
  async executeWithLock<T>(
    key: string,
    operation: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T> {
    const lock = await this.acquireLock(key, options);
    
    try {
      const result = await operation();
      return result;
    } finally {
      await lock.release();
    }
  }

  /**
   * 创建 Redis 客户端
   */
  private createRedisClient(): any {
    try {
      const redis = require('redis');
      return redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
    } catch (error) {
      logger.warn('Redis client not available, using mock implementation');
      return this.createMockRedisClient();
    }
  }

  /**
   * 创建模拟 Redis 客户端（用于测试）
   */
  private createMockRedisClient(): any {
    const locks = new Map();
    
    return {
      async set(key: string, value: string, px?: string, ttl?: string, nx?: string): Promise<string> {
        if (nx && locks.has(key)) {
          return null;
        }
        locks.set(key, value);
        if (ttl) {
          setTimeout(() => locks.delete(key), parseInt(ttl));
        }
        return 'OK';
      },
      
      async get(key: string): Promise<string> {
        return locks.get(key) || null;
      },
      
      async del(key: string): Promise<number> {
        return locks.delete(key) ? 1 : 0;
      },
      
      async exists(key: string): Promise<number> {
        return locks.has(key) ? 1 : 0;
      },
      
      async ttl(key: string): Promise<number> {
        if (!locks.has(key)) return -2;
        return -1; // 模拟永不过期
      },
      
      async pexpire(key: string, ttl: number): Promise<number> {
        if (!locks.has(key)) return 0;
        return 1;
      },
      
      async eval(script: string, numKeys: number, ...args: any[]): Promise<any> {
        const [key, value] = args;
        if (locks.get(key) === value) {
          locks.delete(key);
          return 1;
        }
        return 0;
      }
    };
  }
}