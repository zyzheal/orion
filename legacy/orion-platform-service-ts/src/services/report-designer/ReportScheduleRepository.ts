/**
 * ReportScheduleRepository
 *
 * Repository for report_schedule table.
 * Uses migration 318 as authoritative schema.
 */

import { BaseRepository } from '../../db/base-repository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { ValidationError, NotFoundError } from '../../errors';

export interface ReportScheduleEntity {
  id: string;
  tenantId: string;
  reportId: string;
  cronExpression: string;
  exportFormat: string;
  recipients: Record<string, any>[];
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
}

export class ReportScheduleRepository extends BaseRepository<ReportScheduleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'report_schedule');
  }

  async listByReport(reportId: string): Promise<ReportScheduleEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM report_schedule WHERE tenant_id = $1 AND report_id = $2 ORDER BY created_at DESC`,
      [tenantId, reportId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getById(id: string): Promise<ReportScheduleEntity | undefined> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM report_schedule WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async create(data: Omit<ReportScheduleEntity, 'id' | 'tenantId' | 'createdAt' | 'lastRunAt' | 'nextRunAt'>): Promise<ReportScheduleEntity> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO report_schedule (id, tenant_id, report_id, cron_expression, export_format, recipients, enabled)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tenantId,
        data.reportId,
        data.cronExpression,
        data.exportFormat,
        JSON.stringify(data.recipients ?? []),
        data.enabled ?? true,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateById(id: string, data: Partial<Omit<ReportScheduleEntity, 'id' | 'tenantId' | 'createdAt'>>): Promise<ReportScheduleEntity> {
    const tenantId = getCurrentTenantId();
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.cronExpression !== undefined) {
      setClauses.push(`cron_expression = $${paramIndex}`);
      params.push(data.cronExpression);
      paramIndex++;
    }
    if (data.exportFormat !== undefined) {
      setClauses.push(`export_format = $${paramIndex}`);
      params.push(data.exportFormat);
      paramIndex++;
    }
    if (data.recipients !== undefined) {
      setClauses.push(`recipients = $${paramIndex}`);
      params.push(JSON.stringify(data.recipients));
      paramIndex++;
    }
    if (data.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex}`);
      params.push(data.enabled);
      paramIndex++;
    }
    if (data.lastRunAt !== undefined) {
      setClauses.push(`last_run_at = $${paramIndex}`);
      params.push(data.lastRunAt);
      paramIndex++;
    }
    if (data.nextRunAt !== undefined) {
      setClauses.push(`next_run_at = $${paramIndex}`);
      params.push(data.nextRunAt);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      throw new ValidationError('No fields to update');
    }

    params.push(id, tenantId);

    const query = `
      UPDATE report_schedule
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `;
    const result = await this.db.query(query, params);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Report schedule not found: ${id}`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteById(id: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `DELETE FROM report_schedule WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getActiveSchedules(): Promise<ReportScheduleEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM report_schedule WHERE tenant_id = $1 AND enabled = true ORDER BY next_run_at ASC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ReportScheduleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      reportId: row.report_id,
      cronExpression: row.cron_expression,
      exportFormat: row.export_format,
      recipients: row.recipients ?? [],
      enabled: row.enabled,
      lastRunAt: row.last_run_at,
      nextRunAt: row.next_run_at,
      createdAt: row.created_at,
    };
  }
}
