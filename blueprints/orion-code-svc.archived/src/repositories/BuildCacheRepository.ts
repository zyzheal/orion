/**
 * Build Cache Repository - PostgreSQL 数据访问层
 */

import { Pool } from 'pg';
import {
  BuildCacheConfig,
  CacheEntry,
  CacheLevel,
  CacheStatus,
  CacheCleanupPolicy,
  CacheStorageType,
} from '../models/BuildCache';

type DatabasePool = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export class BuildCacheConfigRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<BuildCacheConfig | null> {
    const result = await this.pool.query('SELECT * FROM build_cache_configs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByLevelAndTarget(level: CacheLevel, targetId?: string): Promise<BuildCacheConfig | null> {
    let query = 'SELECT * FROM build_cache_configs WHERE level = $1';
    const params: any[] = [level];
    if (targetId) {
      params.push(targetId);
      query += ' AND target_id = $2';
    } else {
      query += ' AND target_id IS NULL';
    }
    query += ' ORDER BY created_at DESC LIMIT 1';
    const result = await this.pool.query(query, params);
    return result.rows[0] || null;
  }

  async createConfig(input: Partial<BuildCacheConfig>): Promise<BuildCacheConfig> {
    const result = await this.pool.query(
      'INSERT INTO build_cache_configs DEFAULT VALUES RETURNING *'
    );
    return result.rows[0];
  }

  async updateConfig(id: string, input: Record<string, unknown>): Promise<BuildCacheConfig | null> {
    const result = await this.pool.query(
      'UPDATE build_cache_configs SET updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAllWithFilters(options?: {
    level?: CacheLevel;
    status?: CacheStatus;
    limit?: number;
    offset?: number;
  }): Promise<BuildCacheConfig[]> {
    const result = await this.pool.query('SELECT * FROM build_cache_configs LIMIT 100');
    return result.rows;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM build_cache_configs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export class BuildCacheEntryRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<CacheEntry | null> {
    const result = await this.pool.query('SELECT * FROM build_cache_entries WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByCacheKey(configId: string, cacheKey: string): Promise<CacheEntry | null> {
    const result = await this.pool.query(
      'SELECT * FROM build_cache_entries WHERE config_id = $1 AND cache_key = $2',
      [configId, cacheKey]
    );
    return result.rows[0] || null;
  }

  async findByConfigId(configId: string, options?: { limit?: number; offset?: number }): Promise<CacheEntry[]> {
    const result = await this.pool.query(
      'SELECT * FROM build_cache_entries WHERE config_id = $1 LIMIT 100',
      [configId]
    );
    return result.rows;
  }

  async findAllWithFilter(options?: { limit?: number; offset?: number }): Promise<CacheEntry[]> {
    const result = await this.pool.query('SELECT * FROM build_cache_entries LIMIT 100');
    return result.rows;
  }

  async createEntry(input: Partial<CacheEntry>): Promise<CacheEntry> {
    const result = await this.pool.query(
      'INSERT INTO build_cache_entries DEFAULT VALUES RETURNING *'
    );
    return result.rows[0];
  }

  async recordHit(id: string): Promise<CacheEntry | null> {
    const result = await this.pool.query(
      'UPDATE build_cache_entries SET hit_count = hit_count + 1, last_hit_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM build_cache_entries WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.pool.query(
      "DELETE FROM build_cache_entries WHERE expires_at IS NOT NULL AND expires_at <= NOW()"
    );
    return result.rowCount ?? 0;
  }

  async deleteByConfigId(configId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM build_cache_entries WHERE config_id = $1',
      [configId]
    );
    return result.rowCount ?? 0;
  }

  async findLRUEntries(configId: string): Promise<CacheEntry[]> {
    const result = await this.pool.query(
      'SELECT * FROM build_cache_entries WHERE config_id = $1 ORDER BY last_hit_at ASC',
      [configId]
    );
    return result.rows;
  }
}
