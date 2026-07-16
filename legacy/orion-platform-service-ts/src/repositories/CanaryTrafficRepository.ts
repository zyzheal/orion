/**
 * CanaryTrafficRepository — Data access layer for canary_configs and canary_analyses tables
 *
 * Provides CRUD and analysis operations for Canary Traffic Management.
 * All read/write operations enforce tenant isolation via tenant_id filter.
 */

import { DatabasePool } from '../services/database';

// ==================== Entities ====================

export interface CanaryConfigEntity {
  id: string;
  tenantId: string;
  deploymentId: string;
  initialPercent: number;
  maxPercent: number;
  incrementPercent: number;
  incrementIntervalMinutes: number;
  analysisWindowMinutes: number;
  successThreshold: number;
  rollbackThreshold: number;
  status: 'running' | 'completed' | 'rollback' | 'paused';
  currentPercent: number;
  createdAt: Date;
}

export interface CanaryAnalysisEntity {
  id: string;
  canaryId: string;
  windowStart: Date;
  windowEnd: Date;
  stableSuccessRate: number;
  canarySuccessRate: number;
  stableErrorRate: number;
  canaryErrorRate: number;
  recommendation: 'continue' | 'pause' | 'rollback' | 'promote';
  createdAt: Date;
}

// ==================== Repository ====================

export class CanaryTrafficRepository {
  constructor(private pool: DatabasePool) {}

  // ---- Canary Configs ----

  async insertConfig(entity: CanaryConfigEntity): Promise<CanaryConfigEntity> {
    const result = await this.pool.query(
      `INSERT INTO canary_configs
        (tenant_id, deployment_id, initial_percent, max_percent, increment_percent,
         increment_interval_minutes, analysis_window_minutes, success_threshold,
         rollback_threshold, status, current_percent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        entity.tenantId,
        entity.deploymentId,
        entity.initialPercent,
        entity.maxPercent,
        entity.incrementPercent,
        entity.incrementIntervalMinutes,
        entity.analysisWindowMinutes,
        entity.successThreshold,
        entity.rollbackThreshold,
        entity.status,
        entity.currentPercent,
      ],
    );
    return this.mapRowToConfig(result.rows[0]);
  }

  async findConfigById(id: string, tenantId: string): Promise<CanaryConfigEntity | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM canary_configs WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToConfig(result.rows[0]);
  }

  async updateConfigStatus(
    id: string,
    tenantId: string,
    status: CanaryConfigEntity['status'],
    currentPercent?: number,
  ): Promise<CanaryConfigEntity | undefined> {
    const result = await this.pool.query(
      `UPDATE canary_configs SET status = $2, current_percent = COALESCE($3, current_percent)
       WHERE id = $1 AND tenant_id = $4 RETURNING *`,
      [id, status, currentPercent, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToConfig(result.rows[0]);
  }

  async updateCurrentPercent(id: string, tenantId: string, currentPercent: number): Promise<CanaryConfigEntity | undefined> {
    const result = await this.pool.query(
      'UPDATE canary_configs SET current_percent = $2 WHERE id = $1 AND tenant_id = $3 RETURNING *',
      [id, currentPercent, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToConfig(result.rows[0]);
  }

  // ---- Canary Analyses ----

  async insertAnalysis(entity: CanaryAnalysisEntity): Promise<CanaryAnalysisEntity> {
    const result = await this.pool.query(
      `INSERT INTO canary_analyses
        (canary_id, window_start, window_end, stable_success_rate, canary_success_rate,
         stable_error_rate, canary_error_rate, recommendation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        entity.canaryId,
        entity.windowStart,
        entity.windowEnd,
        entity.stableSuccessRate,
        entity.canarySuccessRate,
        entity.stableErrorRate,
        entity.canaryErrorRate,
        entity.recommendation,
      ],
    );
    return this.mapRowToAnalysis(result.rows[0]);
  }

  // ==================== Mappers ====================

  private mapRowToConfig(row: any): CanaryConfigEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      deploymentId: row.deployment_id,
      initialPercent: Number(row.initial_percent),
      maxPercent: Number(row.max_percent),
      incrementPercent: Number(row.increment_percent),
      incrementIntervalMinutes: Number(row.increment_interval_minutes),
      analysisWindowMinutes: Number(row.analysis_window_minutes),
      successThreshold: Number(row.success_threshold),
      rollbackThreshold: Number(row.rollback_threshold),
      status: row.status,
      currentPercent: Number(row.current_percent),
      createdAt: row.created_at,
    };
  }

  private mapRowToAnalysis(row: any): CanaryAnalysisEntity {
    return {
      id: row.id,
      canaryId: row.canary_id,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      stableSuccessRate: Number(row.stable_success_rate),
      canarySuccessRate: Number(row.canary_success_rate),
      stableErrorRate: Number(row.stable_error_rate),
      canaryErrorRate: Number(row.canary_error_rate),
      recommendation: row.recommendation,
      createdAt: row.created_at,
    };
  }
}
