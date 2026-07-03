/**
 * Rate Limit Service
 *
 * Manages ChatOps rate limit configurations and enforcement using
 * Redis Sorted Set sliding window algorithm.
 *
 * Sliding Window Algorithm:
 * - Key: chatops:ratelimit:{scope}:{id}
 * - Score: Unix timestamp (seconds)
 * - Member: unique request ID
 * - Window: ZREMRANGEBYSCORE + ZCARD + ZADD in pipeline
 */

import { DatabasePool } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { RedisCache } from '../redis-cache';
import { createLogger } from '../../utils/logger';

const logger = createLogger('RateLimitService');

export interface RateLimitConfig {
  id: string;
  target_type: 'user' | 'group' | 'command';
  target_id: string | null;
  command_name: string | null;
  limit_type: 'minute' | 'hour' | 'day';
  limit_count: number;
  window_seconds: number;
  description: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRateLimitInput {
  target_type: 'user' | 'group' | 'command';
  target_id?: string;
  command_name?: string;
  limit_type: 'minute' | 'hour' | 'day';
  limit_count: number;
  window_seconds: number;
  description?: string;
  enabled?: boolean;
}

export interface UpdateRateLimitInput {
  target_type?: 'user' | 'group' | 'command';
  target_id?: string;
  command_name?: string;
  limit_type?: 'minute' | 'hour' | 'day';
  limit_count?: number;
  window_seconds?: number;
  description?: string;
  enabled?: boolean;
}

export class RateLimitService {
  constructor(
    private pool: DatabasePool,
    private redis?: RedisCache | null,
  ) {}

  async getAll(): Promise<RateLimitConfig[]> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_rate_limits ORDER BY target_type, command_name'
    );
    return result.rows;
  }

  async getById(id: string): Promise<RateLimitConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_rate_limits WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(input: CreateRateLimitInput): Promise<RateLimitConfig> {
    const id = uuidv4();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO chatops_rate_limits
       (id, target_type, target_id, command_name, limit_type, limit_count, window_seconds, description, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, input.target_type, input.target_id || null, input.command_name || null,
       input.limit_type, input.limit_count, input.window_seconds,
       input.description || '', input.enabled ?? true, now, now]
    );

    return this.getById(id) as Promise<RateLimitConfig>;
  }

  async update(id: string, input: UpdateRateLimitInput): Promise<RateLimitConfig | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (input.target_type !== undefined) { updates.push(`target_type = $${pi++}`); params.push(input.target_type); }
    if (input.target_id !== undefined) { updates.push(`target_id = $${pi++}`); params.push(input.target_id || null); }
    if (input.command_name !== undefined) { updates.push(`command_name = $${pi++}`); params.push(input.command_name || null); }
    if (input.limit_type !== undefined) { updates.push(`limit_type = $${pi++}`); params.push(input.limit_type); }
    if (input.limit_count !== undefined) { updates.push(`limit_count = $${pi++}`); params.push(input.limit_count); }
    if (input.window_seconds !== undefined) { updates.push(`window_seconds = $${pi++}`); params.push(input.window_seconds); }
    if (input.description !== undefined) { updates.push(`description = $${pi++}`); params.push(input.description); }
    if (input.enabled !== undefined) { updates.push(`enabled = $${pi++}`); params.push(input.enabled); }

    if (updates.length > 0) {
      updates.push(`updated_at = $${pi++}`);
      params.push(new Date(), id);
      await this.pool.query(
        `UPDATE chatops_rate_limits SET ${updates.join(', ')} WHERE id = $${pi}`,
        params
      );
    }

    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM chatops_rate_limits WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if a command execution exceeds rate limits using Redis Sorted Set sliding window.
   *
   * @param userId - The user executing the command
   * @param commandName - The command being executed
   * @returns { allowed, remaining?, resetAt? }
   */
  async checkLimit(
    userId: string,
    commandName: string,
  ): Promise<{ allowed: boolean; remaining?: number; resetAt?: Date }> {
    const limits = await this.pool.query(
      `SELECT * FROM chatops_rate_limits
       WHERE enabled = true
       AND (
         (target_type = 'command' AND command_name = $1)
         OR (target_type = 'user' AND target_id IS NULL)
         OR (target_type = 'user' AND target_id = $2)
       )`,
      [commandName, userId],
    );

    if (limits.rows.length === 0) {
      return { allowed: true };
    }

    // Fallback when Redis is not available: allow all but log a warning
    if (!this.redis || !this.redis.isHealthy()) {
      logger.warn({ userId, commandName }, 'Rate limit check skipped: Redis not available');
      return { allowed: true };
    }

    const now = Date.now();
    let minResetAt: Date | undefined;

    for (const limit of limits.rows) {
      const windowSeconds = limit.window_seconds;
      const limitCount = limit.limit_count;
      const windowStart = now - windowSeconds * 1000;

      // Scope key: per-user+command or per-user
      const scopeKey = limit.target_type === 'command'
        ? `chatops:ratelimit:user:${userId}:command:${commandName}`
        : `chatops:ratelimit:user:${userId}`;

      const client = this.redis.getClient();
      if (!client) {
        logger.warn({ scopeKey }, 'Rate limit Redis client unavailable');
        continue;
      }

      // Sliding window: remove expired entries, then count current window
      // Pipeline: ZREMRANGEBYSCORE -> ZCARD -> ZADD -> ZEXPIRE
      const pipeline = client.pipeline();
      pipeline.zremrangebyscore(scopeKey, 0, windowStart);
      pipeline.zcard(scopeKey);
      pipeline.zadd(scopeKey, now, `${now}:${uuidv4()}`);
      pipeline.expire(scopeKey, windowSeconds + 1);

      const results = await pipeline.exec() as [Error, number][];

      const count = results[1][1] as number;

      if (count >= limitCount) {
        // Calculate reset time: score of the oldest entry in window + windowSeconds
        const oldest = await client.zrangebyscore(
          scopeKey,
          windowStart,
          now,
          'LIMIT',
          0,
          1,
        );

        const resetAt = oldest.length > 0
          ? new Date(parseInt(oldest[0].split(':')[0]) + windowSeconds * 1000)
          : new Date(now + windowSeconds * 1000);

        logger.warn(
          { userId, commandName, limitType: limit.limit_type, count, limitCount, resetAt },
          'Rate limit exceeded',
        );

        return {
          allowed: false,
          remaining: 0,
          resetAt,
        };
      }

      // Track the earliest reset across all matching limits
      if (!minResetAt || resetAt < minResetAt) {
        minResetAt = resetAt;
      }
    }

    const remaining = limits.rows[0] ? limits.rows[0].limit_count : 0;
    return {
      allowed: true,
      remaining,
      resetAt: minResetAt,
    };
  }
}
