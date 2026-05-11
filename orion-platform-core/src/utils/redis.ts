import type { Redis } from 'ioredis';

let _redis: Redis | null = null;

/**
 * 获取 Redis 客户端 (单例)
 */
export function getRedis(): Redis | null {
  if (!_redis && process.env.REDIS_URL) {
    // Lazy initialization using dynamic import (ESM safe)
    try {
      // Synchronous require fallback for ioredis (it's a CommonJS module)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const IORedis = require('ioredis');
      _redis = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: false,
      });

      _redis.on('error', (err) => {
        console.error('Redis error', err);
      });
    } catch {
      console.warn('ioredis not available, Redis functionality disabled');
      return null;
    }
  }
  return _redis;
}

/**
 * 关闭 Redis 连接
 */
export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
