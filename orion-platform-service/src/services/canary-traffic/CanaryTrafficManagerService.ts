import { DatabasePool } from '../database';
/**
 * Canary Traffic Manager Service - Phase 3
 *
 * Manage canary release traffic distribution
 */

export interface CanaryConfig {
  id: string;
  tenant_id: string;
  deployment_id: string;
  initial_percent: number;
  max_percent: number;
  increment_percent: number;
  increment_interval_minutes: number;
  analysis_window_minutes: number;
  success_threshold: number;
  rollback_threshold: number;
  status: 'running' | 'completed' | 'rollback' | 'paused';
  current_percent: number;
  created_at: Date;
}

export interface CanaryAnalysis {
  id: string;
  canary_id: string;
  window_start: Date;
  window_end: Date;
  stable_success_rate: number;
  canary_success_rate: number;
  stable_error_rate: number;
  canary_error_rate: number;
  recommendation: 'continue' | 'pause' | 'rollback' | 'promote';
  created_at: Date;
}

export class CanaryTrafficManagerService {

  constructor(private pool: DatabasePool) {}

  async createCanary(input: { tenant_id: string; deployment_id: string; initial_percent?: number; max_percent?: number }): Promise<CanaryConfig> {
    const result = await this.pool.query(
      `INSERT INTO canary_configs 
        (tenant_id, deployment_id, initial_percent, max_percent, increment_percent, increment_interval_minutes, analysis_window_minutes, success_threshold, rollback_threshold, status, current_percent)
       VALUES ($1, $2, $3, 100, 10, 10, 5, 0.99, 0.95, 'running', $3)
       RETURNING *`,
      [input.tenant_id, input.deployment_id, input.initial_percent || 5]
    );
    return result.rows[0];
  }

  async getCanary(canaryId: string): Promise<CanaryConfig | null> {
    const result = await this.pool.query('SELECT * FROM canary_configs WHERE id = $1', [canaryId]);
    return result.rows[0] || null;
  }

  async analyzeCanary(canaryId: string): Promise<CanaryAnalysis> {
    const canary = await this.getCanary(canaryId);
    if (!canary) throw new Error('Canary not found');

    // Simulated analysis - would get real metrics
    const stableSuccessRate = 0.99;
    const canarySuccessRate = 0.98;

    let recommendation: 'continue' | 'pause' | 'rollback' | 'promote';
    if (canarySuccessRate >= canary.success_threshold) {
      recommendation = canary.current_percent >= canary.max_percent ? 'promote' : 'continue';
    } else if (canarySuccessRate < canary.rollback_threshold) {
      recommendation = 'rollback';
    } else {
      recommendation = 'pause';
    }

    const result = await this.pool.query(
      `INSERT INTO canary_analyses 
        (canary_id, window_start, window_end, stable_success_rate, canary_success_rate, stable_error_rate, canary_error_rate, recommendation)
       VALUES ($1, now() - '5 minutes'::interval, now(), $2, $3, 0.01, 0.02, $4)
       RETURNING *`,
      [canaryId, stableSuccessRate, canarySuccessRate, recommendation]
    );
    return result.rows[0];
  }

  async incrementTraffic(canaryId: string): Promise<CanaryConfig> {
    const canary = await this.getCanary(canaryId);
    if (!canary) throw new Error('Canary not found');

    const newPercent = Math.min(canary.current_percent + canary.increment_percent, canary.max_percent);

    const result = await this.pool.query(
      `UPDATE canary_configs SET current_percent = $2 WHERE id = $1 RETURNING *`,
      [canaryId, newPercent]
    );
    return result.rows[0];
  }

  async rollbackCanary(canaryId: string): Promise<CanaryConfig> {
    const result = await this.pool.query(
      `UPDATE canary_configs SET status = 'rollback', current_percent = 0 WHERE id = $1 RETURNING *`,
      [canaryId]
    );
    return result.rows[0];
  }

  async promoteCanary(canaryId: string): Promise<CanaryConfig> {
    const result = await this.pool.query(
      `UPDATE canary_configs SET status = 'completed', current_percent = 100 WHERE id = $1 RETURNING *`,
      [canaryId]
    );
    return result.rows[0];
  }
}