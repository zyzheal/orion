/**
 * PipelineExecutionControlRepository - Database layer for Pipeline Execution Control
 *
 * Handles PostgreSQL operations for pipeline_pause_resume_log and
 * pipeline_execution_checkpoints tables.
 * Supports pause/resume/abort/retry operations on pipeline runs.
 */

import { DatabasePool } from '../database';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

// ==================== Entity Interfaces ====================

export interface PauseResumeLog {
  id: string;
  tenant_id: string;
  run_id: string;
  action: string;      // 'pause' | 'resume' | 'abort' | 'retry' | 'restart'
  reason: string | null;
  operator: string | null;
  checkpoint_data: Record<string, unknown> | null;
  created_at: Date;
}

export interface ExecutionCheckpoint {
  id: string;
  tenant_id: string;
  run_id: string;
  step_id: string;
  step_type: string;
  status: string;       // 'completed' | 'failed' | 'running'
  checkpoint_data: Record<string, unknown>;
  output_data: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== Input Interfaces ====================

export interface CreatePauseResumeLogInput {
  run_id: string;
  action: string;
  reason?: string;
  operator?: string;
  checkpoint_data?: Record<string, unknown>;
}

export interface CreateCheckpointInput {
  run_id: string;
  step_id: string;
  step_type: string;
  status: string;
  checkpoint_data: Record<string, unknown>;
  output_data?: Record<string, unknown>;
}

export interface UpdateCheckpointInput {
  status?: string;
  checkpoint_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
}

// ==================== Repository ====================

export class PipelineExecutionControlRepository {
  constructor(private pool: DatabasePool) {}

  // ==================== Pause/Resume Logs ====================

  async createPauseResumeLog(input: CreatePauseResumeLogInput): Promise<PauseResumeLog> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO pipeline_pause_resume_log (tenant_id, run_id, action, reason, operator, checkpoint_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tenantId,
        input.run_id,
        input.action,
        input.reason || null,
        input.operator || null,
        input.checkpoint_data ? JSON.stringify(input.checkpoint_data) : null,
      ]
    );
    return result.rows[0];
  }

  async listPauseResumeLogsByRun(runId: string): Promise<PauseResumeLog[]> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_pause_resume_log WHERE run_id = $1 ORDER BY created_at DESC',
      [runId]
    );
    return result.rows;
  }

  async findLatestPauseResumeLog(runId: string, action?: string): Promise<PauseResumeLog | null> {
    let query = 'SELECT * FROM pipeline_pause_resume_log WHERE run_id = $1';
    const params: unknown[] = [runId];

    if (action) {
      params.push(action);
      query += ` AND action = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC LIMIT 1';

    const result = await this.pool.query(query, params);
    return result.rows[0] || null;
  }

  // ==================== Execution Checkpoints ====================

  async createCheckpoint(input: CreateCheckpointInput): Promise<ExecutionCheckpoint> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO pipeline_execution_checkpoints (tenant_id, run_id, step_id, step_type, status, checkpoint_data, output_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        tenantId,
        input.run_id,
        input.step_id,
        input.step_type,
        input.status,
        JSON.stringify(input.checkpoint_data),
        input.output_data ? JSON.stringify(input.output_data) : null,
      ]
    );
    return result.rows[0];
  }

  async findCheckpointById(id: string): Promise<ExecutionCheckpoint | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_execution_checkpoints WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async listCheckpointsByRun(runId: string): Promise<ExecutionCheckpoint[]> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_execution_checkpoints WHERE run_id = $1 ORDER BY created_at ASC',
      [runId]
    );
    return result.rows;
  }

  async findCheckpointByRunAndStep(runId: string, stepId: string): Promise<ExecutionCheckpoint | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_execution_checkpoints WHERE run_id = $1 AND step_id = $2',
      [runId, stepId]
    );
    return result.rows[0] || null;
  }

  async findLatestCheckpoint(runId: string): Promise<ExecutionCheckpoint | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_execution_checkpoints WHERE run_id = $1 ORDER BY created_at DESC LIMIT 1',
      [runId]
    );
    return result.rows[0] || null;
  }

  async findFailedCheckpoint(runId: string): Promise<ExecutionCheckpoint | null> {
    const result = await this.pool.query(
      "SELECT * FROM pipeline_execution_checkpoints WHERE run_id = $1 AND status = 'failed' ORDER BY created_at DESC LIMIT 1",
      [runId]
    );
    return result.rows[0] || null;
  }

  async updateCheckpoint(id: string, input: UpdateCheckpointInput): Promise<ExecutionCheckpoint | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      params.push(input.status);
      setClauses.push(`status = $${paramIndex++}`);
    }
    if (input.checkpoint_data !== undefined) {
      params.push(JSON.stringify(input.checkpoint_data));
      setClauses.push(`checkpoint_data = $${paramIndex++}`);
    }
    if (input.output_data !== undefined) {
      params.push(JSON.stringify(input.output_data));
      setClauses.push(`output_data = $${paramIndex++}`);
    }

    if (setClauses.length === 0) {
      return this.findCheckpointById(id);
    }

    params.push(id);
    const result = await this.pool.query(
      `UPDATE pipeline_execution_checkpoints SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async deleteCheckpointsByRun(runId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM pipeline_execution_checkpoints WHERE run_id = $1',
      [runId]
    );
    return result.rowCount || 0;
  }
}
