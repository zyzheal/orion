import { Pool } from 'pg';

type DbClient = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface DeploymentHistoryEntity {
  id: string;
  tenantId: string | null;
  projectId: string | null;
  pipelineRunId: string | null;
  buildId: string | null;
  environment: string;
  status: string;
  strategy: string;
  config: Record<string, unknown> | null;
  deployedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  errorMessage: string | null;
  rollbackTo: string | null;
  commitSha: string | null;
  commitCommittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FindAllResult { entities: DeploymentHistoryEntity[]; total: number; }

export class DeploymentHistoryRepository {
  private pool: DbClient | null;

  constructor(pool: DbClient | null) {
    this.pool = pool;
  }

  /**
   * Create a new deployment history record.
   * Maps camelCase entity fields to snake_case DB columns.
   */
  async create(input: Record<string, unknown>): Promise<DeploymentHistoryEntity> {
    const query = `
      INSERT INTO deploy_deployments (
        id, tenant_id, project_id, pipeline_run_id, build_id, environment,
        status, strategy, config, deployed_by, started_at, completed_at,
        duration_ms, error_message, rollback_to, commit_sha,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const now = new Date();
    const params: unknown[] = [
      input.id,
      input.tenantId ?? null,
      input.projectId ?? null,
      input.pipelineRunId ?? null,
      input.buildId ?? null,
      input.environment ?? 'unknown',
      input.status ?? 'pending',
      input.strategy ?? 'rolling',
      input.config ? JSON.stringify(input.config) : null,
      input.deployedBy ?? null,
      input.startedAt ?? null,
      input.completedAt ?? null,
      input.durationMs ?? null,
      input.errorMessage ?? null,
      input.rollbackTo ?? null,
      input.commitSha ?? null,
      now,
      now,
    ];

    const result = await this.pool!.query(query, params);
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find a deployment history record by ID.
   */
  async findById(id: string): Promise<DeploymentHistoryEntity | null> {
    const result = await this.pool!.query(
      'SELECT * FROM deploy_deployments WHERE id = $1',
      [id]
    );
    return result.rows.length === 0 ? null : this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find deployment history records by pipeline_run_id (alias for findByPipelineRunId).
   */
  async findByRunId(runId: string): Promise<DeploymentHistoryEntity[]> {
    const result = await this.pool!.query(
      'SELECT * FROM deploy_deployments WHERE pipeline_run_id = $1 ORDER BY created_at DESC',
      [runId]
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find all deployment history records with optional limit.
   * Returns entities sorted by created_at DESC plus total count.
   */
  async findAll(opts?: { limit?: number }): Promise<FindAllResult> {
    const limit = opts?.limit ?? 50;

    // Get total count
    const countResult = await this.pool!.query(
      'SELECT COUNT(*) as total FROM deploy_deployments'
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated results
    const dataResult = await this.pool!.query(
      'SELECT * FROM deploy_deployments ORDER BY created_at DESC LIMIT $1',
      [limit]
    );

    return {
      entities: dataResult.rows.map((row) => this.mapRowToEntity(row)),
      total,
    };
  }

  /**
   * Find deployment history records by environment.
   */
  async findByEnvironment(env: string): Promise<DeploymentHistoryEntity[]> {
    const result = await this.pool!.query(
      'SELECT * FROM deploy_deployments WHERE environment = $1 ORDER BY created_at DESC',
      [env]
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find deployment history records by pipeline_run_id.
   */
  async findByPipelineRunId(runId: string): Promise<DeploymentHistoryEntity[]> {
    const result = await this.pool!.query(
      'SELECT * FROM deploy_deployments WHERE pipeline_run_id = $1 ORDER BY created_at DESC',
      [runId]
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find deployment history records by build_id.
   */
  async findByBuildId(buildId: string): Promise<DeploymentHistoryEntity[]> {
    const result = await this.pool!.query(
      'SELECT * FROM deploy_deployments WHERE build_id = $1 ORDER BY created_at DESC',
      [buildId]
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Update deployment status, completion time, and error message.
   * Only updates fields that are explicitly provided.
   */
  async updateStatus(
    id: string,
    status: string,
    completedAt?: Date | null,
    error?: string | null
  ): Promise<void> {
    const setClauses: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: unknown[] = [id, status];

    if (completedAt !== undefined) {
      setClauses.push(`completed_at = $${params.length + 1}`);
      params.push(completedAt);
    }

    if (error !== undefined) {
      setClauses.push(`error_message = $${params.length + 1}`);
      params.push(error);
    }

    const query = `UPDATE deploy_deployments SET ${setClauses.join(', ')} WHERE id = $1`;
    await this.pool!.query(query, params);
  }

  /**
   * Map a database row (snake_case) to the entity (camelCase).
   */
  private mapRowToEntity(row: any): DeploymentHistoryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      pipelineRunId: row.pipeline_run_id,
      buildId: row.build_id,
      environment: row.environment,
      status: row.status,
      strategy: row.strategy,
      config: row.config || null,
      deployedBy: row.deployed_by,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationMs: row.duration_ms ? Number(row.duration_ms) : null,
      errorMessage: row.error_message,
      rollbackTo: row.rollback_to,
      commitSha: row.commit_sha,
      commitCommittedAt: null, // not stored in DB column
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
