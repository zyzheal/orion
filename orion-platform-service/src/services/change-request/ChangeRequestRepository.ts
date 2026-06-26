/**
 * ChangeRequestRepository - RFC (Request for Change) data access layer
 *
 * Manages CRUD and filtered queries for the change_request table.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../../db/base-repository';

export interface ChangeRequestEntity {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  changeType: string; // standard/normal/emergency
  riskLevel: string; // low/medium/high/critical
  impactScope: string | null; // minor/major/significant
  rollbackPlan: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  status: string; // draft/pending_approval/approved/rejected/implementing/completed/cancelled
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChangeRequestFilters {
  status?: string;
  changeType?: string;
  riskLevel?: string;
}

export class ChangeRequestRepository extends BaseRepository<ChangeRequestEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'change_request');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<ChangeRequestEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findByStatus(tenantId: string, status: string): Promise<ChangeRequestEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_request WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC`,
      [tenantId, status],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByType(tenantId: string, changeType: string): Promise<ChangeRequestEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_request WHERE tenant_id = $1 AND change_type = $2 ORDER BY created_at DESC`,
      [tenantId, changeType],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findWithFilters(tenantId: string, filters: ChangeRequestFilters, options: FindAllOptions = {}): Promise<FindAllResult<ChangeRequestEntity>> {
    const where: Record<string, any> = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.changeType) where.changeType = filters.changeType;
    if (filters.riskLevel) where.riskLevel = filters.riskLevel;
    return this.findAll({ ...options, where });
  }

  protected mapRowToEntity(row: any): ChangeRequestEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description ?? null,
      changeType: row.change_type,
      riskLevel: row.risk_level ?? 'low',
      impactScope: row.impact_scope ?? null,
      rollbackPlan: row.rollback_plan ?? null,
      scheduledStart: row.scheduled_start ?? null,
      scheduledEnd: row.scheduled_end ?? null,
      status: row.status ?? 'draft',
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
