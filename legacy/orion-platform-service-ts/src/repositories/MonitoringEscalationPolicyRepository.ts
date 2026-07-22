import { BaseRepository } from '../db/base-repository';

export interface MonitoringEscalationPolicyEntity {
  id: string;
  tenant_id: string;
  name: string;
  steps: any[];
  repeat_count: number;
  enabled: boolean;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export class MonitoringEscalationPolicyRepository extends BaseRepository<MonitoringEscalationPolicyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'monitoring_escalation_policies');
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<MonitoringEscalationPolicyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_escalation_policies WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabled(): Promise<MonitoringEscalationPolicyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_escalation_policies WHERE enabled = true ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db.query(
      `UPDATE monitoring_escalation_policies SET enabled = $1, updated_at = NOW() WHERE id = $2`,
      [enabled, id],
    );
  }

  protected mapRowToEntity(row: any): MonitoringEscalationPolicyEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      steps: row.steps || [],
      repeat_count: row.repeat_count ?? 0,
      enabled: row.enabled,
      description: row.description,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
