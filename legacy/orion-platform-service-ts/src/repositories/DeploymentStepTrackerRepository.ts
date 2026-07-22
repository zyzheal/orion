/**
 * DeploymentStepTrackerRepository — Data access for deployment step runtime tracking
 *
 * GAP-CN-03: 渐进式发布步骤跟踪存储
 */

import { DatabasePool } from '../services/database';

export interface DeploymentStepTrackerEntity {
  id: string;
  run_id: string;
  strategy_id: string;
  strategy_type: string;
  current_step: number;
  total_steps: number;
  current_weight: number;
  status: string; // 'pending' | 'running' | 'healthy' | 'unhealthy' | 'completed' | 'failed' | 'rolledback'
  rollback_reason: string | null;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DeploymentHealthCheckEntity {
  id: string;
  step_tracker_id: string;
  step_index: number;
  endpoint: string;
  status_code: number | null;
  response_time: number | null;
  healthy: boolean;
  error_message: string | null;
  checked_at: Date;
}

export class DeploymentStepTrackerRepository {
  constructor(private pool: DatabasePool) {}

  // ==================== Step Tracker Operations ====================

  /**
   * Find tracker by ID
   */
  async findById(id: string): Promise<DeploymentStepTrackerEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM deployment_step_trackers WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find tracker by run ID
   */
  async findByRunId(runId: string): Promise<DeploymentStepTrackerEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM deployment_step_trackers WHERE run_id = $1 ORDER BY created_at DESC LIMIT 1',
      [runId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new step tracker
   */
  async create(input: {
    run_id: string;
    strategy_id: string;
    strategy_type: string;
    total_steps: number;
  }): Promise<DeploymentStepTrackerEntity> {
    const result = await this.pool.query(
      `INSERT INTO deployment_step_trackers
       (run_id, strategy_id, strategy_type, total_steps, current_step, current_weight, status)
       VALUES ($1, $2, $3, $4, 0, 0, 'pending')
       RETURNING *`,
      [input.run_id, input.strategy_id, input.strategy_type, input.total_steps]
    );
    return result.rows[0];
  }

  /**
   * Update current step and weight
   */
  async advanceStep(
    id: string,
    step: number,
    weight: number
  ): Promise<DeploymentStepTrackerEntity | null> {
    const result = await this.pool.query(
      `UPDATE deployment_step_trackers
       SET current_step = $1, current_weight = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [step, weight, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update tracker status
   */
  async updateStatus(
    id: string,
    status: string,
    completedAt?: Date
  ): Promise<DeploymentStepTrackerEntity | null> {
    const result = await this.pool.query(
      `UPDATE deployment_step_trackers
       SET status = $1, completed_at = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, completedAt || null, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Set rollback reason
   */
  async setRollbackReason(
    id: string,
    reason: string
  ): Promise<DeploymentStepTrackerEntity | null> {
    const result = await this.pool.query(
      `UPDATE deployment_step_trackers
       SET rollback_reason = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason, id]
    );
    return result.rows[0] || null;
  }

  // ==================== Health Check Operations ====================

  /**
   * Record a health check result
   */
  async recordHealthCheck(input: {
    step_tracker_id: string;
    step_index: number;
    endpoint: string;
    status_code: number | null;
    response_time: number | null;
    healthy: boolean;
    error_message: string | null;
  }): Promise<DeploymentHealthCheckEntity> {
    const result = await this.pool.query(
      `INSERT INTO deployment_health_checks
       (step_tracker_id, step_index, endpoint, status_code, response_time, healthy, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.step_tracker_id,
        input.step_index,
        input.endpoint,
        input.status_code,
        input.response_time,
        input.healthy,
        input.error_message,
      ]
    );
    return result.rows[0];
  }

  /**
   * Get health checks for a step tracker
   */
  async getHealthChecks(
    stepTrackerId: string
  ): Promise<DeploymentHealthCheckEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM deployment_health_checks WHERE step_tracker_id = $1 ORDER BY checked_at',
      [stepTrackerId]
    );
    return result.rows;
  }

  /**
   * Get health checks for a specific step
   */
  async getHealthChecksForStep(
    stepTrackerId: string,
    stepIndex: number
  ): Promise<DeploymentHealthCheckEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM deployment_health_checks WHERE step_tracker_id = $1 AND step_index = $2 ORDER BY checked_at',
      [stepTrackerId, stepIndex]
    );
    return result.rows;
  }

  /**
   * Check if all recent health checks for a step are healthy
   */
  async isStepHealthy(
    stepTrackerId: string,
    stepIndex: number
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN healthy THEN 1 ELSE 0 END) as healthy_count
       FROM deployment_health_checks
       WHERE step_tracker_id = $1 AND step_index = $2`,
      [stepTrackerId, stepIndex]
    );
    if (result.rows.length === 0) return true;
    const { total, healthy_count } = result.rows[0];
    return parseInt(total, 10) > 0 && parseInt(total, 10) === parseInt(healthy_count, 10);
  }
}
