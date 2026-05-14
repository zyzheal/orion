import { BaseRepository } from '../db/base-repository';

export interface RollbackEntity {
  id: string;
  deploymentId: string;
  rollbackType: string;
  reason: string | null;
  triggeredBy: string | null;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  previousVersion: string | null;
  targetVersion: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export class RollbackRepository extends BaseRepository<RollbackEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'rollback_history');
  }

  async findByDeploymentId(deploymentId: string): Promise<RollbackEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM rollback_history WHERE deployment_id = $1 ORDER BY started_at DESC`,
      [deploymentId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<RollbackEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM rollback_history WHERE status = $1 ORDER BY started_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, completedAt?: Date, errorMessage?: string): Promise<void> {
    const query = errorMessage
      ? `UPDATE rollback_history SET status = $1, completed_at = $2, error_message = $3 WHERE id = $4`
      : `UPDATE rollback_history SET status = $1, completed_at = $2 WHERE id = $3`;
    const params = errorMessage
      ? [status, completedAt ?? null, errorMessage, id]
      : [status, completedAt ?? null, id];
    await this.db.query(query, params);
  }

  async findRecent(limit: number = 100): Promise<RollbackEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM rollback_history ORDER BY started_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): RollbackEntity {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      rollbackType: row.rollback_type ?? 'manual',
      reason: row.reason,
      triggeredBy: row.triggered_by,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status ?? 'running',
      previousVersion: row.previous_version,
      targetVersion: row.target_version,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
}