import { BaseRepository } from '../db/base-repository';

export interface MonitoringAlertRuleEntity {
  id: string;
  tenant_id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  severity: string;
  enabled: boolean;
  suppressed: boolean;
  cooldown_ms: number;
  tags: Record<string, string>;
  rate_of_change_percent: number | null;
  description: string | null;
  evaluation_window_ms: number | null;
  created_at: Date;
  updated_at: Date;
}

export class MonitoringAlertRuleRepository extends BaseRepository<MonitoringAlertRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'monitoring_alert_rules');
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<MonitoringAlertRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_alert_rules WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabled(): Promise<MonitoringAlertRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_alert_rules WHERE enabled = true ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByMetric(metric: string): Promise<MonitoringAlertRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_alert_rules WHERE metric = $1 ORDER BY created_at DESC`,
      [metric],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db.query(
      `UPDATE monitoring_alert_rules SET enabled = $1, updated_at = NOW() WHERE id = $2`,
      [enabled, id],
    );
  }

  protected mapRowToEntity(row: any): MonitoringAlertRuleEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      metric: row.metric,
      condition: row.condition,
      threshold: parseFloat(row.threshold),
      severity: row.severity,
      enabled: row.enabled,
      suppressed: row.suppressed ?? false,
      cooldown_ms: row.cooldown_ms ?? 300000,
      tags: row.tags || {},
      rate_of_change_percent: row.rate_of_change_percent != null ? parseFloat(row.rate_of_change_percent) : null,
      description: row.description,
      evaluation_window_ms: row.evaluation_window_ms,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
