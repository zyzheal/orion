/**
 * PipelineBatchRepository - Database layer for Pipeline Batch Execution
 *
 * Handles PostgreSQL operations for pipeline_phase_groups and pipeline_batch_runs tables.
 * Supports batch/progressive execution strategies (percentage, count, label).
 */

import { DatabasePool } from '../database';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

// ==================== Entity Interfaces ====================

export interface PhaseGroup {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  name: string;
  batch_strategy: string;
  batch_config: Record<string, unknown>;
  gate_type: string | null;
  status: string;
  current_batch: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BatchRun {
  id: string;
  tenant_id: string;
  group_id: string;
  batch_index: number;
  batch_size: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  executor_id: string | null;
  result: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== Input Interfaces ====================

export interface CreatePhaseGroupInput {
  pipeline_id: string;
  name: string;
  batch_strategy: string;
  batch_config: Record<string, unknown>;
  gate_type?: string;
  created_by?: string;
}

export interface CreateBatchRunInput {
  group_id: string;
  batch_index: number;
  batch_size: string;
  executor_id?: string;
}

export interface UpdatePhaseGroupInput {
  name?: string;
  batch_strategy?: string;
  batch_config?: Record<string, unknown>;
  gate_type?: string;
  status?: string;
  current_batch?: number;
}

export interface UpdateBatchRunInput {
  status?: string;
  started_at?: Date;
  completed_at?: Date;
  executor_id?: string;
  result?: Record<string, unknown>;
}

export interface ListPhaseGroupsFilter {
  pipelineId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// ==================== Repository ====================

export class PipelineBatchRepository {
  constructor(private pool: DatabasePool) {}

  // ==================== Phase Groups ====================

  async findPhaseGroupById(id: string): Promise<PhaseGroup | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_phase_groups WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async listPhaseGroups(filter?: ListPhaseGroupsFilter): Promise<PhaseGroup[]> {
    let query = 'SELECT * FROM pipeline_phase_groups';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (filter?.pipelineId) {
      params.push(filter.pipelineId);
      conditions.push(`pipeline_id = $${params.length}`);
    }

    if (filter?.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (filter?.limit) {
      params.push(filter.limit);
      query += ` LIMIT $${params.length}`;
    }

    if (filter?.offset) {
      params.push(filter.offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async createPhaseGroup(input: CreatePhaseGroupInput): Promise<PhaseGroup> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO pipeline_phase_groups (tenant_id, pipeline_id, name, batch_strategy, batch_config, gate_type, status, current_batch, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0, $7)
       RETURNING *`,
      [
        tenantId,
        input.pipeline_id,
        input.name,
        input.batch_strategy,
        JSON.stringify(input.batch_config),
        input.gate_type || null,
        input.created_by || null,
      ]
    );
    return result.rows[0];
  }

  async updatePhaseGroup(id: string, input: UpdatePhaseGroupInput): Promise<PhaseGroup | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      setClauses.push(`name = $${paramIndex++}`);
    }
    if (input.batch_strategy !== undefined) {
      params.push(input.batch_strategy);
      setClauses.push(`batch_strategy = $${paramIndex++}`);
    }
    if (input.batch_config !== undefined) {
      params.push(JSON.stringify(input.batch_config));
      setClauses.push(`batch_config = $${paramIndex++}`);
    }
    if (input.gate_type !== undefined) {
      params.push(input.gate_type);
      setClauses.push(`gate_type = $${paramIndex++}`);
    }
    if (input.status !== undefined) {
      params.push(input.status);
      setClauses.push(`status = $${paramIndex++}`);
    }
    if (input.current_batch !== undefined) {
      params.push(input.current_batch);
      setClauses.push(`current_batch = $${paramIndex++}`);
    }

    if (setClauses.length === 0) {
      return this.findPhaseGroupById(id);
    }

    params.push(id);
    const result = await this.pool.query(
      `UPDATE pipeline_phase_groups SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async deletePhaseGroup(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM pipeline_phase_groups WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  // ==================== Batch Runs ====================

  async findBatchRunById(id: string): Promise<BatchRun | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_batch_runs WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async listBatchRunsByGroup(groupId: string): Promise<BatchRun[]> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_batch_runs WHERE group_id = $1 ORDER BY batch_index ASC',
      [groupId]
    );
    return result.rows;
  }

  async createBatchRun(input: CreateBatchRunInput): Promise<BatchRun> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO pipeline_batch_runs (tenant_id, group_id, batch_index, batch_size, status, executor_id)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING *`,
      [
        tenantId,
        input.group_id,
        input.batch_index,
        input.batch_size,
        input.executor_id || null,
      ]
    );
    return result.rows[0];
  }

  async updateBatchRun(id: string, input: UpdateBatchRunInput): Promise<BatchRun | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      params.push(input.status);
      setClauses.push(`status = $${paramIndex++}`);
    }
    if (input.started_at !== undefined) {
      params.push(input.started_at);
      setClauses.push(`started_at = $${paramIndex++}`);
    }
    if (input.completed_at !== undefined) {
      params.push(input.completed_at);
      setClauses.push(`completed_at = $${paramIndex++}`);
    }
    if (input.executor_id !== undefined) {
      params.push(input.executor_id);
      setClauses.push(`executor_id = $${paramIndex++}`);
    }
    if (input.result !== undefined) {
      params.push(JSON.stringify(input.result));
      setClauses.push(`result = $${paramIndex++}`);
    }

    if (setClauses.length === 0) {
      return this.findBatchRunById(id);
    }

    params.push(id);
    const result = await this.pool.query(
      `UPDATE pipeline_batch_runs SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async deleteBatchRunsByGroup(groupId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM pipeline_batch_runs WHERE group_id = $1',
      [groupId]
    );
    return result.rowCount || 0;
  }
}
