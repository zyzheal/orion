import { BaseRepository } from '../db/base-repository';

export interface AlertSuppressionRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  condition: Record<string, any>;
  schedule: Record<string, any> | null;
  reason: string | null;
  enabled: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

export class AlertSuppressionRepository extends BaseRepository<AlertSuppressionRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_suppression_rules');
  }

  async findByTenantId(tenantId: string): Promise<AlertSuppressionRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_suppression_rules WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findEnabled(): Promise<AlertSuppressionRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_suppression_rules WHERE enabled = true ORDER BY created_at DESC`,
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findActiveByTenant(tenantId: string): Promise<AlertSuppressionRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_suppression_rules
       WHERE tenant_id = $1 AND enabled = true
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db.query(
      `UPDATE alert_suppression_rules SET enabled = $1, updated_at = NOW() WHERE id = $2`,
      [enabled, id],
    );
  }

  protected mapRowToEntity(row: any): AlertSuppressionRuleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      condition: row.condition,
      schedule: row.schedule,
      reason: row.reason,
      enabled: row.enabled,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}