/**
 * Database Profiler
 *
 * Intercepts SQL queries to detect slow queries (> threshold) and records
 * execution statistics for database performance monitoring.
 *
 * Features:
 *   - Slow query detection (configurable threshold, default 100ms)
 *   - Query pattern aggregation (normalized SQL without parameters)
 *   - Execution statistics (count, avg duration, p95, p99)
 *   - PostgreSQL persistence for slow query log
 *
 * Usage:
 *   1. Wrap database pool query method with profiler
 *   2. Slow queries are automatically logged to database
 *   3. Query via API for dashboard display
 */

import { DatabasePool } from '../../services/database';
import { createLogger } from '../../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('DatabaseProfiler');

export interface QueryProfile {
  query: string;
  params?: any[];
  durationMs: number;
  startTime: Date;
  endTime: Date;
  tenantId?: string;
  error?: string;
}

export interface SlowQueryEntity {
  id: string;
  query_hash: string;
  normalized_query: string;
  original_query: string;
  duration_ms: number;
  params_count: number;
  tenant_id?: string;
  error?: string;
  created_at: Date;
}

export interface QueryPatternStats {
  query_hash: string;
  normalized_query: string;
  execution_count: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  max_duration_ms: number;
  error_count: number;
  last_executed: Date;
}

/**
 * Normalize SQL query by replacing literals with placeholders
 * Used for grouping similar queries
 */
function normalizeQuery(query: string): string {
  return query
    // Replace string literals
    .replace(/'[^']*'/g, '?')
    // Replace numeric literals
    .replace(/\b\d+\b/g, '?')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a hash for query pattern grouping
 */
function hashQuery(normalized: string): string {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(normalized).digest('hex');
}

export class DatabaseProfiler {
  private pool: DatabasePool;
  private slowQueryThresholdMs: number;

  constructor(pool: DatabasePool, options?: { slowQueryThresholdMs?: number }) {
    this.pool = pool;
    this.slowQueryThresholdMs = options?.slowQueryThresholdMs || 100;
  }

  /**
   * Profile a database query execution
   * Returns the original query result but records metrics
   */
  async profile<T = any>(
    query: string,
    params?: any[],
    tenantId?: string
  ): Promise<{ result: T; profile: QueryProfile }> {
    const startTime = new Date();

    try {
      const result = await this.pool.query(query, params) as T;
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      const profile: QueryProfile = {
        query,
        params,
        durationMs,
        startTime,
        endTime,
        tenantId,
      };

      // Log slow queries
      if (durationMs > this.slowQueryThresholdMs) {
        await this.recordSlowQuery(profile);
      }

      return { result, profile };
    } catch (error: unknown) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);

      const profile: QueryProfile = {
        query,
        params,
        durationMs,
        startTime,
        endTime,
        tenantId,
        error: errorMessage,
      };

      // Always log errors regardless of threshold
      if (durationMs > this.slowQueryThresholdMs || true) {
        await this.recordSlowQuery(profile);
      }

      throw error;
    }
  }

  /**
   * Record a slow query in the database
   */
  private async recordSlowQuery(profile: QueryProfile): Promise<void> {
    const normalized = normalizeQuery(profile.query);
    const queryHash = hashQuery(normalized);
    const id = require('crypto').randomUUID();

    try {
      await this.pool.query(
        `INSERT INTO slow_queries (
          id, query_hash, normalized_query, original_query,
          duration_ms, params_count, tenant_id, error
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          queryHash,
          normalized,
          profile.query.substring(0, 4000), // Truncate very long queries
          profile.durationMs,
          profile.params?.length || 0,
          profile.tenantId || null,
          profile.error || null,
        ]
      );

      logger.warn(
        {
          duration_ms: profile.durationMs,
          query_hash: queryHash,
          tenant_id: profile.tenantId,
          error: profile.error,
        },
        `[DatabaseProfiler] Slow query detected: ${profile.durationMs}ms`
      );
    } catch (error) {
      logger.error('[DatabaseProfiler] Failed to record slow query:', error);
    }
  }

  /**
   * Get recent slow queries
   */
  async getRecentSlowQueries(options?: {
    limit?: number;
    since?: Date;
    tenantId?: string;
  }): Promise<SlowQueryEntity[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.since) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(options.since);
    }
    if (options?.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(options.tenantId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit || 50;

    const result = await this.pool.query(
      `SELECT id, query_hash, normalized_query, original_query,
              duration_ms, params_count, tenant_id, error, created_at
       FROM slow_queries
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex}`,
      [...params, limit]
    );

    return result.rows as SlowQueryEntity[];
  }

  /**
   * Get query pattern statistics
   */
  async getPatternStats(since?: Date): Promise<QueryPatternStats[]> {
    const sinceClause = since ? 'AND created_at >= $1' : '';
    const sinceParam = since ? [since] : [];

    const result = await this.pool.query(
      `SELECT
        query_hash,
        MAX(normalized_query) as normalized_query,
        COUNT(*) as execution_count,
        AVG(duration_ms) as avg_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_duration_ms,
        MAX(duration_ms) as max_duration_ms,
        SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as error_count,
        MAX(created_at) as last_executed
       FROM slow_queries
       ${sinceClause}
       GROUP BY query_hash
       ORDER BY avg_duration_ms DESC
       LIMIT 50`,
      sinceParam
    );

    return result.rows as QueryPatternStats[];
  }

  /**
   * Cleanup old slow queries
   */
  async cleanupExpired(retentionDays: number = 30): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM slow_queries WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`
    );
    return result.rowCount ?? 0;
  }
}
