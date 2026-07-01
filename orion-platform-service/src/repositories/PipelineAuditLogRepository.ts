/**
 * PipelineAuditLogRepository
 *
 * Data access layer for pipeline_audit_logs table.
 * Follows the BaseRepository pattern (same as TriggerRepository).
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError } from '../errors';
import type { PipelineAuditLog } from '../models/PipelineAuditLog';

export interface PipelineAuditLogEntity {
  id: string;
  tenant_id: string;
  run_id: string;
  stage_id?: string;
  task_id?: string;
  action: string;
  actor: string;
  outcome: string;
  duration_ms?: number;
  input_summary?: Record<string, unknown>;
  output_summary?: Record<string, unknown>;
  error_message?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
}

export class PipelineAuditLogRepository extends BaseRepository<PipelineAuditLogEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'pipeline_audit_logs');
  }

  /**
   * Create an audit log entry.
   */
  async create(data: Omit<PipelineAuditLogEntity, 'id' | 'created_at'> & Partial<Pick<PipelineAuditLogEntity, 'id'>>): Promise<PipelineAuditLogEntity> {
    const columns = [
      'tenant_id', 'run_id', 'stage_id', 'task_id', 'action', 'actor', 'outcome',
      'duration_ms', 'input_summary', 'output_summary', 'error_message', 'metadata',
    ];
    const values = [
      data.tenant_id, data.run_id, data.stage_id ?? null, data.task_id ?? null,
      data.action, data.actor, data.outcome,
      data.duration_ms ?? null,
      data.input_summary ?? {},
      data.output_summary ?? {},
      data.error_message ?? null,
      data.metadata ?? {},
    ];

    if (data.id !== undefined) {
      columns.unshift('id');
      values.unshift(data.id);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO pipeline_audit_logs (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError(`INSERT into pipeline_audit_logs returned no rows`, 'OPERATION_FAILED');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Batch create audit log entries for performance.
   */
  async createBatch(data: Omit<PipelineAuditLogEntity, 'id' | 'created_at'>[]): Promise<PipelineAuditLogEntity[]> {
    if (data.length === 0) return [];

    const allColumns = [
      'tenant_id', 'run_id', 'stage_id', 'task_id', 'action', 'actor', 'outcome',
      'duration_ms', 'input_summary', 'output_summary', 'error_message', 'metadata',
    ];

    const valuesClauses: string[] = [];
    const allParams: unknown[] = [];
    let paramIdx = 1;

    for (const entry of data) {
      const rowParams = [
        entry.tenant_id, entry.run_id, entry.stage_id ?? null, entry.task_id ?? null,
        entry.action, entry.actor, entry.outcome,
        entry.duration_ms ?? null,
        entry.input_summary ?? {},
        entry.output_summary ?? {},
        entry.error_message ?? null,
        entry.metadata ?? {},
      ];
      const placeholders = rowParams.map(() => `$${paramIdx++}`).join(', ');
      valuesClauses.push(`(${placeholders})`);
      allParams.push(...rowParams);
    }

    const query = `INSERT INTO pipeline_audit_logs (${allColumns.join(', ')}) VALUES ${valuesClauses.join(', ')} RETURNING *`;
    const result = await this.db.query(query, allParams);

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find audit logs by filter criteria.
   */
  async findByFilter(filter: {
    tenantId?: string;
    runId?: string;
    stageId?: string;
    taskId?: string;
    action?: string;
    actor?: string;
    outcome?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
  }): Promise<PipelineAuditLogEntity[]> {
    let query = 'SELECT * FROM pipeline_audit_logs WHERE 1=1';
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter.tenantId) {
      query += ` AND tenant_id = $${paramIdx++}`;
      params.push(filter.tenantId);
    }
    if (filter.runId) {
      query += ` AND run_id = $${paramIdx++}`;
      params.push(filter.runId);
    }
    if (filter.stageId) {
      query += ` AND stage_id = $${paramIdx++}`;
      params.push(filter.stageId);
    }
    if (filter.taskId) {
      query += ` AND task_id = $${paramIdx++}`;
      params.push(filter.taskId);
    }
    if (filter.action) {
      query += ` AND action = $${paramIdx++}`;
      params.push(filter.action);
    }
    if (filter.actor) {
      query += ` AND actor = $${paramIdx++}`;
      params.push(filter.actor);
    }
    if (filter.outcome) {
      query += ` AND outcome = $${paramIdx++}`;
      params.push(filter.outcome);
    }
    if (filter.startTime) {
      query += ` AND created_at >= $${paramIdx++}`;
      params.push(filter.startTime);
    }
    if (filter.endTime) {
      query += ` AND created_at <= $${paramIdx++}`;
      params.push(filter.endTime);
    }

    query += ' ORDER BY created_at DESC';

    if (filter.limit) {
      query += ` LIMIT $${paramIdx++}`;
      params.push(filter.limit);
    }
    if (filter.offset) {
      query += ` OFFSET $${paramIdx++}`;
      params.push(filter.offset);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Count audit logs by filter.
   */
  async countByFilter(filter: {
    tenantId?: string;
    runId?: string;
    stageId?: string;
    action?: string;
    outcome?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM pipeline_audit_logs WHERE 1=1';
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter.tenantId) {
      query += ` AND tenant_id = $${paramIdx++}`;
      params.push(filter.tenantId);
    }
    if (filter.runId) {
      query += ` AND run_id = $${paramIdx++}`;
      params.push(filter.runId);
    }
    if (filter.stageId) {
      query += ` AND stage_id = $${paramIdx++}`;
      params.push(filter.stageId);
    }
    if (filter.action) {
      query += ` AND action = $${paramIdx++}`;
      params.push(filter.action);
    }
    if (filter.outcome) {
      query += ` AND outcome = $${paramIdx++}`;
      params.push(filter.outcome);
    }
    if (filter.startTime) {
      query += ` AND created_at >= $${paramIdx++}`;
      params.push(filter.startTime);
    }
    if (filter.endTime) {
      query += ` AND created_at <= $${paramIdx++}`;
      params.push(filter.endTime);
    }

    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Delete audit logs older than the given date (for retention policy).
   */
  async deleteOlderThan(before: Date): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM pipeline_audit_logs WHERE created_at < $1',
      [before],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): PipelineAuditLogEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      run_id: row.run_id,
      stage_id: row.stage_id ?? null,
      task_id: row.task_id ?? null,
      action: row.action,
      actor: row.actor,
      outcome: row.outcome,
      duration_ms: row.duration_ms ?? null,
      input_summary: row.input_summary ?? {},
      output_summary: row.output_summary ?? {},
      error_message: row.error_message ?? null,
      metadata: row.metadata ?? {},
      created_at: row.created_at,
    };
  }

  // Public mappers for testing
  mapRowToEntityPublic(row: any): PipelineAuditLogEntity {
    return this.mapRowToEntity(row);
  }
}
