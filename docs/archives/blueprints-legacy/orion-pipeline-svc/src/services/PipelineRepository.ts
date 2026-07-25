import { DatabasePool } from '../database';
/**
 * PipelineRepository - Database layer for Pipeline operations
 * 
 * Handles all PostgreSQL database operations for pipelines, stages, runs, and executions
 */


export interface Pipeline {
  id: string;
  tenant_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  trigger_type: string;
  config: Record<string, any>;
  status: string;
  version?: number;
  yamlDefinition?: string;
  spec?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  createdAt?: Date;
  updatedAt?: Date;
  created_by: string | null;
  createdBy?: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  order_index: number;
  timeout: number | null;
  retry_count: number;
  parallel: boolean;
  conditions: Record<string, any>;
  created_at: Date;
}

export interface PipelineRun {
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

export interface StageExecution {
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

export interface CreatePipelineInput {
  tenant_id: string;
  project_id?: string;
  name: string;
  description?: string;
  trigger_type?: string;
  config?: Record<string, any>;
  version?: number;
  yamlDefinition?: string;
  spec?: Record<string, any>;
  created_by?: string;
  createdBy?: string;
}

export interface UpdatePipelineInput {
  name?: string;
  description?: string;
  trigger_type?: string;
  config?: Record<string, any>;
  status?: string;
  version?: number;
  yamlDefinition?: string;
  spec?: Record<string, any>;
}

export interface CreatePipelineRunInput {
  tenant_id: string;
  pipeline_id: string;
  trigger_type?: string;
  trigger_by?: string;
  config_snapshot?: Record<string, any>;
}

interface FindAllOptions {
  tenantId?: string;
  projectId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export class PipelineRepository {
  constructor(private pool: DatabasePool) {}


  // ==================== Pipeline CRUD ====================

  /**
   * Map a raw database row to a Pipeline with extracted config fields
   */
  private mapPipelineRow(row: any): Pipeline {
    const config = row.config as Record<string, any> | null;
    return {
      ...row,
      version: config?.version,
      yamlDefinition: config?.yamlDefinition,
      spec: config?.spec,
    };
  }

  /**
   * Find pipeline by ID
   */
  async findById(id: string): Promise<Pipeline | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipelines WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapPipelineRow(result.rows[0]) : null;
  }

  /**
   * Find all pipelines with filtering and pagination
   */
  async findAll(options?: FindAllOptions): Promise<Pipeline[]> {
    let query = 'SELECT * FROM pipelines';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) {
      params.push(options.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
    }

    if (options?.projectId) {
      params.push(options.projectId);
      conditions.push(`project_id = $${params.length}`);
    }

    if (options?.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }

    if (options?.offset) {
      params.push(options.offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapPipelineRow(row));
  }

  /**
   * Count pipelines
   */
  async count(options?: { tenantId?: string; status?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM pipelines';
    const params: any[] = [];

    if (options?.tenantId || options?.status) {
      const conditions: string[] = [];
      if (options?.tenantId) {
        params.push(options.tenantId);
        conditions.push(`tenant_id = $1`);
      }
      if (options?.status) {
        params.push(options.status);
        conditions.push(`status = $${params.length}`);
      }
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create a new pipeline
   */
  async create(input: CreatePipelineInput): Promise<Pipeline> {
    const { tenant_id, project_id, name, description, trigger_type, config, created_by, createdBy, version, yamlDefinition, spec } = input;
    const creatorId = created_by || createdBy || null;

    // Merge yamlDefinition and version into config for DB storage
    const mergedConfig = {
      ...(config || {}),
      ...(yamlDefinition ? { yamlDefinition } : {}),
      ...(version !== undefined ? { version } : {}),
      ...(spec ? { spec } : {}),
    };

    const result = await this.pool.query(
      `INSERT INTO pipelines (tenant_id, project_id, name, description, trigger_type, config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenant_id, project_id || null, name, description || null, trigger_type || 'manual', mergedConfig, creatorId]
    );

    return result.rows[0];
  }

  /**
   * Update a pipeline
   */
  async update(id: string, input: UpdatePipelineInput): Promise<Pipeline | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      updates.push(`name = $${paramIndex++}`);
    }

    if (input.description !== undefined) {
      params.push(input.description);
      updates.push(`description = $${paramIndex++}`);
    }

    if (input.trigger_type !== undefined) {
      params.push(input.trigger_type);
      updates.push(`trigger_type = $${paramIndex++}`);
    }

    // Handle config update: merge yamlDefinition/version into config
    if (input.config !== undefined || input.yamlDefinition !== undefined || input.version !== undefined || input.spec !== undefined) {
      // First get current config
      const current = await this.findById(id);
      if (current) {
        const mergedConfig = {
          ...(current.config as Record<string, any>),
          ...(input.config || {}),
          ...(input.yamlDefinition !== undefined ? { yamlDefinition: input.yamlDefinition } : {}),
          ...(input.version !== undefined ? { version: input.version } : {}),
          ...(input.spec ? { spec: input.spec } : {}),
        };
        params.push(JSON.stringify(mergedConfig));
        updates.push(`config = $${paramIndex++}`);
      }
    }

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);

    const result = await this.pool.query(
      `UPDATE pipelines SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Delete a pipeline (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE pipelines SET status = 'deleted', updated_at = NOW() WHERE id = $1",
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Find all versions of a pipeline (pipelines with same tenant+name, ordered by version)
   */
  async findVersions(pipelineId: string): Promise<Pipeline[]> {
    const current = await this.findById(pipelineId);
    if (!current) return [];

    // Find all pipelines with same name and tenant (treat each as a "version")
    const result = await this.pool.query(
      'SELECT * FROM pipelines WHERE tenant_id = $1 AND name = $2 ORDER BY created_at DESC',
      [current.tenant_id, current.name]
    );
    return result.rows;
  }

  // ==================== Pipeline Stages ====================

  /**
   * Find stages by pipeline ID
   */
  async findStagesByPipeline(pipelineId: string): Promise<PipelineStage[]> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY order_index',
      [pipelineId]
    );
    return result.rows;
  }

  /**
   * Create a pipeline stage
   */
  async createStage(pipelineId: string, stage: Omit<PipelineStage, 'id' | 'pipeline_id' | 'created_at'>): Promise<PipelineStage> {
    const result = await this.pool.query(
      `INSERT INTO pipeline_stages (pipeline_id, name, type, config, order_index, timeout, retry_count, parallel, conditions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [pipelineId, stage.name, stage.type, stage.config || {}, stage.order_index, stage.timeout, stage.retry_count, stage.parallel, stage.conditions || {}]
    );
    return result.rows[0];
  }

  // ==================== Pipeline Runs ====================

  /**
   * Find run by ID
   */
  async findRunById(id: string): Promise<PipelineRun | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_runs WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find runs by pipeline ID
   */
  async findRunsByPipeline(pipelineId: string, options?: { limit?: number; offset?: number }): Promise<PipelineRun[]> {
    let query = 'SELECT * FROM pipeline_runs WHERE pipeline_id = $1 ORDER BY created_at DESC';
    const params: any[] = [pipelineId];

    if (options?.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }

    if (options?.offset) {
      params.push(options.offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Count runs by pipeline
   */
  async countRuns(pipelineId: string, status?: string): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM pipeline_runs WHERE pipeline_id = $1';
    const params: any[] = [pipelineId];

    if (status) {
      params.push(status);
      query += ` AND status = $2`;
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create a new pipeline run
   */
  async createRun(input: CreatePipelineRunInput): Promise<PipelineRun> {
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
   * Update pipeline run status
   */
  async updateRunStatus(
    id: string, 
    status: string, 
    startedAt?: Date, 
    completedAt?: Date, 
    errorMessage?: string
  ): Promise<PipelineRun | null> {
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
      
      // Calculate duration
      params.push(startedAt ? completedAt.getTime() - startedAt.getTime() : null);
      updates.push(`duration_ms = $${paramIndex++}`);
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

  // ==================== Stage Executions ====================

  /**
   * Find stage executions by run ID
   */
  async findStageExecutions(runId: string): Promise<StageExecution[]> {
    const result = await this.pool.query(
      'SELECT * FROM stage_executions WHERE run_id = $1 ORDER BY created_at',
      [runId]
    );
    return result.rows;
  }

  /**
   * Create a stage execution
   */
  async createStageExecution(runId: string, stageId: string | null, stageName: string): Promise<StageExecution> {
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
  ): Promise<StageExecution | null> {
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

  // ==================== Stats ====================

  /**
   * Get pipeline statistics
   */
  async getPipelineStats(pipelineId: string): Promise<{
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    runningRuns: number;
    avgDuration: number;
  }> {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        AVG(duration_ms) as avg_duration
       FROM pipeline_runs 
       WHERE pipeline_id = $1`,
      [pipelineId]
    );

    const row = result.rows[0];
    return {
      totalRuns: parseInt(row.total || '0', 10),
      successRuns: parseInt(row.success || '0', 10),
      failedRuns: parseInt(row.failed || '0', 10),
      runningRuns: parseInt(row.running || '0', 10),
      avgDuration: parseFloat(row.avg_duration || '0'),
    };
  }
}