/**
 * PipelineMetricsRepository - Database layer for pipeline_metrics table
 *
 * Encapsulates all raw SQL queries for pipeline metrics aggregation.
 * Follows the Repository pattern used across the codebase.
 */

import { DatabasePool } from '../services/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineMetricsRow {
  runId: string;
  pipelineId: string;
  status: string;
  durationMs: number;
  triggerType: string;
  errorType: string | null;
  completedAt: Date;
}

export interface MetricsOverview {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  avgDurationMs: number;
}

export interface MetricsPercentiles {
  medianDurationMs: number;
  p95DurationMs: number;
}

export interface PipelineAggregate {
  pipelineId: string;
  total: number;
  success: number;
  avgDurationMs: number;
}

export interface TriggerTypeCount {
  triggerType: string;
  count: number;
}

export interface ErrorTypeCount {
  errorType: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class PipelineMetricsRepository {
  constructor(private pool: DatabasePool) {}

  /**
   * Insert a single run metric record.
   */
  async insert(row: {
    runId: string;
    pipelineId: string;
    status: string;
    durationMs: number;
    triggerType: string;
    errorType?: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO pipeline_metrics (run_id, pipeline_id, status, duration_ms, trigger_type, error_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        row.runId,
        row.pipelineId,
        row.status,
        row.durationMs,
        row.triggerType,
        row.errorType ?? null,
      ],
    );
  }

  /**
   * Aggregate overview stats across all pipeline runs.
   */
  async getOverview(): Promise<MetricsOverview> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*)                                                           AS total_runs,
        COUNT(*) FILTER (WHERE status = 'success')                         AS success_runs,
        COUNT(*) FILTER (WHERE status = 'failed')                          AS failed_runs,
        COUNT(*) FILTER (WHERE status = 'cancelled')                       AS cancelled_runs,
        COALESCE(AVG(duration_ms) FILTER (WHERE duration_ms > 0), 0)      AS avg_duration_ms
      FROM pipeline_metrics
    `);
    const row = result.rows[0];
    return {
      totalRuns: parseInt(row.total_runs, 10),
      successRuns: parseInt(row.success_runs, 10),
      failedRuns: parseInt(row.failed_runs, 10),
      cancelledRuns: parseInt(row.cancelled_runs, 10),
      avgDurationMs: parseFloat(row.avg_duration_ms || '0'),
    };
  }

  /**
   * Get median and p95 duration percentiles.
   */
  async getPercentiles(): Promise<MetricsPercentiles> {
    const result = await this.pool.query(`
      SELECT
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms > 0), 0) AS median_dur,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms > 0), 0) AS p95_dur
      FROM pipeline_metrics
    `);
    const row = result.rows[0];
    return {
      medianDurationMs: parseFloat(row.median_dur || '0'),
      p95DurationMs: parseFloat(row.p95_dur || '0'),
    };
  }

  /**
   * Count failures grouped by error_type.
   */
  async getFailuresByErrorType(): Promise<ErrorTypeCount[]> {
    const result = await this.pool.query(`
      SELECT error_type, COUNT(*) AS cnt
      FROM pipeline_metrics
      WHERE status = 'failed' AND error_type IS NOT NULL
      GROUP BY error_type
      ORDER BY cnt DESC
    `);
    return result.rows.map((r: any) => ({
      errorType: r.error_type,
      count: parseInt(r.cnt, 10),
    }));
  }

  /**
   * Aggregate runs grouped by pipeline_id.
   */
  async getAggregatesByPipeline(): Promise<PipelineAggregate[]> {
    const result = await this.pool.query(`
      SELECT pipeline_id,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'success') AS success,
             COALESCE(AVG(duration_ms) FILTER (WHERE duration_ms > 0), 0) AS avg_duration
      FROM pipeline_metrics
      GROUP BY pipeline_id
    `);
    return result.rows.map((r: any) => ({
      pipelineId: r.pipeline_id,
      total: parseInt(r.total, 10),
      success: parseInt(r.success, 10),
      avgDurationMs: parseFloat(r.avg_duration || '0'),
    }));
  }

  /**
   * Count runs grouped by trigger_type.
   */
  async getCountsByTriggerType(): Promise<TriggerTypeCount[]> {
    const result = await this.pool.query(`
      SELECT trigger_type, COUNT(*) AS cnt
      FROM pipeline_metrics
      GROUP BY trigger_type
      ORDER BY cnt DESC
    `);
    return result.rows.map((r: any) => ({
      triggerType: r.trigger_type,
      count: parseInt(r.cnt, 10),
    }));
  }

  /**
   * Get recent N run records ordered by created_at DESC.
   */
  async getRecentRuns(limit: number): Promise<PipelineMetricsRow[]> {
    const result = await this.pool.query(
      `SELECT run_id, pipeline_id, status, duration_ms, trigger_type, error_type, created_at
       FROM pipeline_metrics
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((r: any) => ({
      runId: r.run_id,
      pipelineId: r.pipeline_id,
      status: r.status,
      durationMs: parseInt(r.duration_ms, 10),
      triggerType: r.trigger_type || 'unknown',
      errorType: r.error_type || null,
      completedAt: new Date(r.created_at),
    }));
  }

  /**
   * Get aggregate stats for a specific pipeline.
   */
  async getAggregateByPipelineId(pipelineId: string): Promise<{
    total: number;
    success: number;
    failed: number;
    avgDurationMs: number;
    recentRuns: PipelineMetricsRow[];
  }> {
    const [aggResult, recentResult] = await Promise.all([
      this.pool.query(
        `SELECT
           COUNT(*)                                       AS total,
           COUNT(*) FILTER (WHERE status = 'success')     AS success,
           COUNT(*) FILTER (WHERE status = 'failed')      AS failed,
           COALESCE(AVG(duration_ms) FILTER (WHERE duration_ms > 0), 0) AS avg_duration
         FROM pipeline_metrics
         WHERE pipeline_id = $1`,
        [pipelineId],
      ),
      this.pool.query(
        `SELECT run_id, pipeline_id, status, duration_ms, trigger_type, error_type, created_at
         FROM pipeline_metrics
         WHERE pipeline_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [pipelineId],
      ),
    ]);

    const row = aggResult.rows[0];
    return {
      total: parseInt(row.total, 10),
      success: parseInt(row.success, 10),
      failed: parseInt(row.failed, 10),
      avgDurationMs: parseFloat(row.avg_duration || '0'),
      recentRuns: recentResult.rows.map((r: any) => ({
        runId: r.run_id,
        pipelineId: r.pipeline_id,
        status: r.status,
        durationMs: parseInt(r.duration_ms, 10),
        triggerType: r.trigger_type || 'unknown',
        errorType: r.error_type || null,
        completedAt: new Date(r.created_at),
      })),
    };
  }

  /**
   * Delete all records — used for testing and cleanup.
   */
  async deleteAll(): Promise<void> {
    await this.pool.query('DELETE FROM pipeline_metrics');
  }

  /**
   * Delete records older than the given cutoff date.
   */
  async deleteOlderThan(cutoff: Date): Promise<void> {
    await this.pool.query('DELETE FROM pipeline_metrics WHERE created_at < $1', [cutoff]);
  }
}
