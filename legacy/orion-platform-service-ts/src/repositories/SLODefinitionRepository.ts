import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';

export interface SLODefinitionEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  sloType: string;
  targetValue: number;
  targetUnit: string;
  promqlQuery: string;
  windowDays: number;
  alertThreshold: number;
  enabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SLODefinitionRepository extends BaseRepository<SLODefinitionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'slo_definition');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<SLODefinitionEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findByType(tenantId: string, sloType: string): Promise<SLODefinitionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM slo_definition WHERE tenant_id = $1 AND slo_type = $2 ORDER BY created_at DESC`,
      [tenantId, sloType],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findEnabled(tenantId: string): Promise<SLODefinitionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM slo_definition WHERE tenant_id = $1 AND enabled = true ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): SLODefinitionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? null,
      sloType: row.slo_type,
      targetValue: parseFloat(row.target_value),
      targetUnit: row.target_unit,
      promqlQuery: row.promql_query,
      windowDays: row.window_days,
      alertThreshold: parseFloat(row.alert_threshold),
      enabled: row.enabled,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
