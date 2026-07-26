/**
 * RunnerCacheRepository - Runner 缓存元数据的数据访问层
 *
 * 使用 PostgreSQL 存储缓存元数据，支持：
 * - 乐观锁（version 字段）防止并发更新冲突
 * - 缓存键版本化支持
 * - 前缀匹配查询优化
 */

import { Pool } from 'pg';
import type { CacheEntry } from '../services/RunnerCacheService';

export interface CacheMetadataRow {
  id: string;
  cache_key: string;
  cache_hash: string;
  version: number;
  paths: string[];
  size_bytes: number;
  run_id: string;
  stage_id: string;
  created_at: Date;
  expires_at: Date;
  is_active: boolean;
}

export class RunnerCacheRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * 插入新的缓存元数据
   */
  async insert(entry: CacheEntry, hash: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO runner_cache_metadata (cache_key, cache_hash, paths, size_bytes, run_id, stage_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (cache_hash, is_active) DO UPDATE
       SET paths = EXCLUDED.paths,
           size_bytes = EXCLUDED.size_bytes,
           run_id = EXCLUDED.run_id,
           stage_id = EXCLUDED.stage_id,
           expires_at = EXCLUDED.expires_at,
           version = runner_cache_metadata.version + 1`,
      [
        entry.key,
        hash,
        entry.paths,
        entry.size,
        entry.runId,
        entry.stageId,
        entry.expiresAt,
      ]
    );
  }

  /**
   * 通过哈希精确查找缓存元数据
   */
  async findByHash(hash: string): Promise<CacheEntry | null> {
    const result = await this.pool.query<CacheMetadataRow>(
      `SELECT * FROM runner_cache_metadata
       WHERE cache_hash = $1 AND is_active = TRUE AND expires_at > NOW()
       LIMIT 1`,
      [hash]
    );

    if (result.rows.length === 0) return null;

    return this.toCacheEntry(result.rows[0]);
  }

  /**
   * 通过前缀查找匹配的缓存元数据（用于 restoreKeys 前缀匹配）
   */
  async findByPrefix(prefix: string): Promise<CacheEntry[]> {
    const result = await this.pool.query<CacheMetadataRow>(
      `SELECT * FROM runner_cache_metadata
       WHERE cache_key LIKE $1 AND is_active = TRUE AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [`${prefix}%`]
    );

    return result.rows.map(row => this.toCacheEntry(row));
  }

  /**
   * 通过哈希前缀查找（用于哈希值的前缀匹配）
   */
  async findByHashPrefix(hashPrefix: string): Promise<CacheEntry[]> {
    const result = await this.pool.query<CacheMetadataRow>(
      `SELECT * FROM runner_cache_metadata
       WHERE cache_hash LIKE $1 AND is_active = TRUE AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [`${hashPrefix}%`]
    );

    return result.rows.map(row => this.toCacheEntry(row));
  }

  /**
   * 查询过期缓存条目
   */
  async findExpired(): Promise<CacheEntry[]> {
    const result = await this.pool.query<CacheMetadataRow>(
      `SELECT * FROM runner_cache_metadata
       WHERE expires_at < NOW() AND is_active = TRUE
       ORDER BY expires_at ASC`
    );

    return result.rows.map(row => this.toCacheEntry(row));
  }

  /**
   * 使用乐观锁更新缓存元数据
   * @returns 是否更新成功（version 不匹配时返回 false）
   */
  async updateWithOptimisticLock(
    cacheHash: string,
    updates: Partial<CacheEntry>,
    expectedVersion: number
  ): Promise<boolean> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.paths) {
      setClauses.push(`paths = $${paramIndex++}`);
      values.push(updates.paths);
    }
    if (updates.size !== undefined) {
      setClauses.push(`size_bytes = $${paramIndex++}`);
      values.push(updates.size);
    }
    if (updates.expiresAt) {
      setClauses.push(`expires_at = $${paramIndex++}`);
      values.push(updates.expiresAt);
    }

    if (setClauses.length === 0) return true;

    // 添加 version 检查和 runId/stageId 条件
    setClauses.push(`version = version + 1`);
    values.push(cacheHash);
    values.push(expectedVersion);

    const sql = `UPDATE runner_cache_metadata SET ${setClauses.join(', ')}
                 WHERE cache_hash = $${paramIndex++} AND version = $${paramIndex} AND is_active = TRUE`;

    const result = await this.pool.query(sql, values);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 软删除缓存元数据
   */
  async softDelete(cacheHash: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE runner_cache_metadata SET is_active = FALSE WHERE cache_hash = $1`,
      [cacheHash]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 清理过期缓存元数据
   * @returns 被清理的数量
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM runner_cache_metadata WHERE expires_at < NOW() AND is_active = TRUE`
    );
    return result.rowCount ?? 0;
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    expiredCount: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    const result = await this.pool.query<{
      total_entries: number;
      total_size: number;
      expired_count: number;
      oldest_entry: string | null;
      newest_entry: string | null;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE expires_at > NOW()) as total_entries,
         COALESCE(SUM(size_bytes) FILTER (WHERE expires_at > NOW()), 0) as total_size,
         COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_count,
         MIN(created_at) FILTER (WHERE expires_at > NOW()) as oldest_entry,
         MAX(created_at) FILTER (WHERE expires_at > NOW()) as newest_entry
       FROM runner_cache_metadata
       WHERE is_active = TRUE`
    );

    const row = result.rows[0];
    return {
      totalEntries: Number(row.total_entries),
      totalSize: Number(row.total_size),
      expiredCount: Number(row.expired_count),
      oldestEntry: row.oldest_entry,
      newestEntry: row.newest_entry,
    };
  }

  /**
   * 记录缓存命中统计
   */
  async recordHit(cacheHash: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO runner_cache_stats (cache_key_hash, hit_count, last_hit_at, updated_at)
       VALUES ($1, 1, NOW(), NOW())
       ON CONFLICT (cache_key_hash) DO UPDATE
       SET hit_count = runner_cache_stats.hit_count + 1,
           last_hit_at = NOW(),
           updated_at = NOW()`,
      [cacheHash]
    );
  }

  /**
   * 记录缓存未命中
   */
  async recordMiss(cacheHash: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO runner_cache_stats (cache_key_hash, last_miss_at, updated_at)
       VALUES ($1, NOW(), NOW())
       ON CONFLICT (cache_key_hash) DO UPDATE
       SET last_miss_at = NOW(),
           updated_at = NOW()`,
      [cacheHash]
    );
  }

  /**
   * 列出所有活跃的缓存元数据
   */
  async listAll(): Promise<CacheEntry[]> {
    const result = await this.pool.query<CacheMetadataRow>(
      `SELECT * FROM runner_cache_metadata WHERE is_active = TRUE ORDER BY created_at DESC`
    );

    return result.rows.map(row => this.toCacheEntry(row));
  }

  private toCacheEntry(row: CacheMetadataRow): CacheEntry {
    return {
      key: row.cache_key,
      paths: row.paths,
      size: row.size_bytes,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      hash: row.cache_hash,
      runId: row.run_id,
      stageId: row.stage_id,
    };
  }
}
