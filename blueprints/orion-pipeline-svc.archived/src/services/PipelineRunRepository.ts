import { DatabasePool } from '../database';
/**
 * PipelineRunRepository - Database layer for Pipeline Run operations
 *
 * Handles all PostgreSQL database operations for pipeline_runs,
 * stage_executions, and task_executions tables.
 */


export interface PipelineRunRecord {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  trigger_type: string;
  trigger_by: string | null;
  status: string;
  config_snapshot: Record<string, any>;
  /** Target deployment environment name (e.g., 'development', 'staging', 'production') */
  environment_name: string | null;
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
  /** Target deployment environment name */
  environment_name?: string | null;
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
  constructor(private pool: DatabasePool) {}


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
    const { tenant_id, pipeline_id, trigger_type, trigger_by, environment_name, config_snapshot } = input;

    const result = await this.pool.query(
      `INSERT INTO pipeline_runs (tenant_id, pipeline_id, trigger_type, trigger_by, environment_name, status, config_snapshot)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [tenant_id, pipeline_id, trigger_type || 'manual', trigger_by || null, environment_name || null, config_snapshot || {}]
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
   * Find all pipeline runs with a specific status (for recovery)
   */
  async findByStatus(status: string): Promise<PipelineRunRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_runs WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );
    return result.rows;
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

  // ==================== Pipeline Run State Persistence ====================

  /**
   * 保存 Pipeline 运行状态（用于重启恢复）
   */
  async saveState(input: {
    id: string;
    runId: string;
    pipelineId: string;
    tenantId?: string;
    status: string;
    currentStageId?: string;
    stageResults?: Record<string, any>;
    taskResults?: Record<string, any>;
    stageStates?: Array<{
      stageId: string;
      name: string;
      status: string;
      dependsOn: string[];
      startedAt?: string;
      completedAt?: string;
    }>;
    executionModel?: any;
    yamlContext?: any;
    envOverrides?: Record<string, string>;
    startedAt?: Date;
    finishedAt?: Date;
  }): Promise<void> {
    const {
      id, runId, pipelineId, tenantId, status, currentStageId,
      stageResults, taskResults, stageStates, executionModel, yamlContext,
      envOverrides, startedAt, finishedAt
    } = input;

    await this.pool.query(
      `INSERT INTO pipeline_run_state (
        id, run_id, pipeline_id, tenant_id, status, current_stage_id,
        stage_results, task_results, stage_states, execution_model,
        yaml_context, env_overrides, started_at, finished_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (run_id) DO UPDATE SET
        status = EXCLUDED.status,
        current_stage_id = EXCLUDED.current_stage_id,
        stage_results = EXCLUDED.stage_results,
        task_results = EXCLUDED.task_results,
        stage_states = EXCLUDED.stage_states,
        execution_model = EXCLUDED.execution_model,
        yaml_context = EXCLUDED.yaml_context,
        env_overrides = EXCLUDED.env_overrides,
        finished_at = EXCLUDED.finished_at,
        updated_at = NOW(),
        version = pipeline_run_state.version + 1`,
      [
        id, runId, pipelineId, tenantId || null, status, currentStageId || null,
        JSON.stringify(stageResults || {}),
        JSON.stringify(taskResults || {}),
        JSON.stringify(stageStates || []),
        executionModel ? JSON.stringify(executionModel) : null,
        yamlContext ? JSON.stringify(yamlContext) : null,
        JSON.stringify(envOverrides || {}),
        startedAt || null, finishedAt || null
      ]
    );
  }

  /**
   * 加载 Pipeline 运行状态（用于重启恢复）
   */
  async loadState(runId: string): Promise<{
    id: string;
    runId: string;
    pipelineId: string;
    tenantId?: string;
    status: string;
    currentStageId?: string;
    stageResults: Record<string, any>;
    taskResults: Record<string, any>;
    stageStates: Array<{
      stageId: string;
      name: string;
      status: string;
      dependsOn: string[];
      startedAt?: string;
      completedAt?: string;
    }>;
    executionModel?: any;
    yamlContext?: any;
    envOverrides: Record<string, string>;
    startedAt?: Date;
    finishedAt?: Date;
  } | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_run_state WHERE run_id = $1',
      [runId]
    );

    if (!result.rows[0]) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      runId: row.run_id,
      pipelineId: row.pipeline_id,
      tenantId: row.tenant_id,
      status: row.status,
      currentStageId: row.current_stage_id,
      stageResults: row.stage_results || {},
      taskResults: row.task_results || {},
      stageStates: row.stage_states || [],
      executionModel: row.execution_model,
      yamlContext: row.yaml_context,
      envOverrides: row.env_overrides || {},
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    };
  }

  /**
   * 更新 Pipeline 运行状态
   */
  async updateState(
    runId: string,
    updates: {
      status?: string;
      currentStageId?: string;
      stageResults?: Record<string, any>;
      taskResults?: Record<string, any>;
      stageStates?: Array<any>;
      finishedAt?: Date;
    }
  ): Promise<void> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      params.push(updates.status);
      setClauses.push(`status = $${paramIndex++}`);
    }

    if (updates.currentStageId !== undefined) {
      params.push(updates.currentStageId);
      setClauses.push(`current_stage_id = $${paramIndex++}`);
    }

    if (updates.stageResults !== undefined) {
      params.push(JSON.stringify(updates.stageResults));
      setClauses.push(`stage_results = $${paramIndex++}`);
    }

    if (updates.taskResults !== undefined) {
      params.push(JSON.stringify(updates.taskResults));
      setClauses.push(`task_results = $${paramIndex++}`);
    }

    if (updates.stageStates !== undefined) {
      params.push(JSON.stringify(updates.stageStates));
      setClauses.push(`stage_states = $${paramIndex++}`);
    }

    if (updates.finishedAt) {
      params.push(updates.finishedAt);
      setClauses.push(`finished_at = $${paramIndex++}`);
    }

    params.push(runId);

    await this.pool.query(
      `UPDATE pipeline_run_state SET ${setClauses.join(', ')}
       WHERE run_id = $${paramIndex}`,
      params
    );
  }

  /**
   * 查找所有未完成的运行（用于启动时恢复）
   */
  async findUnfinishedRuns(): Promise<Array<{
    id: string;
    runId: string;
    pipelineId: string;
    tenantId?: string;
    status: string;
    currentStageId?: string;
    stageResults: Record<string, any>;
    taskResults: Record<string, any>;
    stageStates: Array<any>;
    executionModel?: any;
    yamlContext?: any;
    envOverrides: Record<string, string>;
    startedAt?: Date;
    finishedAt?: Date;
  }>> {
    const result = await this.pool.query(
      `SELECT * FROM pipeline_run_state
       WHERE status IN ('running', 'pending')
       ORDER BY created_at DESC`
    );

    return result.rows.map(row => ({
      id: row.id,
      runId: row.run_id,
      pipelineId: row.pipeline_id,
      tenantId: row.tenant_id,
      status: row.status,
      currentStageId: row.current_stage_id,
      stageResults: row.stage_results || {},
      taskResults: row.task_results || {},
      stageStates: row.stage_states || [],
      executionModel: row.execution_model,
      yamlContext: row.yaml_context,
      envOverrides: row.env_overrides || {},
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    }));
  }

  /**
   * 删除运行状态记录
   */
  async deleteState(runId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM pipeline_run_state WHERE run_id = $1',
      [runId]
    );
    return (result.rowCount || 0) > 0;
  }
}
