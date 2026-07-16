/**
 * EfficiencyPipelineRecordRepository
 * Data access layer for efficiency pipeline completion records.
 * Replaces in-memory Map<string, PipelineCompletionRecord> in EventHandler.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

export interface EfficiencyPipelineRecordEntity {
  id: string;
  tenantId: string;
  runId: string;
  pipelineId: string;
  status: string;
  triggerType: string | null;
  gitRef: string | null;
  gitSha: string | null;
  durationMs: number;
  completedAt: Date;
  syncedToClickhouse: boolean;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EfficiencyPipelineRecordRepository extends BaseRepository<EfficiencyPipelineRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'efficiency_pipeline_records');
  }

  async create(data: any): Promise<EfficiencyPipelineRecordEntity> {
    const columns = ['tenant_id', 'run_id', 'pipeline_id', 'status', 'trigger_type', 'git_ref', 'git_sha', 'duration_ms', 'completed_at', 'synced_to_clickhouse'];
    const values = [data.tenantId, data.runId, data.pipelineId, data.status, data.triggerType, data.gitRef, data.gitSha, data.durationMs, data.completedAt, data.syncedToClickhouse];

    if (data.id !== undefined) {
      columns.unshift('id');
      values.unshift(data.id);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, since?: Date): Promise<EfficiencyPipelineRecordEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    if (since) {
      query += ` AND completed_at >= $2`;
      params.push(since);
    }
    query += ` ORDER BY completed_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findUnsynced(limit: number = 100): Promise<EfficiencyPipelineRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE synced_to_clickhouse = false ORDER BY completed_at ASC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async markSynced(id: string): Promise<void> {
    await this.db.query(
      `UPDATE ${this.tableName} SET synced_to_clickhouse = true, synced_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  protected mapRowToEntity(row: any): EfficiencyPipelineRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      runId: row.run_id,
      pipelineId: row.pipeline_id,
      status: row.status,
      triggerType: row.trigger_type,
      gitRef: row.git_ref,
      gitSha: row.git_sha,
      durationMs: row.duration_ms,
      completedAt: row.completed_at,
      syncedToClickhouse: row.synced_to_clickhouse,
      syncedAt: row.synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
