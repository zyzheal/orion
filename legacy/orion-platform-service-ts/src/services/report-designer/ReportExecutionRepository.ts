/**
 * ReportExecutionRepository
 *
 * Repository for report_execution_history table.
 * Uses migration 318 as authoritative schema.
 */

import { BaseRepository } from '../../db/base-repository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface ReportExecutionEntity {
  id: string;
  tenantId: string;
  reportId: string;
  scheduleId: string | null;
  exportFormat: string;
  status: string;
  fileUrl: string | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  triggeredBy: string | null;
  createdAt: Date;
}

export class ReportExecutionRepository extends BaseRepository<ReportExecutionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'report_execution_history');
  }

  async listByReport(reportId: string, limit = 20): Promise<ReportExecutionEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM report_execution_history
       WHERE tenant_id = $1 AND report_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [tenantId, reportId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getById(id: string): Promise<ReportExecutionEntity | undefined> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM report_execution_history WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async create(data: Omit<ReportExecutionEntity, 'id' | 'tenantId' | 'createdAt' | 'completedAt' | 'durationMs'>): Promise<ReportExecutionEntity> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO report_execution_history (id, tenant_id, report_id, schedule_id, export_format, status, file_url, error, started_at, triggered_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        data.reportId,
        data.scheduleId ?? null,
        data.exportFormat,
        data.status ?? 'pending',
        data.fileUrl ?? null,
        data.error ?? null,
        data.startedAt ?? null,
        data.triggeredBy ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ReportExecutionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      reportId: row.report_id,
      scheduleId: row.schedule_id,
      exportFormat: row.export_format,
      status: row.status,
      fileUrl: row.file_url,
      error: row.error,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationMs: row.duration_ms,
      triggeredBy: row.triggered_by,
      createdAt: row.created_at,
    };
  }
}
