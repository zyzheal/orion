/**
 * FallbackStorageRepository — PostgreSQL 持久化层
 *
 * Table: fallback_storage
 *   tenant_id   — 租户隔离
 *   prefix      — 命名空间（FallbackStorageService.prefix）
 *   key         — 原始 key（tenant_id + prefix 联合唯一）
 *   value       — JSONB 存储的任意值
 *   ttl_ms      — 过期时间（毫秒）
 *   expires_at  — 绝对过期时间（由 DB trigger 或应用层计算）
 *   created_at  — 插入时间
 *   updated_at  — 更新时间
 */

import { DatabasePool } from '../services/database';

export interface FallbackStorageRow {
  id: string;
  tenant_id: string;
  prefix: string;
  key: string;
  value: Record<string, any>;
  ttl_ms: number;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export class FallbackStorageRepository {
  constructor(private pool: DatabasePool) {}

  /**
   * upsert — 插入或更新条目。
   * expires_at 由 ttl_ms 动态计算。
   */
  async upsert(
    tenantId: string,
    prefix: string,
    key: string,
    value: Record<string, any>,
    ttlMs: number = 300_000,
  ): Promise<FallbackStorageRow> {
    const expiresAt = new Date(Date.now() + ttlMs);

    const result = await this.pool.query(
      `INSERT INTO fallback_storage (tenant_id, prefix, key, value, ttl_ms, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (tenant_id, prefix, key) DO UPDATE SET
         value = $4,
         ttl_ms = $5,
         expires_at = $6,
         updated_at = NOW()
       RETURNING *`,
      [tenantId, prefix, key, value, ttlMs, expiresAt]
    );

    return result.rows[0];
  }

  /**
   * find — 根据 tenant_id + prefix + key 查询单条。
   * 只返回未过期的记录。
   */
  async find(tenantId: string, prefix: string, key: string): Promise<FallbackStorageRow | null> {
    const result = await this.pool.query(
      `SELECT * FROM fallback_storage
       WHERE tenant_id = $1 AND prefix = $2 AND key = $3 AND expires_at > NOW()`,
      [tenantId, prefix, key]
    );

    return result.rows[0] || null;
  }

  /**
   * findByPrefix — 查询某个 prefix 下的所有未过期记录。
   */
  async findByPrefix(tenantId: string, prefix: string): Promise<FallbackStorageRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM fallback_storage
       WHERE tenant_id = $1 AND prefix = $2 AND expires_at > NOW()
       ORDER BY created_at`,
      [tenantId, prefix]
    );

    return result.rows;
  }

  /**
   * delete — 删除单条记录。
   */
  async delete(tenantId: string, prefix: string, key: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM fallback_storage WHERE tenant_id = $1 AND prefix = $2 AND key = $3',
      [tenantId, prefix, key]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * deleteByPrefix — 删除某个 prefix 下的所有记录。
   */
  async deleteByPrefix(tenantId: string, prefix: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM fallback_storage WHERE tenant_id = $1 AND prefix = $2',
      [tenantId, prefix]
    );

    return result.rowCount ?? 0;
  }

  /**
   * cleanupExpired — 清理全表已过期记录（可由定时任务调用）。
   * @returns 清理的记录数
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM fallback_storage WHERE expires_at < NOW()'
    );

    return result.rowCount ?? 0;
  }

  /**
   * count — 统计某个 prefix 下的未过期记录数。
   */
  async count(tenantId: string, prefix: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) AS cnt FROM fallback_storage
       WHERE tenant_id = $1 AND prefix = $2 AND expires_at > NOW()`,
      [tenantId, prefix]
    );

    return parseInt(result.rows[0]?.cnt ?? '0', 10);
  }
}
