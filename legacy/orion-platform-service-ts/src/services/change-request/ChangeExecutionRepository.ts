/**
 * ChangeExecutionRepository - Execution steps data access layer
 *
 * Manages execution step records for approved change requests.
 */

import { BaseRepository } from '../../db/base-repository';

export interface ChangeExecutionEntity {
  id: string;
  tenantId: string;
  changeRequestId: string;
  stepOrder: number;
  stepName: string;
  stepType: string; // manual/script/automated
  status: string; // pending/running/completed/failed/skipped
  startedAt: Date | null;
  completedAt: Date | null;
  output: string | null;
  error: string | null;
  executedBy: string | null;
  createdAt: Date;
}

export class ChangeExecutionRepository extends BaseRepository<ChangeExecutionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'change_execution');
  }

  async listByChange(changeRequestId: string): Promise<ChangeExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_execution WHERE change_request_id = $1 ORDER BY step_order ASC`,
      [changeRequestId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, output?: string, error?: string): Promise<ChangeExecutionEntity | undefined> {
    const result = await this.db.query(
      `UPDATE change_execution SET status = $1, output = COALESCE($2, output), error = COALESCE($3, error) WHERE id = $4 RETURNING *`,
      [status, output ?? null, error ?? null, id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async startStep(id: string, executedBy?: string): Promise<ChangeExecutionEntity | undefined> {
    const result = await this.db.query(
      `UPDATE change_execution SET status = 'running', started_at = NOW(), executed_by = $1 WHERE id = $2 AND status = 'pending' RETURNING *`,
      [executedBy ?? null, id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async completeStep(id: string, output?: string): Promise<ChangeExecutionEntity | undefined> {
    const result = await this.db.query(
      `UPDATE change_execution SET status = 'completed', completed_at = NOW(), output = $1 WHERE id = $2 RETURNING *`,
      [output ?? null, id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async failStep(id: string, error: string): Promise<ChangeExecutionEntity | undefined> {
    const result = await this.db.query(
      `UPDATE change_execution SET status = 'failed', completed_at = NOW(), error = $1 WHERE id = $2 RETURNING *`,
      [error, id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async getProgress(changeRequestId: string): Promise<{ total: number; completed: number; failed: number; pending: number; running: number }> {
    const result = await this.db.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'running') as running
      FROM change_execution WHERE change_request_id = $1`,
      [changeRequestId],
    );
    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10),
      completed: parseInt(row.completed, 10),
      failed: parseInt(row.failed, 10),
      pending: parseInt(row.pending, 10),
      running: parseInt(row.running, 10),
    };
  }

  protected mapRowToEntity(row: any): ChangeExecutionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      changeRequestId: row.change_request_id,
      stepOrder: row.step_order,
      stepName: row.step_name,
      stepType: row.step_type ?? 'manual',
      status: row.status ?? 'pending',
      startedAt: row.started_at ?? null,
      completedAt: row.completed_at ?? null,
      output: row.output ?? null,
      error: row.error ?? null,
      executedBy: row.executed_by ?? null,
      createdAt: row.created_at,
    };
  }
}
