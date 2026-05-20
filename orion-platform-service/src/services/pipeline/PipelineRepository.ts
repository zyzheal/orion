/**
 * PipelineRepository - PostgreSQL Repository for Pipeline CRUD operations
 *
 * Maps to the `pipelines`, `pipeline_stages`, `pipeline_runs`, and
 * `stage_executions` tables defined in migration 004/005.
 */

import { DatabasePool } from '../database';
import { BaseRepository } from '../../db/base-repository';

// ==================== Entity Interfaces ====================

export interface Pipeline {
  id: string;
  tenant_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  trigger_type: string;
  config: Record<string, any>;
  status: string;
  version: number;
  yamlDefinition: string | null;
  spec: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
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

export interface PipelineVersion {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  version: number;
  yaml_definition: string;
  spec: Record<string, any>;
  change_summary: string | null;
  tags: string[];
  is_baseline: boolean;
  parent_version_id: string | null;
  created_by: string | null;
  created_at: Date;
}

// ==================== Input Interfaces ====================

export interface CreatePipelineInput {
  tenant_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  trigger_type: string;
  config: Record<string, any>;
  status: string;
  version: number;
  yamlDefinition: string | null;
  spec: Record<string, any> | null;
  created_by: string | null;
}

export interface UpdatePipelineInput {
  description?: string;
  yamlDefinition?: string;
  spec?: Record<string, any>;
  status?: string;
  trigger_type?: string;
  config?: Record<string, any>;
  version?: number;
}

export interface CreatePipelineRunInput {
  tenant_id: string;
  pipeline_id: string;
  trigger_type?: string;
  trigger_by?: string | null;
  config_snapshot?: Record<string, any>;
}

// ==================== Repository Classes ====================

export class PipelineRepository extends BaseRepository<Pipeline> {
  constructor(db: DatabasePool) {
    super(db, 'pipelines');
  }

  async findAll(): Promise<Pipeline[]> {
    const result = await this.db.query(
      `SELECT * FROM pipelines ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string): Promise<Pipeline[]> {
    const result = await this.db.query(
      `SELECT * FROM pipelines WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByProject(projectId: string): Promise<Pipeline[]> {
    const result = await this.db.query(
      `SELECT * FROM pipelines WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByName(name: string, tenantId?: string): Promise<Pipeline | null> {
    let result: any;
    if (tenantId) {
      result = await this.db.query(
        `SELECT * FROM pipelines WHERE name = $1 AND tenant_id = $2`,
        [name, tenantId],
      );
    } else {
      result = await this.db.query(
        `SELECT * FROM pipelines WHERE name = $1`,
        [name],
      );
    }
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findVersions(pipelineId: string): Promise<Pipeline[]> {
    const result = await this.db.query(
      `SELECT * FROM pipelines WHERE id = $1 ORDER BY created_at DESC`,
      [pipelineId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateVersion(id: string, version: number): Promise<Pipeline | null> {
    const result = await this.db.query(
      `UPDATE pipelines SET version = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [version, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async getStats(pipelineId: string): Promise<{
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    runningRuns: number;
    avgDuration: number;
  }> {
    const result = await this.db.query(
      `SELECT
        COUNT(*) as total_runs,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success_runs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_runs,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_runs,
        COALESCE(AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms END), 0) as avg_duration
       FROM pipeline_runs WHERE pipeline_id = $1`,
      [pipelineId],
    );
    const row = result.rows[0];
    return {
      totalRuns: parseInt(row.total_runs, 10) || 0,
      successRuns: parseInt(row.success_runs, 10) || 0,
      failedRuns: parseInt(row.failed_runs, 10) || 0,
      runningRuns: parseInt(row.running_runs, 10) || 0,
      avgDuration: parseFloat(row.avg_duration) || 0,
    };
  }

  protected mapRowToEntity(row: any): Pipeline {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      project_id: row.project_id || null,
      name: row.name,
      description: row.description || null,
      trigger_type: row.trigger_type || 'manual',
      config: row.config || {},
      status: row.status || 'active',
      version: row.version || 1,
      yamlDefinition: row.yaml_definition || null,
      spec: row.spec || null,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
      created_by: row.created_by || null,
    };
  }
}

// ==================== PipelineStageRepository ====================

export class PipelineStageRepository extends BaseRepository<PipelineStage> {
  constructor(db: DatabasePool) {
    super(db, 'pipeline_stages');
  }

  async findByPipeline(pipelineId: string): Promise<PipelineStage[]> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY order_index ASC`,
      [pipelineId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async createForPipeline(
    pipelineId: string,
    input: {
      name: string;
      type: string;
      config?: Record<string, any>;
      order_index: number;
      timeout?: number;
      retry_count?: number;
      parallel?: boolean;
      conditions?: Record<string, any>;
    },
  ): Promise<PipelineStage> {
    const result = await this.db.query(
      `INSERT INTO pipeline_stages (pipeline_id, name, type, config, order_index, timeout, retry_count, parallel, conditions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        pipelineId,
        input.name,
        input.type,
        input.config || {},
        input.order_index,
        input.timeout || null,
        input.retry_count || 0,
        input.parallel || false,
        input.conditions || {},
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): PipelineStage {
    return {
      id: row.id,
      pipeline_id: row.pipeline_id,
      name: row.name,
      type: row.type,
      config: row.config || {},
      order_index: row.order_index,
      timeout: row.timeout || null,
      retry_count: row.retry_count || 0,
      parallel: row.parallel || false,
      conditions: row.conditions || {},
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}

// ==================== PipelineRunRepository ====================

export class PipelineRunRepository extends BaseRepository<PipelineRun> {
  constructor(db: DatabasePool) {
    super(db, 'pipeline_runs');
  }

  async findByPipeline(pipelineId: string, options?: { limit?: number; offset?: number }): Promise<PipelineRun[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const result = await this.db.query(
      `SELECT * FROM pipeline_runs WHERE pipeline_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [pipelineId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string): Promise<PipelineRun[]> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_runs WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(
    id: string,
    status: string,
    startedAt?: Date,
    completedAt?: Date,
    errorMessage?: string,
  ): Promise<PipelineRun | null> {
    const result = await this.db.query(
      `UPDATE pipeline_runs SET status = $1, started_at = $2, completed_at = $3, error_message = $4,
         duration_ms = CASE WHEN $3 IS NOT NULL AND $2 IS NOT NULL
           THEN EXTRACT(EPOCH FROM ($3 - $2) * 1000)::BIGINT
           ELSE duration_ms END,
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status, startedAt || null, completedAt || null, errorMessage || null, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): PipelineRun {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      pipeline_id: row.pipeline_id,
      trigger_type: row.trigger_type || 'manual',
      trigger_by: row.trigger_by || null,
      status: row.status || 'pending',
      config_snapshot: row.config_snapshot || {},
      started_at: row.started_at ? new Date(row.started_at) : null,
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      duration_ms: row.duration_ms || null,
      error_message: row.error_message || null,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}

// ==================== StageExecutionRepository ====================

export class StageExecutionRepository extends BaseRepository<StageExecution> {
  constructor(db: DatabasePool) {
    super(db, 'stage_executions');
  }

  async findByRun(runId: string): Promise<StageExecution[]> {
    const result = await this.db.query(
      `SELECT * FROM stage_executions WHERE run_id = $1 ORDER BY created_at ASC`,
      [runId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(
    id: string,
    status: string,
    startedAt?: Date,
    completedAt?: Date,
    errorMessage?: string,
  ): Promise<StageExecution | null> {
    const result = await this.db.query(
      `UPDATE stage_executions SET status = $1, started_at = $2, completed_at = $3, error_message = $4,
         duration_ms = CASE WHEN $3 IS NOT NULL AND $2 IS NOT NULL
           THEN EXTRACT(EPOCH FROM ($3 - $2) * 1000)::BIGINT
           ELSE duration_ms END
       WHERE id = $5 RETURNING *`,
      [status, startedAt || null, completedAt || null, errorMessage || null, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): StageExecution {
    return {
      id: row.id,
      run_id: row.run_id,
      stage_id: row.stage_id || null,
      stage_name: row.stage_name,
      status: row.status || 'pending',
      started_at: row.started_at ? new Date(row.started_at) : null,
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      duration_ms: row.duration_ms || null,
      error_message: row.error_message || null,
      logs: row.logs || null,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}

export default PipelineRepository;
