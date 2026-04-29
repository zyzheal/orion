/**
 * PipelineRunRepository - Database layer for Pipeline Run operations
 *
 * Handles all PostgreSQL database operations for pipeline_runs,
 * stage_executions, and task_executions tables.
 */

import { DatabasePool } from '../database';

export interface PipelineRunRecord {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  trigger_type: string;
  trigger_by: string | null;
  status: string;
  config_snapshot: Record<string, any>;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: Date;
}

export interface StageExecutionRecord {
  id: string;
  run_id: string;
  stage_id: string | null;
  stage_name: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  error_message: string | null;
  logs: string | null;
  created_at: Date;
}

export interface TaskExecutionRecord {
  id: string;
  execution_id: string;
  task_name: string;
  task_type: string;
  status: string;
  input: Record<string, any>;
  output: Record<string, any> | null;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  error_message: string | null;
  logs: string | null;
  created_at: Date;
}

export interface CreateRunInput {
  tenant_id: string;
  pipeline_id: string;
  trigger_type?: string;
  trigger_by?: string;
  config_snapshot?: Record<string, any>;
}

export interface ListRunsFilter {
  tenantId?: string;
  pipelineId?: string;
  status?: string | string[];
  triggerType?: string;
  since?: Date;
  limit?: number;
  offset?: number;
}

export class PipelineRunRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  // ==================== Pipeline Runs ====================

  /**
   * Find run by ID
   */
  async findById(id: string): Promise<PipelineRunRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_runs WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find runs with filtering and pagination
   */
  async findAll(filter?: ListRunsFilter): Promise<PipelineRunRecord[]> {
    let query = 'SELECT * FROM pipeline_runs';
    const params: any[] = [];
    const conditions: string[] = [];

    if (filter?.tenantId) {
      params.push(filter.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
    }

    if (filter?.pipelineId) {
      params.push(filter.pipelineId);
      conditions.push(`pipeline_id = $${params.length}`);
    }

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (statuses.length === 1) {
        params.push(statuses[0]);
        conditions.push(`status = $${params.length}`);
      } else {
        params.push(...statuses);
        const placeholders = statuses.map((_, i) => `$${params.length - statuses.length + i + 1}`).join(', ');
        conditions.push(`status IN (${placeholders})`);
      }
    }

    if (filter?.triggerType) {
      params.push(filter.triggerType);
      conditions.push(`trigger_type = $${params.length}`);
    }

    if (filter?.since) {
      params.push(filter.since);
      conditions.push(`created_at >= $${params.length}`);
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

  /**
   * Count runs with filtering
   */
  async count(filter?: { pipelineId?: string; status?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM pipeline_runs';
    const params: any[] = [];
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

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create a new pipeline run
   */
  async create(input: CreateRunInput): Promise<PipelineRunRecord> {
    const { tenant_id, pipeline_id, trigger_type, trigger_by, config_snapshot } = input;

    const result = await this.pool.query(
      `INSERT INTO pipeline_runs (tenant_id, pipeline_id, trigger_type, trigger_by, status, config_snapshot)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING *`,
      [tenant_id, pipeline_id, trigger_type || 'manual', trigger_by || null, config_snapshot || {}]
    );

    return result.rows[0];
  }

  /**
   * Update run status
   */
  async updateStatus(
    id: string,
    status: string,
    startedAt?: Date,
    completedAt?: Date,
    errorMessage?: string
  ): Promise<PipelineRunRecord | null> {
    const updates: string[] = ['status = $1'];
    const params: any[] = [status];
    let paramIndex = 2;

    if (startedAt) {
      params.push(startedAt);
      updates.push(`started_at = $${paramIndex++}`);
    }

    if (completedAt) {
      params.push(completedAt);
      updates.push(`completed_at = $${paramIndex++}`);

      if (startedAt) {
        params.push(completedAt.getTime() - startedAt.getTime());
        updates.push(`duration_ms = $${paramIndex++}`);
      }
    }

    if (errorMessage) {
      params.push(errorMessage);
      updates.push(`error_message = $${paramIndex++}`);
    }

    params.push(id);

    const result = await this.pool.query(
      `UPDATE pipeline_runs SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Delete a run (hard delete)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM pipeline_runs WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  // ==================== Stage Executions ====================

  /**
   * Find stage executions by run ID
   */
  async findStageExecutionsByRun(runId: string): Promise<StageExecutionRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM stage_executions WHERE run_id = $1 ORDER BY created_at',
      [runId]
    );
    return result.rows;
  }

  /**
   * Find stage execution by ID
   */
  async findStageExecutionById(id: string): Promise<StageExecutionRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM stage_executions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a stage execution record
   */
  async createStageExecution(
    runId: string,
    stageId: string | null,
    stageName: string
  ): Promise<StageExecutionRecord> {
    const result = await this.pool.query(
      `INSERT INTO stage_executions (run_id, stage_id, stage_name, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [runId, stageId, stageName]
    );
    return result.rows[0];
  }

  /**
   * Update stage execution status
   */
  async updateStageExecutionStatus(
    id: string,
    status: string,
    startedAt?: Date,
    completedAt?: Date,
    errorMessage?: string,
    logs?: string
  ): Promise<StageExecutionRecord | null> {
    const updates: string[] = ['status = $1'];
    const params: any[] = [status];
    let paramIndex = 2;

    if (startedAt) {
      params.push(startedAt);
      updates.push(`started_at = $${paramIndex++}`);
    }

    if (completedAt) {
      params.push(completedAt);
      updates.push(`completed_at = $${paramIndex++}`);

      if (startedAt) {
        params.push(completedAt.getTime() - startedAt.getTime());
        updates.push(`duration_ms = $${paramIndex++}`);
      }
    }

    if (errorMessage) {
      params.push(errorMessage);
      updates.push(`error_message = $${paramIndex++}`);
    }

    if (logs) {
      params.push(logs);
      updates.push(`logs = $${paramIndex++}`);
    }

    params.push(id);

    const result = await this.pool.query(
      `UPDATE stage_executions SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  // ==================== Task Executions ====================

  /**
   * Find task executions by stage execution ID
   */
  async findTaskExecutionsByExecution(executionId: string): Promise<TaskExecutionRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM task_executions WHERE execution_id = $1 ORDER BY created_at',
      [executionId]
    );
    return result.rows;
  }

  /**
   * Find task execution by ID
   */
  async findTaskExecutionById(id: string): Promise<TaskExecutionRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM task_executions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a task execution record
   */
  async createTaskExecution(
    executionId: string,
    taskName: string,
    taskType: string,
    input?: Record<string, any>
  ): Promise<TaskExecutionRecord> {
    const result = await this.pool.query(
      `INSERT INTO task_executions (execution_id, task_name, task_type, status, input)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [executionId, taskName, taskType, input || {}]
    );
    return result.rows[0];
  }

  /**
   * Update task execution
   */
  async updateTaskExecution(
    id: string,
    updates: {
      status?: string;
      output?: Record<string, any>;
      startedAt?: Date;
      completedAt?: Date;
      errorMessage?: string;
      logs?: string;
    }
  ): Promise<TaskExecutionRecord | null> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      params.push(updates.status);
      setClauses.push(`status = $${paramIndex++}`);
    }

    if (updates.output !== undefined) {
      params.push(JSON.stringify(updates.output));
      setClauses.push(`output = $${paramIndex++}`);
    }

    if (updates.startedAt !== undefined) {
      params.push(updates.startedAt);
      setClauses.push(`started_at = $${paramIndex++}`);
    }

    if (updates.completedAt !== undefined) {
      params.push(updates.completedAt);
      setClauses.push(`completed_at = $${paramIndex++}`);
    }

    if (updates.errorMessage !== undefined) {
      params.push(updates.errorMessage);
      setClauses.push(`error_message = $${paramIndex++}`);
    }

    if (updates.logs !== undefined) {
      params.push(updates.logs);
      setClauses.push(`logs = $${paramIndex++}`);
    }

    if (setClauses.length === 0) {
      return this.findTaskExecutionById(id);
    }

    params.push(id);

    const result = await this.pool.query(
      `UPDATE task_executions SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }
}
