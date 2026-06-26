/**
 * CacheMonitorService - Business logic for Build Cache Monitoring
 *
 * Implements cache monitoring capabilities including:
 * - Cache hit/miss rate tracking
 * - Cache size and utilization metrics
 * - Cache eviction and cleanup statistics
 * - Performance impact analysis
 *
 * Migrated to PostgreSQL Repository pattern (2026-06-26)
 */

import { CacheMetricsRepository, CacheMetricsEntity } from '../../repositories/CacheMonitorRepository';

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

// ==================== Service ====================

export class CacheMonitorService {
  private repository: CacheMetricsRepository;

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    this.repository = new CacheMetricsRepository(db);
  }

  /**
   * Get metrics for a specific cache
   */
  async getCacheMetrics(cacheId: string): Promise<CacheMetrics | null> {
    const entity = await this.repository.findByCacheId(cacheId);
    return entity ? this.entityToDTO(entity) : null;
  }

  /**
   * List all caches for a tenant
   */
  async listTenantCaches(tenantId: string): Promise<CacheMetrics[]> {
    const entities = await this.repository.findByTenant(tenantId);
    return entities.map(e => this.entityToDTO(e));
  }

  /**
   * Get tenant-level cache statistics summary
   */
  async getTenantSummary(tenantId: string): Promise<CacheStatsSummary> {
    const summary = await this.repository.getTenantSummary(tenantId);
    const totalRequests = summary.totalHits + summary.totalMisses;
    const hitRate = totalRequests > 0 ? summary.totalHits / totalRequests : 0;

    return {
      tenant_id: tenantId,
      total_caches: summary.totalCaches,
      total_size_bytes: summary.totalSizeBytes,
      total_hits: summary.totalHits,
      total_misses: summary.totalMisses,
      avg_hit_rate: summary.avgHitRate || hitRate,
      avg_latency_saved_ms: summary.avgLatencySavedMs,
      estimated_cost_saved_cents: Math.floor(summary.totalHits * summary.avgLatencySavedMs * 0.001),
    };
  }

  /**
   * Record cache hit/miss event
   */
  async recordCacheEvent(
    cacheId: string,
    tenantId: string,
    eventType: 'hit' | 'miss',
    latencySavedMs?: number,
  ): Promise<void> {
    const hits = eventType === 'hit' ? 1 : 0;
    const misses = eventType === 'miss' ? 1 : 0;
    const latencySaved = eventType === 'hit' ? (latencySavedMs || 0) : 0;

    await this.repository.recordEvent(cacheId, tenantId, hits, misses, 0, 0, latencySaved);
  }

  /**
   * Record cache size update
   */
  async recordCacheSize(cacheId: string, tenantId: string, sizeBytes: number): Promise<void> {
    await this.repository.recordEvent(cacheId, tenantId, 0, 0, sizeBytes, 0, 0);
  }

  /**
   * Record cache eviction
   */
  async recordCacheEviction(cacheId: string, tenantId: string, count: number): Promise<void> {
    await this.repository.recordEvent(cacheId, tenantId, 0, 0, 0, count, 0);
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
  async analyzePerformanceImpact(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> },
    pipelineId: string,
  ): Promise<CachePerformanceImpact> {
    const result = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE cache_enabled = true) as cache_enabled_runs,
        COUNT(*) FILTER (WHERE cache_enabled = false OR cache_enabled IS NULL) as cache_disabled_runs,
        AVG(duration_ms) FILTER (WHERE cache_enabled = true) as with_cache_avg,
        AVG(duration_ms) FILTER (WHERE cache_enabled = false OR cache_enabled IS NULL) as without_cache_avg
       FROM pipeline_runs
       WHERE pipeline_id = $1 AND status = 'completed' AND duration_ms IS NOT NULL`,
      [pipelineId],
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
      })),
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

  // ==================== DTO Converters ====================

  private entityToDTO(e: CacheMetricsEntity): CacheMetrics {
    return {
      cache_id: e.id,
      tenant_id: e.tenantId,
      total_hits: e.totalHits,
      total_misses: e.totalMisses,
      hit_rate: e.hitRate,
      total_size_bytes: e.totalSizeBytes,
      max_size_bytes: e.maxSizeBytes,
      utilization_percent: (e.totalSizeBytes / e.maxSizeBytes) * 100,
      eviction_count: e.evictionCount,
      avg_latency_saved_ms: e.avgLatencySavedMs,
      last_updated: e.lastUpdated,
    };
  }
}
