/**
 * ProgressiveDeployRepository - Database layer for Progressive Deploy stages
 *
 * Handles PostgreSQL operations for deploy_progressive_stages table
 */

import { DatabasePool } from '../database';

export interface ProgressiveStage {
  id: string;
  tenant_id: string;
  deployment_id: string;
  stage_name: string;
  stage_order: number;
  traffic_percent: number;
  instance_count: number;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  validation_result: Record<string, any>;
  auto_promote: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProgressiveStageInput {
  tenant_id: string;
  deployment_id: string;
  stage_name: string;
  stage_order: number;
  traffic_percent: number;
  instance_count?: number;
  auto_promote?: boolean;
}

export class ProgressiveDeployRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Find progressive stage by ID
   */
  async findById(id: string): Promise<ProgressiveStage | null> {
    const result = await this.pool.query(
      'SELECT * FROM deploy_progressive_stages WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all stages for a deployment
   */
  async findByDeployment(deploymentId: string): Promise<ProgressiveStage[]> {
    const result = await this.pool.query(
      `SELECT * FROM deploy_progressive_stages
       WHERE deployment_id = $1
       ORDER BY stage_order ASC`,
      [deploymentId]
    );
    return result.rows;
  }

  /**
   * Find current (running) stage for a deployment
   */
  async findCurrentStage(deploymentId: string): Promise<ProgressiveStage | null> {
    const result = await this.pool.query(
      `SELECT * FROM deploy_progressive_stages
       WHERE deployment_id = $1 AND status = 'running'
       ORDER BY stage_order ASC
       LIMIT 1`,
      [deploymentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find next pending stage for a deployment
   */
  async findNextPendingStage(deploymentId: string): Promise<ProgressiveStage | null> {
    const result = await this.pool.query(
      `SELECT * FROM deploy_progressive_stages
       WHERE deployment_id = $1 AND status = 'pending'
       ORDER BY stage_order ASC
       LIMIT 1`,
      [deploymentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find previous completed stage for a deployment
   */
  async findPreviousCompletedStage(deploymentId: string, currentOrder: number): Promise<ProgressiveStage | null> {
    const result = await this.pool.query(
      `SELECT * FROM deploy_progressive_stages
       WHERE deployment_id = $1 AND stage_order < $2 AND status = 'completed'
       ORDER BY stage_order DESC
       LIMIT 1`,
      [deploymentId, currentOrder]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new progressive stage
   */
  async create(input: CreateProgressiveStageInput): Promise<ProgressiveStage> {
    const { tenant_id, deployment_id, stage_name, stage_order, traffic_percent, instance_count, auto_promote } = input;

    const result = await this.pool.query(
      `INSERT INTO deploy_progressive_stages
       (tenant_id, deployment_id, stage_name, stage_order, traffic_percent, instance_count, status, auto_promote)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
      [tenant_id, deployment_id, stage_name, stage_order, traffic_percent, instance_count || 1, auto_promote !== false]
    );

    return result.rows[0];
  }

  /**
   * Create multiple stages (batch)
   */
  async createMany(input: CreateProgressiveStageInput[]): Promise<ProgressiveStage[]> {
    const stages: ProgressiveStage[] = [];
    for (const stageInput of input) {
      const stage = await this.create(stageInput);
      stages.push(stage);
    }
    return stages;
  }

  /**
   * Update stage
   */
  async update(id: string, updates: {
    status?: string;
    validation_result?: Record<string, any>;
    started_at?: Date;
    completed_at?: Date;
  }): Promise<ProgressiveStage | null> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      params.push(updates.status);
      setClauses.push(`status = $${paramIndex++}`);
    }

    if (updates.validation_result !== undefined) {
      params.push(JSON.stringify(updates.validation_result));
      setClauses.push(`validation_result = $${paramIndex++}`);
    }

    if (updates.started_at !== undefined) {
      params.push(updates.started_at);
      setClauses.push(`started_at = $${paramIndex++}`);
    }

    if (updates.completed_at !== undefined) {
      params.push(updates.completed_at);
      setClauses.push(`completed_at = $${paramIndex++}`);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.pool.query(
      `UPDATE deploy_progressive_stages SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Count stages by deployment and status
   */
  async countByDeployment(deploymentId: string): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    skipped: number;
  }> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
       FROM deploy_progressive_stages
       WHERE deployment_id = $1`,
      [deploymentId]
    );

    const row = result.rows[0];
    return {
      total: parseInt(row.total || '0', 10),
      pending: parseInt(row.pending || '0', 10),
      running: parseInt(row.running || '0', 10),
      completed: parseInt(row.completed || '0', 10),
      failed: parseInt(row.failed || '0', 10),
      skipped: parseInt(row.skipped || '0', 10),
    };
  }
}
