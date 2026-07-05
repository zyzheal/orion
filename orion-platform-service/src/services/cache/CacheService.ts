/**
 * CacheService - Redis-backed cache layer for high-frequency read operations
 *
 * Wraps RedisCache with JSON serialization, graceful degradation,
 * and cache-aside pattern (getOrLoad).
 *
 * When Redis is unavailable, all operations become no-ops — the caller
 * should fall back to the database directly.
 */

import { RedisCache } from '../redis-cache';

export class CacheServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CacheServiceError';
  }
}

export class CacheService {
  private redis: RedisCache | null;
  private defaultTtl: number;

  /**
   * @param redis - RedisCache instance, or null to disable caching
   * @param defaultTtlSeconds - Default TTL for cache entries (default: 300s)
   */
  constructor(redis: RedisCache | null, defaultTtlSeconds: number = 300) {
    this.redis = redis;
    this.defaultTtl = defaultTtlSeconds;
  }

  /**
   * Get a cached value by key.
   * Returns null if Redis is unavailable, key doesn't exist, or data is corrupt.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis?.isHealthy()) return null;
    try {
      const data = await this.redis.get<string>(key);
      return data ? JSON.parse(data) : null;
    } catch {
      // JSON parse error or Redis error — treat as cache miss
      return null;
    }
  }

  /**
   * Set a cached value.
   * Failures are silently swallowed — cache write should never break the request.
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.redis?.isHealthy()) return;
    try {
      await this.redis.set(key, JSON.stringify(value), ttl || this.defaultTtl);
    } catch {
      // Cache write failure — don't fail the request
    }
  }

  /**
   * Delete a cached value by key.
   */
  async del(key: string): Promise<void> {
    if (!this.redis?.isHealthy()) return;
    try {
      await this.redis.delete(key);
    } catch {
      // ignore
    }
  }

  /**
   * Cache-aside pattern: try cache, if miss -> load from DB -> cache -> return.
   */
  async getOrLoad<T>(key: string, loader: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const data = await loader();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Invalidate all keys matching a pattern.
   * Uses Redis KEYS + DEL — be careful with large datasets.
   */
  async invalidate(pattern: string): Promise<void> {
    if (!this.redis?.isHealthy()) return;
    try {
      const client = this.redis.getClient();
      if (!client) return;
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch {
      // ignore
    }
  }
}
