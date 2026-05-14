import type { QueryResultRow } from 'pg';

/** Minimal database pool interface compatible with pg/ioredis */
export interface DatabasePool {
  query: (text: string, values?: unknown[]) => Promise<{ rows: QueryResultRow[] }>;
}

/**
 * CacheMonitorService - Business logic for Build Cache Monitoring
 *
 * Implements cache monitoring capabilities including:
 * - Cache hit/miss rate tracking
 * - Cache size and utilization metrics
 * - Cache eviction and cleanup statistics
 * - Performance impact analysis
 *
 * Phase 1 P0 Service
 */

// ==================== Types ====================

export interface CacheMetrics {
  cache_id: string;
  tenant_id: string;
  total_hits: number;
  total_misses: number;
  hit_rate: number;
  total_size_bytes: number;
  max_size_bytes: number;
  utilization_percent: number;
  eviction_count: number;
  avg_latency_saved_ms: number;
  last_updated: Date;
}

export interface CacheHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  hit_rate: number;
  utilization: number;
  recommendations: string[];
  issues: CacheIssue[];
}

export interface CacheIssue {
  type: 'low_hit_rate' | 'high_utilization' | 'stale_entries' | 'eviction_spike';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggested_action: string;
}

export interface CacheStatsSummary {
  tenant_id: string;
  total_caches: number;
  total_size_bytes: number;
  total_hits: number;
  total_misses: number;
  avg_hit_rate: number;
  avg_latency_saved_ms: number;
  estimated_cost_saved_cents: number;
}

export interface CachePerformanceImpact {
  pipeline_id: string;
  with_cache_avg_duration_ms: number;
  without_cache_avg_duration_ms: number;
  time_saved_ms: number;
  time_saved_percent: number;
  cache_enabled_runs: number;
  cache_disabled_runs: number;
}

export class CacheMonitorServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CacheMonitorServiceError';
  }
}

// ==================== Repository ====================

export class CacheMetricsRepository {

  constructor(private pool: DatabasePool) {}

  async getCacheMetrics(cacheId: string): Promise<CacheMetrics | null> {
    const result = await this.pool.query(
      `SELECT * FROM build_cache_metrics WHERE cache_id = $1`,
      [cacheId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async listTenantCaches(tenantId: string): Promise<CacheMetrics[]> {
    const result = await this.pool.query(
      `SELECT * FROM build_cache_metrics WHERE tenant_id = $1 ORDER BY last_updated DESC`,
      [tenantId]
    );
    return result.rows.map((row: QueryResultRow) => this.mapRow(row));
  }

  async updateMetrics(
    cacheId: string,
    tenantId: string,
    hits: number,
    misses: number,
    sizeBytes: number,
    evictions: number,
    latencySavedMs: number
  ): Promise<void> {
    const totalRequests = hits + misses;
    const hitRate = totalRequests > 0 ? hits / totalRequests : 0;

    await this.pool.query(
      `INSERT INTO build_cache_metrics 
        (cache_id, tenant_id, total_hits, total_misses, hit_rate, total_size_bytes, eviction_count, avg_latency_saved_ms, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (cache_id) DO UPDATE SET
        total_hits = build_cache_metrics.total_hits + $3,
        total_misses = build_cache_metrics.total_misses + $4,
        hit_rate = $5,
        total_size_bytes = $6,
        eviction_count = build_cache_metrics.eviction_count + $7,
        avg_latency_saved_ms = $8,
        last_updated = now()`,
      [cacheId, tenantId, hits, misses, hitRate, sizeBytes, evictions, latencySavedMs]
    );
  }

  async getTenantSummary(tenantId: string): Promise<CacheStatsSummary> {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) as total_caches,
        SUM(total_size_bytes) as total_size,
        SUM(total_hits) as total_hits,
        SUM(total_misses) as total_misses,
        AVG(hit_rate) as avg_hit_rate,
        AVG(avg_latency_saved_ms) as avg_latency_saved,
        SUM(total_hits * avg_latency_saved_ms) as total_latency_saved
       FROM build_cache_metrics 
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const row = result.rows[0];
    const totalRequests = parseInt(row.total_hits) + parseInt(row.total_misses);
    const hitRate = totalRequests > 0 ? parseInt(row.total_hits) / totalRequests : 0;

    return {
      tenant_id: tenantId,
      total_caches: parseInt(row.total_caches) || 0,
      total_size_bytes: parseInt(row.total_size) || 0,
      total_hits: parseInt(row.total_hits) || 0,
      total_misses: parseInt(row.total_misses) || 0,
      avg_hit_rate: parseFloat(row.avg_hit_rate) || hitRate,
      avg_latency_saved_ms: parseFloat(row.avg_latency_saved) || 0,
      estimated_cost_saved_cents: Math.floor((parseInt(row.total_latency_saved) || 0) * 0.001), // Rough estimate
    };
  }

  private mapRow(row: any): CacheMetrics {
    return {
      cache_id: row.cache_id,
      tenant_id: row.tenant_id,
      total_hits: row.total_hits,
      total_misses: row.total_misses,
      hit_rate: row.hit_rate,
      total_size_bytes: row.total_size_bytes,
      max_size_bytes: row.max_size_bytes || 10737418240, // Default 10GB
      utilization_percent: (row.total_size_bytes / (row.max_size_bytes || 10737418240)) * 100,
      eviction_count: row.eviction_count,
      avg_latency_saved_ms: row.avg_latency_saved_ms,
      last_updated: row.last_updated,
    };
  }
}

// ==================== Service ====================

export class CacheMonitorService {
  private repository: CacheMetricsRepository;

  constructor(private pool: DatabasePool) {
    this.repository = new CacheMetricsRepository(this.pool);
  }

  /**
   * Get metrics for a specific cache
   */
  async getCacheMetrics(cacheId: string): Promise<CacheMetrics | null> {
    return this.repository.getCacheMetrics(cacheId);
  }

  /**
   * List all caches for a tenant
   */
  async listTenantCaches(tenantId: string): Promise<CacheMetrics[]> {
    return this.repository.listTenantCaches(tenantId);
  }

  /**
   * Get tenant-level cache statistics summary
   */
  async getTenantSummary(tenantId: string): Promise<CacheStatsSummary> {
    return this.repository.getTenantSummary(tenantId);
  }

  /**
   * Record cache hit/miss event
   */
  async recordCacheEvent(
    cacheId: string,
    tenantId: string,
    eventType: 'hit' | 'miss',
    latencySavedMs?: number
  ): Promise<void> {
    const hits = eventType === 'hit' ? 1 : 0;
    const misses = eventType === 'miss' ? 1 : 0;
    const latencySaved = eventType === 'hit' ? (latencySavedMs || 0) : 0;

    await this.repository.updateMetrics(
      cacheId,
      tenantId,
      hits,
      misses,
      0, // Size would be tracked separately
      0, // Evictions tracked separately
      latencySaved
    );
  }

  /**
   * Record cache size update
   */
  async recordCacheSize(cacheId: string, tenantId: string, sizeBytes: number): Promise<void> {
    await this.repository.updateMetrics(
      cacheId,
      tenantId,
      0,
      0,
      sizeBytes,
      0,
      0
    );
  }

  /**
   * Record cache eviction
   */
  async recordCacheEviction(cacheId: string, tenantId: string, count: number): Promise<void> {
    await this.repository.updateMetrics(
      cacheId,
      tenantId,
      0,
      0,
      0,
      count,
      0
    );
  }

  /**
   * Assess cache health status
   */
  async assessCacheHealth(cacheId: string): Promise<CacheHealthStatus> {
    const metrics = await this.getCacheMetrics(cacheId);
    if (!metrics) {
      return {
        status: 'warning',
        hit_rate: 0,
        utilization: 0,
        recommendations: ['Cache not yet initialized or no metrics available'],
        issues: [],
      };
    }

    const issues: CacheIssue[] = [];
    const recommendations: string[] = [];

    // Check hit rate
    if (metrics.hit_rate < 0.5) {
      issues.push({
        type: 'low_hit_rate',
        severity: metrics.hit_rate < 0.3 ? 'high' : 'medium',
        message: `Cache hit rate is ${Math.round(metrics.hit_rate * 100)}%, below optimal threshold`,
        suggested_action: 'Review cache key strategy and ensure consistent key generation',
      });
      recommendations.push('Consider reviewing cache key generation to improve hit rate');
    }

    // Check utilization
    if (metrics.utilization_percent > 90) {
      issues.push({
        type: 'high_utilization',
        severity: metrics.utilization_percent > 95 ? 'high' : 'medium',
        message: `Cache utilization at ${Math.round(metrics.utilization_percent)}%, near capacity`,
        suggested_action: 'Increase cache capacity or implement more aggressive eviction policy',
      });
      recommendations.push('Increase cache storage capacity or adjust eviction policy');
    }

    // Check eviction spike
    if (metrics.eviction_count > 1000) {
      issues.push({
        type: 'eviction_spike',
        severity: 'low',
        message: `High eviction count: ${metrics.eviction_count} entries evicted`,
        suggested_action: 'Review cache entry TTL settings',
      });
    }

    // Determine overall status
    const highSeverityIssues = issues.filter(i => i.severity === 'high');
    const mediumSeverityIssues = issues.filter(i => i.severity === 'medium');

    let status: 'healthy' | 'warning' | 'critical';
    if (highSeverityIssues.length > 0) {
      status = 'critical';
    } else if (mediumSeverityIssues.length > 0) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    if (issues.length === 0) {
      recommendations.push('Cache performance is optimal');
    }

    return {
      status,
      hit_rate: metrics.hit_rate,
      utilization: metrics.utilization_percent,
      recommendations,
      issues,
    };
  }

  /**
   * Analyze cache performance impact on pipeline runs
   */
  async analyzePerformanceImpact(pipelineId: string): Promise<CachePerformanceImpact> {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE cache_enabled = true) as cache_enabled_runs,
        COUNT(*) FILTER (WHERE cache_enabled = false OR cache_enabled IS NULL) as cache_disabled_runs,
        AVG(duration_ms) FILTER (WHERE cache_enabled = true) as with_cache_avg,
        AVG(duration_ms) FILTER (WHERE cache_enabled = false OR cache_enabled IS NULL) as without_cache_avg
       FROM pipeline_runs 
       WHERE pipeline_id = $1 AND status = 'completed' AND duration_ms IS NOT NULL`,
      [pipelineId]
    );

    const row = result.rows[0];
    const withCacheAvg = parseFloat(row.with_cache_avg) || 0;
    const withoutCacheAvg = parseFloat(row.without_cache_avg) || 0;

    const timeSaved = withoutCacheAvg - withCacheAvg;
    const timeSavedPercent = withoutCacheAvg > 0 ? (timeSaved / withoutCacheAvg) * 100 : 0;

    return {
      pipeline_id: pipelineId,
      with_cache_avg_duration_ms: withCacheAvg,
      without_cache_avg_duration_ms: withoutCacheAvg,
      time_saved_ms: Math.max(0, timeSaved),
      time_saved_percent: Math.max(0, timeSavedPercent),
      cache_enabled_runs: parseInt(row.cache_enabled_runs) || 0,
      cache_disabled_runs: parseInt(row.cache_disabled_runs) || 0,
    };
  }

  /**
   * Get dashboard data for tenant cache monitoring
   */
  async getDashboard(tenantId: string): Promise<{
    summary: CacheStatsSummary;
    caches: CacheMetrics[];
    topCaches: CacheMetrics[];
    healthAlerts: Array<{ cache_id: string; status: CacheHealthStatus }>;
  }> {
    const summary = await this.getTenantSummary(tenantId);
    const caches = await this.listTenantCaches(tenantId);

    // Top caches by hit rate
    const topCaches = caches
      .sort((a, b) => b.hit_rate - a.hit_rate)
      .slice(0, 5);

    // Check health for each cache
    const healthAlerts = await Promise.all(
      caches.slice(0, 10).map(async cache => ({
        cache_id: cache.cache_id,
        status: await this.assessCacheHealth(cache.cache_id),
      }))
    );

    // Filter only non-healthy caches
    const unhealthyAlerts = healthAlerts.filter(a => a.status.status !== 'healthy');

    return {
      summary,
      caches,
      topCaches,
      healthAlerts: unhealthyAlerts,
    };
  }
}