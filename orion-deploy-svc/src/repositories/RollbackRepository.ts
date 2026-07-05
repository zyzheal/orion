import { Pool } from 'pg';

type DbClient = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface RollbackEntity {
  id: string;
  deploymentId: string;
  rollbackType: string;
  reason: string;
  triggeredBy: string;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  previousVersion: string | null;
  targetVersion: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface FindAllResult { entities: RollbackEntity[]; total: number; }

export class RollbackRepository {
  private pool: DbClient | null;

  constructor(pool: DbClient | null) {
    this.pool = pool;
  }

  /**
   * Create a new rollback record.
   * Maps camelCase entity fields to snake_case DB columns.
   */
  async create(input: Record<string, unknown>): Promise<RollbackEntity> {
    const query = `
      INSERT INTO deploy_rollbacks (
        id, deployment_id, rollback_type, reason, triggered_by,
        started_at, completed_at, status, previous_version,
        target_version, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const params: unknown[] = [
      input.id,
      input.deploymentId,
      input.rollbackType ?? 'manual',
      input.reason ?? null,
      input.triggeredBy,
      input.startedAt ?? new Date(),
      input.completedAt ?? null,
      input.status ?? 'pending',
      input.previousVersion ?? null,
      input.targetVersion ?? null,
      input.errorMessage ?? null,
      input.createdAt ?? new Date(),
    ];

    const result = await this.pool!.query(query, params);
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find a rollback by ID.
   */
  async findById(id: string): Promise<RollbackEntity | null> {
    const result = await this.pool!.query(
      'SELECT * FROM deploy_rollbacks WHERE id = $1',
      [id]
    );
    return result.rows.length === 0 ? null : this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find a rollback by deployment_id (alias for findByDeploymentId, returns single).
   */
  async findByRunId(runId: string): Promise<RollbackEntity | null> {
    const result = await this.pool!.query(
      'SELECT * FROM deploy_rollbacks WHERE deployment_id = $1 ORDER BY created_at DESC LIMIT 1',
      [runId]
    );
    return result.rows.length === 0 ? null : this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all rollbacks for a given deployment.
   */
  async findByDeploymentId(deploymentId: string): Promise<RollbackEntity[]> {
    const result = await this.pool!.query(
      'SELECT * FROM deploy_rollbacks WHERE deployment_id = $1 ORDER BY created_at DESC',
      [deploymentId]
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find all rollback records with optional limit.
   * Returns entities sorted by created_at DESC plus total count.
   */
  async findAll(opts?: { limit?: number }): Promise<FindAllResult> {
    const limit = opts?.limit ?? 50;

    // Get total count
    const countResult = await this.pool!.query(
      'SELECT COUNT(*) as total FROM deploy_rollbacks'
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated results
    const dataResult = await this.pool!.query(
      'SELECT * FROM deploy_rollbacks ORDER BY created_at DESC LIMIT $1',
      [limit]
    );

    return {
      entities: dataResult.rows.map((row) => this.mapRowToEntity(row)),
      total,
    };
  }

  /**
   * Update rollback status, completion time, and error message.
   * Only updates fields that are explicitly provided.
   */
  async updateStatus(
    id: string,
    status: string,
    completedAt?: Date,
    error?: string
  ): Promise<void> {
    const setClauses: string[] = ['status = $2'];
    const params: unknown[] = [id, status];

    if (completedAt !== undefined) {
      setClauses.push(`completed_at = $${params.length + 1}`);
      params.push(completedAt);
    }

    if (error !== undefined) {
      setClauses.push(`error_message = $${params.length + 1}`);
      params.push(error);
    }

    const query = `UPDATE deploy_rollbacks SET ${setClauses.join(', ')} WHERE id = $1`;
    await this.pool!.query(query, params);
  }

  /**
   * Map a database row (snake_case) to the entity (camelCase).
   */
  private mapRowToEntity(row: any): RollbackEntity {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      rollbackType: row.rollback_type,
      reason: row.reason,
      triggeredBy: row.triggered_by,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      previousVersion: row.previous_version,
      targetVersion: row.target_version,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
}
