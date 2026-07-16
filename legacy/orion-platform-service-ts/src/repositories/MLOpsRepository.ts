/**
 * MLOpsRepository — PostgreSQL data access for MLOps module
 *
 * Manages experiments, experiment runs, model registry, and training jobs.
 * Built on top of BaseRepository with domain-specific queries.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError } from '../errors';

// ==================== Experiment ====================

export interface MLOpsExperimentEntity {
  id: string;
  tenantId: string;
  name: string;
  project?: string;
  status: 'draft' | 'running' | 'completed' | 'failed';
  modelType?: string;
  description?: string;
  metrics?: Record<string, number>;
  hyperparams?: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

export class MLOpsExperimentRepository extends BaseRepository<MLOpsExperimentEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'mlops_experiments');
  }

  async findByTenant(tenantId: string, options?: { status?: string; project?: string }): Promise<MLOpsExperimentEntity[]> {
    let query = 'SELECT * FROM mlops_experiments WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let idx = 2;
    if (options?.status) { query += ` AND status = $${idx++}`; params.push(options.status); }
    if (options?.project) { query += ` AND project = $${idx++}`; params.push(options.project); }
    query += ' ORDER BY created_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async deleteByExperimentId(experimentId: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM mlops_experiments WHERE id = $1', [experimentId]);
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): MLOpsExperimentEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      project: row.project,
      status: row.status,
      modelType: row.model_type,
      description: row.description,
      metrics: row.metrics,
      hyperparams: row.hyperparams,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }
}

// ==================== Experiment Run ====================

export interface MLOpsExperimentRunEntity {
  id: string;
  tenantId: string;
  experimentId: string;
  iteration: number;
  metrics?: Record<string, number>;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

export class MLOpsExperimentRunRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

  async findByExperiment(experimentId: string): Promise<MLOpsExperimentRunEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM ml_experiment_runs WHERE experiment_id = $1 ORDER BY iteration ASC',
      [experimentId],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async create(data: Partial<MLOpsExperimentRunEntity>): Promise<MLOpsExperimentRunEntity> {
    const result = await this.db.query(
      `INSERT INTO ml_experiment_runs (id, tenant_id, experiment_id, iteration, metrics, status, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [data.id, data.tenantId, data.experimentId, data.iteration, data.metrics ?? null, data.status, data.startedAt, data.completedAt ?? null],
    );
    if (result.rows.length === 0) throw new OrionError('INSERT into ml_experiment_runs returned no rows', 'OPERATION_FAILED');
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string, completedAt?: Date, metrics?: Record<string, number>): Promise<MLOpsExperimentRunEntity | null> {
    const result = await this.db.query(
      `UPDATE ml_experiment_runs SET status = $1, completed_at = $2, metrics = COALESCE($3, metrics) WHERE id = $4 RETURNING *`,
      [status, completedAt ?? null, metrics ? JSON.stringify(metrics) : null, id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async countByExperiment(experimentId: string): Promise<number> {
    const result = await this.db.query(
      'SELECT COUNT(*) as count FROM ml_experiment_runs WHERE experiment_id = $1',
      [experimentId],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  protected mapRowToEntity(row: any): MLOpsExperimentRunEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      experimentId: row.experiment_id,
      iteration: row.iteration,
      metrics: row.metrics,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdAt: row.created_at,
    };
  }
}

// ==================== Model ====================

export interface MLOpsModelEntity {
  id: string;
  tenantId: string;
  name: string;
  version: number;
  experimentId?: string;
  status: 'draft' | 'staging' | 'production' | 'archived';
  artifactPath?: string;
  metrics?: Record<string, number>;
  description?: string;
  deployedEndpoint?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MLOpsModelRepository extends BaseRepository<MLOpsModelEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'mlops_models');
  }

  async findByTenant(tenantId: string, options?: { status?: string }): Promise<MLOpsModelEntity[]> {
    let query = 'SELECT * FROM mlops_models WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let idx = 2;
    if (options?.status) { query += ` AND status = $${idx++}`; params.push(options.status); }
    query += ' ORDER BY created_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async findByNameAndTenant(name: string, tenantId: string): Promise<MLOpsModelEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM mlops_models WHERE name = $1 AND tenant_id = $2 ORDER BY version DESC',
      [name, tenantId],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async updateStatus(id: string, status: string): Promise<MLOpsModelEntity | null> {
    const result = await this.db.query(
      `UPDATE mlops_models SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async deployModel(id: string, endpoint: string): Promise<MLOpsModelEntity | null> {
    const result = await this.db.query(
      `UPDATE mlops_models SET status = 'production', deployed_endpoint = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [endpoint, id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  protected mapRowToEntity(row: any): MLOpsModelEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      version: row.version,
      experimentId: row.experiment_id,
      status: row.status,
      artifactPath: row.artifact_path,
      metrics: row.metrics,
      description: row.description,
      deployedEndpoint: row.deployed_endpoint,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== Training Job ====================

export interface MLOpsTrainingJobEntity {
  id: string;
  tenantId: string;
  experimentId?: string;
  modelId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  dataset?: string;
  config?: Record<string, any>;
  logs?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export class MLOpsTrainingJobRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

  async findByTenant(tenantId: string, options?: { status?: string }): Promise<MLOpsTrainingJobEntity[]> {
    let query = 'SELECT * FROM mlops_training_jobs WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let idx = 2;
    if (options?.status) { query += ` AND status = $${idx++}`; params.push(options.status); }
    query += ' ORDER BY created_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async create(data: Partial<MLOpsTrainingJobEntity>): Promise<MLOpsTrainingJobEntity> {
    const result = await this.db.query(
      `INSERT INTO mlops_training_jobs (id, tenant_id, experiment_id, model_id, status, dataset, config, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [data.id, data.tenantId, data.experimentId ?? null, data.modelId ?? null, data.status, data.dataset ?? null, data.config ? JSON.stringify(data.config) : null, data.startedAt ?? null, data.completedAt ?? null],
    );
    if (result.rows.length === 0) throw new OrionError('INSERT into mlops_training_jobs returned no rows', 'OPERATION_FAILED');
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string, startedAt?: Date, completedAt?: Date, logs?: string): Promise<MLOpsTrainingJobEntity | null> {
    const result = await this.db.query(
      `UPDATE mlops_training_jobs SET status = $1, started_at = COALESCE($2, started_at), completed_at = COALESCE($3, completed_at), logs = COALESCE($4, logs) WHERE id = $5 RETURNING *`,
      [status, startedAt ?? null, completedAt ?? null, logs ?? null, id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  protected mapRowToEntity(row: any): MLOpsTrainingJobEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      experimentId: row.experiment_id,
      modelId: row.model_id,
      status: row.status,
      dataset: row.dataset,
      config: row.config,
      logs: row.logs,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdAt: row.created_at,
    };
  }
}
