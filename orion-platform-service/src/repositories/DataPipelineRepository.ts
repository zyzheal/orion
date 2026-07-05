/**
 * DataPipelineRepository — PostgreSQL data access for data pipelines
 *
 * Manages the data_pipelines table which stores ETL/ELT pipeline definitions.
 */

import { BaseRepository } from '../db/base-repository';
import { FindAllResult } from '../db/base-repository';

export interface DataPipelineEntity {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  stages: unknown[];
  status: string;
  schedule?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class DataPipelineRepository extends BaseRepository<DataPipelineEntity> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'data_pipelines');
  }

  /**
   * Expose the db query interface for derived repositories (e.g. PipelineVersionRepository)
   * Task 5.8
   */
  getDb(): { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } {
    return this.db;
  }

  async findByTenant(tenantId: string): Promise<DataPipelineEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM data_pipelines WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async findByStatus(tenantId: string, status: string): Promise<DataPipelineEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM data_pipelines WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC',
      [tenantId, status],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async updateStatus(id: string, status: string): Promise<DataPipelineEntity | null> {
    const result = await this.db.query(
      `UPDATE data_pipelines SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async updatePipeline(
    id: string,
    name: string,
    description: string,
    stages: unknown[],
    schedule?: string,
  ): Promise<DataPipelineEntity | null> {
    const result = await this.db.query(
      `UPDATE data_pipelines
       SET name = $1, description = $2, stages = $3, schedule = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, description, JSON.stringify(stages), schedule || null, id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async updateRunInfo(id: string, lastRunAt?: string, nextRunAt?: string): Promise<DataPipelineEntity | null> {
    const result = await this.db.query(
      `UPDATE data_pipelines
       SET last_run_at = $1, next_run_at = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [lastRunAt || null, nextRunAt || null, id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  protected mapRowToEntity(row: any): DataPipelineEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description === '' ? undefined : row.description,
      stages: row.stages,
      status: row.status,
      schedule: row.schedule || undefined,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at).toISOString() : undefined,
      nextRunAt: row.next_run_at ? new Date(row.next_run_at).toISOString() : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }
}

export interface PipelineExecutionEntity {
  id: string;
  pipelineId: string;
  tenantId: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface StageResultEntity {
  id?: number;
  executionId: string;
  pipelineId: string;
  tenantId: string;
  stageId: string;
  stageName: string;
  status: string;
  recordsProcessed: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  createdAt?: string;
}

export class PipelineExecutionRepository {
  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  async findById(id: string): Promise<PipelineExecutionEntity | undefined> {
    const result = await this.db.query(
      'SELECT * FROM pipeline_executions WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapExecutionRow(result.rows[0]);
  }

  async findByPipeline(pipelineId: string): Promise<PipelineExecutionEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM pipeline_executions WHERE pipeline_id = $1 ORDER BY created_at DESC',
      [pipelineId],
    );
    return result.rows.map(r => this.mapExecutionRow(r));
  }

  async findAllByTenant(tenantId: string, limit = 100): Promise<PipelineExecutionEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM pipeline_executions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [tenantId, limit],
    );
    return result.rows.map(r => this.mapExecutionRow(r));
  }

  async create(data: {
    id: string;
    pipelineId: string;
    tenantId: string;
    status: string;
    startedAt?: string;
  }): Promise<PipelineExecutionEntity> {
    const result = await this.db.query(
      `INSERT INTO pipeline_executions (id, pipeline_id, tenant_id, status, started_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [data.id, data.pipelineId, data.tenantId, data.status, data.startedAt || new Date().toISOString()],
    );
    return this.mapExecutionRow(result.rows[0]);
  }

  async markRunning(id: string): Promise<void> {
    await this.db.query(
      `UPDATE pipeline_executions SET status = 'running', started_at = COALESCE(started_at, NOW()) WHERE id = $1`,
      [id],
    );
  }

  async markCompleted(id: string): Promise<void> {
    await this.db.query(
      `UPDATE pipeline_executions SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async markFailed(id: string, error?: string): Promise<void> {
    await this.db.query(
      `UPDATE pipeline_executions SET status = 'failed', completed_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async bulkUpsertStageResults(stageResults: Array<{
    executionId: string;
    pipelineId: string;
    tenantId: string;
    stageId: string;
    stageName: string;
    status: string;
    recordsProcessed: number;
    startedAt?: string;
    completedAt?: string;
    error?: string;
  }>): Promise<void> {
    for (const sr of stageResults) {
      await this.db.query(
        `INSERT INTO stage_results
         (execution_id, pipeline_id, tenant_id, stage_id, stage_name, status, records_processed, started_at, completed_at, error, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT DO NOTHING`,
        [
          sr.executionId,
          sr.pipelineId,
          sr.tenantId,
          sr.stageId,
          sr.stageName,
          sr.status,
          sr.recordsProcessed,
          sr.startedAt || null,
          sr.completedAt || null,
          sr.error || null,
        ],
      );
    }
  }

  async findStageResultsByExecution(executionId: string): Promise<StageResultEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM stage_results WHERE execution_id = $1 ORDER BY stage_id',
      [executionId],
    );
    return result.rows.map(r => this.mapStageResultRow(r));
  }

  async findByPipelineAndStatus(pipelineId: string): Promise<StageResultEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM stage_results WHERE pipeline_id = $1 ORDER BY created_at',
      [pipelineId],
    );
    return result.rows.map(r => this.mapStageResultRow(r));
  }

  private mapExecutionRow(row: any): PipelineExecutionEntity {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      tenantId: row.tenant_id,
      status: row.status,
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapStageResultRow(row: any): StageResultEntity {
    return {
      id: row.id,
      executionId: row.execution_id,
      pipelineId: row.pipeline_id,
      tenantId: row.tenant_id,
      stageId: row.stage_id,
      stageName: row.stage_name,
      status: row.status,
      recordsProcessed: row.records_processed ?? 0,
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
      error: row.error || undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    };
  }
}

// ==================== PipelineVersionRepository ====================

/**
 * Pipeline version entity — immutable snapshot of a pipeline definition
 */
export interface PipelineVersionEntity {
  id: string;
  pipelineId: string;
  tenantId: string;
  versionNumber: number;
  name: string;
  description: string | null;
  stages: unknown[];
  schedule: string | null;
  inputConfig: Record<string, unknown>;
  processors: Record<string, unknown>[];
  outputConfig: Record<string, unknown>;
  createdBy: string;
  changeSummary: string | null;
  createdAt: string;
}

export class PipelineVersionRepository {
  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  /**
   * Create a version snapshot of a pipeline
   */
  async create(input: {
    pipelineId: string;
    tenantId: string;
    versionNumber: number;
    name: string;
    description?: string | null;
    stages: unknown[];
    schedule?: string | null;
    inputConfig: Record<string, unknown>;
    processors: Record<string, unknown>[];
    outputConfig: Record<string, unknown>;
    createdBy: string;
    changeSummary?: string | null;
  }): Promise<PipelineVersionEntity> {
    const id = 'pv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const result = await this.db.query(
      `INSERT INTO pipeline_versions (id, pipeline_id, tenant_id, version_number, name, description, stages, schedule, input_config, processors, output_config, created_by, change_summary, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()) RETURNING *`,
      [
        id,
        input.pipelineId,
        input.tenantId,
        input.versionNumber,
        input.name,
        input.description || null,
        JSON.stringify(input.stages),
        input.schedule || null,
        JSON.stringify(input.inputConfig),
        JSON.stringify(input.processors),
        JSON.stringify(input.outputConfig),
        input.createdBy,
        input.changeSummary || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * List all versions for a pipeline
   */
  async findByPipelineId(pipelineId: string, tenantId: string): Promise<PipelineVersionEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM pipeline_versions WHERE pipeline_id = $1 AND tenant_id = $2 ORDER BY version_number DESC',
      [pipelineId, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get a specific version by pipeline ID and version number
   */
  async findByVersion(pipelineId: string, tenantId: string, versionNumber: number): Promise<PipelineVersionEntity | undefined> {
    const result = await this.db.query(
      'SELECT * FROM pipeline_versions WHERE pipeline_id = $1 AND tenant_id = $2 AND version_number = $3',
      [pipelineId, tenantId, versionNumber],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Get the latest version number for a pipeline
   */
  async getLatestVersion(pipelineId: string, tenantId: string): Promise<number> {
    const result = await this.db.query(
      'SELECT MAX(version_number) as max_version FROM pipeline_versions WHERE pipeline_id = $1 AND tenant_id = $2',
      [pipelineId, tenantId],
    );
    return result.rows[0]?.max_version || 0;
  }

  protected mapRowToEntity(row: any): PipelineVersionEntity {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      tenantId: row.tenant_id,
      versionNumber: row.version_number,
      name: row.name,
      description: row.description,
      stages: typeof row.stages === 'string' ? JSON.parse(row.stages) : row.stages,
      schedule: row.schedule,
      inputConfig: typeof row.input_config === 'string' ? JSON.parse(row.input_config) : row.input_config,
      processors: typeof row.processors === 'string' ? JSON.parse(row.processors) : row.processors,
      outputConfig: typeof row.output_config === 'string' ? JSON.parse(row.output_config) : row.output_config,
      createdBy: row.created_by,
      changeSummary: row.change_summary,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }
}
