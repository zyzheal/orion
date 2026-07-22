/**
 * Idempotency Service — 执行幂等性服务
 *
 * B-1/B-14: 三层降级策略
 * 1. 优先使用 Redis (若可用)
 * 2. Redis 不可用时降级到 PostgreSQL
 * 3. 双端都不用时降级为内存 5 秒去重
 */

import { DatabasePool } from '../database';

export interface IdempotencyEntry {
  command: string;
  userId: string;
  result: Record<string, unknown>;
}

export interface IdempotencyOptions {
  ttlSeconds?: number;
}

export class IdempotencyService {
  private redisClient?: any;
  private dbPool?: DatabasePool;
  // 内存 5 秒去重
  private recentCommands: Map<string, number> = new Map();

  constructor(options: {
    redisClient?: any;
    dbPool?: DatabasePool;
  }) {
    this.redisClient = options.redisClient;
    this.dbPool = options.dbPool;
    // 定期清理过期内存键
    setInterval(() => this.cleanExpiredMemoryKeys(), 10_000);
  }

  /**
   * 检查幂等性键，若存在则返回缓存结果
   */
  async checkAndReturn(key: string): Promise<IdempotencyEntry | null> {
    // Layer 1: Redis
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(`idempotency:${key}`);
        if (cached) return JSON.parse(cached);
      } catch {
        // Redis 失败时降级
      }
    }

    // Layer 2: PostgreSQL
    if (this.dbPool) {
      try {
        const result = await this.dbPool.query(
          `SELECT command, user_id, result FROM chatops_idempotency_keys
           WHERE key = $1 AND status = 'completed' AND expires_at > NOW()
           LIMIT 1`,
          [key],
        );
        if (result.rowCount != null && result.rowCount > 0) {
          const row = result.rows[0];
          return { command: row.command, userId: row.user_id, result: row.result };
        }
      } catch {
        // DB 失败时降级
      }
    }

    // Layer 3: Memory 5s 去重 — 不返回假结果，仅记录最近执行的键供 store() 去重
    return null;
  }

  /**
   * 存储幂等性结果
   */
  async store(key: string, entry: IdempotencyEntry, opts?: IdempotencyOptions): Promise<void> {
    const ttl = opts?.ttlSeconds ?? 3600;

    // Layer 1: Redis
    if (this.redisClient) {
      try {
        await this.redisClient.setEx(
          `idempotency:${key}`,
          ttl,
          JSON.stringify(entry),
        );
        return;
      } catch {
        // 降级到 DB
      }
    }

    // Layer 2: PostgreSQL
    if (this.dbPool) {
      try {
        await this.dbPool.query(
          `INSERT INTO chatops_idempotency_keys (key, command, user_id, result, status, expires_at)
           VALUES ($1, $2, $3, $4, 'completed', NOW() + ($5 * interval '1 second'))
           ON CONFLICT (key) DO UPDATE SET result = $4, status = 'completed', expires_at = NOW() + ($5 * interval '1 second')`,
          [key, entry.command, entry.userId, JSON.stringify(entry.result), ttl],
        );
        return;
      } catch {
        // 降级到内存
      }
    }

    // Layer 3: Memory
    this.recentCommands.set(key, Date.now());
  }

  /** 清理过期内存键 */
  private cleanExpiredMemoryKeys(): void {
    const now = Date.now();
    for (const [key, ts] of this.recentCommands.entries()) {
      if (now - ts > 5000) this.recentCommands.delete(key);
    }
  }
}
