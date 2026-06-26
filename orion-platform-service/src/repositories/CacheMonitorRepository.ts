/**
 * Cache Monitor Repository
 *
 * PostgreSQL persistence for cache monitoring metrics.
 * Migrated from inline Repository to BaseRepository pattern.
 */

import { BaseRepository } from '../db/base-repository';

export interface CacheMetricsEntity {
  id: string; // maps to cache_id (primary key)
  tenantId: string;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  totalSizeBytes: number;
  maxSizeBytes: number;
  evictionCount: number;
  avgLatencySavedMs: number;
  lastUpdated: Date;
}

export class CacheMetricsRepository extends BaseRepository<CacheMetricsEntity> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'build_cache_metrics');
  }

  protected mapRowToEntity(row: any): CacheMetricsEntity {
    return {
      id: row.cache_id,
      tenantId: row.tenant_id,
      totalHits: parseInt(row.total_hits) || 0,
      totalMisses: parseInt(row.total_misses) || 0,
      hitRate: parseFloat(row.hit_rate) || 0,
      totalSizeBytes: parseInt(row.total_size_bytes) || 0,
      maxSizeBytes: parseInt(row.max_size_bytes) || 10737418240,
      evictionCount: parseInt(row.eviction_count) || 0,
      avgLatencySavedMs: parseFloat(row.avg_latency_saved_ms) || 0,
      lastUpdated: row.last_updated,
    };
  }

  /**
   * Find metrics by cache ID
   */
  async findByCacheId(cacheId: string): Promise<CacheMetricsEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM build_cache_metrics WHERE cache_id = $1`,
      [cacheId],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * List all cache metrics for a tenant
   */
  async findByTenant(tenantId: string): Promise<CacheMetricsEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM build_cache_metrics WHERE tenant_id = $1 ORDER BY last_updated DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get tenant-level cache summary
   */
  async getTenantSummary(tenantId: string): Promise<{
    totalCaches: number;
    totalSizeBytes: number;
    totalHits: number;
    totalMisses: number;
    avgHitRate: number;
    avgLatencySavedMs: number;
  }> {
    const result = await this.db.query(
      `SELECT
        COUNT(*) as total_caches,
        COALESCE(SUM(total_size_bytes), 0) as total_size,
        COALESCE(SUM(total_hits), 0) as total_hits,
        COALESCE(SUM(total_misses), 0) as total_misses,
        COALESCE(AVG(hit_rate), 0) as avg_hit_rate,
        COALESCE(AVG(avg_latency_saved_ms), 0) as avg_latency_saved
       FROM build_cache_metrics
       WHERE tenant_id = $1`,
      [tenantId],
    );

    const row = result.rows[0];
    return {
      totalCaches: parseInt(row.total_caches) || 0,
      totalSizeBytes: parseInt(row.total_size) || 0,
      totalHits: parseInt(row.total_hits) || 0,
      totalMisses: parseInt(row.total_misses) || 0,
      avgHitRate: parseFloat(row.avg_hit_rate) || 0,
      avgLatencySavedMs: parseFloat(row.avg_latency_saved) || 0,
    };
  }

  /**
   * Record cache hit/miss event (upsert)
   */
  async recordEvent(
    cacheId: string,
    tenantId: string,
    hits: number,
    misses: number,
    sizeBytes: number,
    evictions: number,
    latencySavedMs: number,
  ): Promise<void> {
    const totalRequests = hits + misses;
    const hitRate = totalRequests > 0 ? hits / totalRequests : 0;

    await this.db.query(
      `INSERT INTO build_cache_metrics
        (cache_id, tenant_id, total_hits, total_misses, hit_rate, total_size_bytes, eviction_count, avg_latency_saved_ms, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (cache_id) DO UPDATE SET
        total_hits = build_cache_metrics.total_hits + $3,
        total_misses = build_cache_metrics.total_misses + $4,
        hit_rate = CASE
          WHEN (build_cache_metrics.total_hits + $3 + build_cache_metrics.total_misses + $4) > 0
          THEN (build_cache_metrics.total_hits + $3)::double precision / (build_cache_metrics.total_hits + $3 + build_cache_metrics.total_misses + $4)
          ELSE 0
        END,
        total_size_bytes = CASE WHEN $6 > 0 THEN $6 ELSE build_cache_metrics.total_size_bytes END,
        eviction_count = build_cache_metrics.total_eviction_count + $7,
        avg_latency_saved_ms = CASE
          WHEN $8 > 0
          THEN (build_cache_metrics.avg_latency_saved_ms * build_cache_metrics.total_hits + $8) / (build_cache_metrics.total_hits + 1)
          ELSE build_cache_metrics.avg_latency_saved_ms
        END,
        last_updated = now()`,
      [cacheId, tenantId, hits, misses, hitRate, sizeBytes, evictions, latencySavedMs],
    );
  }
}
