/**
 * BuildCacheRepository - Database layer for Build Cache operations
 *
 * Provides PostgreSQL persistence for BuildCacheConfig and CacheEntry entities,
 * replacing the Map() in-memory storage in BuildCacheService.
 */

import { BaseRepository } from '../db/base-repository';
import {
  BuildCacheConfig,
  CacheEntry,
  CacheLevel,
  CacheStatus,
  CacheCleanupPolicy,
  CacheStorageType,
} from '../models/BuildCache';
import { OrionError, ErrorCode } from '../errors';

// ==================== Config Repository ====================

export class BuildCacheConfigRepository extends BaseRepository<BuildCacheConfig> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'build_cache_configs');
  }

  /**
   * Find config by level and optional target
   */
  async findByLevelAndTarget(
    level: CacheLevel,
    targetId?: string,
  ): Promise<BuildCacheConfig | undefined> {
    const result = await this.db.query(
      `SELECT * FROM build_cache_configs WHERE level = $1 AND COALESCE(target_id, '') = $2`,
      [level, targetId || ''],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all configs with optional filters
   */
  async findAllWithFilters(options?: {
    level?: CacheLevel;
    status?: CacheStatus;
    limit?: number;
    offset?: number;
  }): Promise<BuildCacheConfig[]> {
    const level = options?.level;
    const status = options?.status;
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let query = `SELECT * FROM build_cache_configs WHERE 1=1`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (level) {
      query += ` AND level = $${paramIndex}`;
      params.push(level);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Create a new config (maps camelCase to snake_case)
   */
  async createConfig(data: {
    level: CacheLevel;
    targetId?: string;
    status: CacheStatus;
    storageType: CacheStorageType;
    storagePath?: string;
    maxTotalSize?: string;
    maxAgeDays?: number;
    cleanupPolicy: CacheCleanupPolicy;
    cacheKeyPattern?: string;
    cachePaths: string[];
    description?: string;
  }): Promise<BuildCacheConfig> {
    const result = await this.db.query(
      `INSERT INTO build_cache_configs
       (level, target_id, status, storage_type, storage_path, max_total_size,
        max_age_days, cleanup_policy, cache_key_pattern, cache_paths, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.level,
        data.targetId || null,
        data.status,
        data.storageType,
        data.storagePath || null,
        data.maxTotalSize || null,
        data.maxAgeDays || null,
        data.cleanupPolicy,
        data.cacheKeyPattern || null,
        data.cachePaths,
        data.description || null,
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT into build_cache_configs returned no rows');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update a config (maps camelCase to snake_case)
   */
  async updateConfig(id: string, data: Partial<{
    level: CacheLevel;
    targetId?: string;
    status: CacheStatus;
    storageType: CacheStorageType;
    storagePath?: string;
    maxTotalSize?: string;
    maxAgeDays?: number;
    cleanupPolicy: CacheCleanupPolicy;
    cacheKeyPattern?: string;
    cachePaths: string[];
    description?: string;
  }>): Promise<BuildCacheConfig> {
    const columns: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, keyof typeof data> = {
      level: 'level',
      target_id: 'targetId',
      status: 'status',
      storage_type: 'storageType',
      storage_path: 'storagePath',
      max_total_size: 'maxTotalSize',
      max_age_days: 'maxAgeDays',
      cleanup_policy: 'cleanupPolicy',
      cache_key_pattern: 'cacheKeyPattern',
      cache_paths: 'cachePaths',
      description: 'description',
    };

    for (const [col, key] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        columns.push(`${col} = $${paramIndex}`);
        values.push(data[key]);
        paramIndex++;
      }
    }

    if (columns.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Update requires at least one column');
    }

    values.push(id);
    const query = `UPDATE build_cache_configs SET ${columns.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.db.query(query, values);
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.NOT_FOUND, `UPDATE on build_cache_configs affected no rows (id: ${id})`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): BuildCacheConfig {
    return {
      id: row.id,
      level: row.level as CacheLevel,
      targetId: row.target_id || undefined,
      status: row.status as CacheStatus,
      storageType: row.storage_type as CacheStorageType,
      storagePath: row.storage_path || undefined,
      maxTotalSize: row.max_total_size || undefined,
      maxAgeDays: row.max_age_days || undefined,
      cleanupPolicy: row.cleanup_policy as CacheCleanupPolicy,
      cacheKeyPattern: row.cache_key_pattern || undefined,
      cachePaths: row.cache_paths || [],
      description: row.description || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at || undefined,
    };
  }
}

// ==================== Entry Repository ====================

export class BuildCacheEntryRepository extends BaseRepository<CacheEntry> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'build_cache_entries');
  }

  /**
   * Find entry by cache key and config
   */
  async findByCacheKey(configId: string, cacheKey: string): Promise<CacheEntry | undefined> {
    const result = await this.db.query(
      `SELECT * FROM build_cache_entries WHERE config_id = $1 AND cache_key = $2`,
      [configId, cacheKey],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find entries by config ID with optional limit/offset
   */
  async findByConfigId(configId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<CacheEntry[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const result = await this.db.query(
      `SELECT * FROM build_cache_entries
       WHERE config_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [configId, limit, offset],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Find all entries with optional config filter
   */
  async findAllWithFilter(options?: {
    configId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CacheEntry[]> {
    const configId = options?.configId;
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let query = `SELECT * FROM build_cache_entries WHERE 1=1`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (configId) {
      query += ` AND config_id = $${paramIndex}`;
      params.push(configId);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Delete expired entries
   */
  async deleteExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM build_cache_entries WHERE expires_at < NOW()`,
    );
    return result.rowCount || 0;
  }

  /**
   * Delete entries by config ID
   */
  async deleteByConfigId(configId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM build_cache_entries WHERE config_id = $1`,
      [configId],
    );
    return result.rowCount || 0;
  }

  /**
   * Find LRU entries for a config (ordered by last hit time, oldest first)
   */
  async findLRUEntries(configId: string): Promise<CacheEntry[]> {
    const result = await this.db.query(
      `SELECT * FROM build_cache_entries
       WHERE config_id = $1
       ORDER BY
         CASE WHEN last_hit_at IS NULL THEN created_at ELSE last_hit_at END ASC`,
      [configId],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Increment hit count and record last hit time
   */
  async recordHit(id: string): Promise<CacheEntry> {
    const result = await this.db.query(
      `UPDATE build_cache_entries
       SET hit_count = hit_count + 1, last_hit_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new OrionError('NOT_FOUND', `Cache entry '${id}' not found`)
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create a new cache entry (maps camelCase to snake_case)
   */
  async createEntry(data: {
    configId: string;
    cacheKey: string;
    hash: string;
    size?: number;
    storagePath: string;
    hitCount?: number;
    lastHitAt?: Date;
    expiresAt?: Date;
  }): Promise<CacheEntry> {
    const result = await this.db.query(
      `INSERT INTO build_cache_entries
       (config_id, cache_key, hash, size_bytes, storage_path, hit_count, last_hit_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.configId,
        data.cacheKey,
        data.hash,
        data.size || null,
        data.storagePath,
        data.hitCount || 0,
        data.lastHitAt || null,
        data.expiresAt || null,
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT into build_cache_entries returned no rows');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): CacheEntry {
    return {
      id: row.id,
      configId: row.config_id,
      cacheKey: row.cache_key,
      hash: row.hash,
      size: row.size_bytes || undefined,
      storagePath: row.storage_path,
      hitCount: row.hit_count,
      lastHitAt: row.last_hit_at || undefined,
      expiresAt: row.expires_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at || undefined,
    };
  }
}
