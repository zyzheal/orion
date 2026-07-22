import { BaseRepository } from '../db/base-repository';

export interface DeploymentHistoryEntity {
  id: string;
  tenantId: string;
  projectId: string | null;
  pipelineRunId: string | null;
  buildId: string | null;
  environment: string;
  status: string;
  strategy: string;
  config: Record<string, any>;
  deployedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  errorMessage: string | null;
  rollbackTo: string | null;
  commitSha: string | null;
  commitCommittedAt: Date | null;
  createdAt: Date;
}

export class DeploymentHistoryRepository extends BaseRepository<DeploymentHistoryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'deployments');
  }

  async findByTenantId(tenantId: string, limit?: number): Promise<DeploymentHistoryEntity[]> {
    const limitValue = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM deployments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limitValue],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByEnvironment(environment: string): Promise<DeploymentHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM deployments WHERE environment = $1 ORDER BY started_at DESC`,
      [environment],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<DeploymentHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM deployments WHERE status = $1 ORDER BY started_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByProjectId(projectId: string): Promise<DeploymentHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM deployments WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, completedAt?: Date, errorMessage?: string): Promise<void> {
    const query = errorMessage
      ? `UPDATE deployments SET status = $1, completed_at = $2, error_message = $3 WHERE id = $4`
      : `UPDATE deployments SET status = $1, completed_at = $2 WHERE id = $3`;
    const params = errorMessage
      ? [status, completedAt ?? null, errorMessage, id]
      : [status, completedAt ?? null, id];
    await this.db.query(query, params);
  }

  async findRecent(limit: number = 100): Promise<DeploymentHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM deployments ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): DeploymentHistoryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      pipelineRunId: row.pipeline_run_id,
      buildId: row.build_id,
      environment: row.environment,
      status: row.status ?? 'pending',
      strategy: row.strategy ?? 'rolling',
      config: row.config ?? {},
      deployedBy: row.deployed_by,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationMs: row.duration_ms,
      errorMessage: row.error_message,
      rollbackTo: row.rollback_to,
      commitSha: row.commit_sha,
      commitCommittedAt: row.commit_committed_at,
      createdAt: row.created_at,
    };
  }
}