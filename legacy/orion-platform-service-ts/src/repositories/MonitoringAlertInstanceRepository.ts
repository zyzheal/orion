import { BaseRepository } from '../db/base-repository';

export interface MonitoringAlertInstanceEntity {
  id: string;
  tenant_id: string;
  rule_id: string;
  rule_name: string | null;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
  status: string;
  triggered_at: Date;
  acknowledged_at: Date | null;
  acknowledged_by: string | null;
  resolved_at: Date | null;
  tags: Record<string, string>;
  message: string | null;
  created_at: Date;
  updated_at: Date;
}

export class MonitoringAlertInstanceRepository extends BaseRepository<MonitoringAlertInstanceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'monitoring_alert_instances');
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<MonitoringAlertInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_alert_instances WHERE tenant_id = $1 ORDER BY triggered_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByRuleId(ruleId: string): Promise<MonitoringAlertInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_alert_instances WHERE rule_id = $1 ORDER BY triggered_at DESC`,
      [ruleId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findActive(): Promise<MonitoringAlertInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_alert_instances WHERE status IN ('triggered', 'acknowledged') ORDER BY triggered_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<MonitoringAlertInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_alert_instances WHERE status = $1 ORDER BY triggered_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findBySeverity(severity: string): Promise<MonitoringAlertInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_alert_instances WHERE severity = $1 ORDER BY triggered_at DESC`,
      [severity],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, extra?: { acknowledged_by?: string }): Promise<void> {
    if (status === 'acknowledged' && extra?.acknowledged_by) {
      await this.db.query(
        `UPDATE monitoring_alert_instances SET status = $1, acknowledged_at = NOW(), acknowledged_by = $2, updated_at = NOW() WHERE id = $3`,
        [status, extra.acknowledged_by, id],
      );
    } else if (status === 'resolved') {
      await this.db.query(
        `UPDATE monitoring_alert_instances SET status = $1, resolved_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [status, id],
      );
    } else {
      await this.db.query(
        `UPDATE monitoring_alert_instances SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, id],
      );
    }
  }

  async countBySeverity(tenantId?: string): Promise<Record<string, number>> {
    let query = `SELECT severity, COUNT(*) as count FROM monitoring_alert_instances WHERE status IN ('triggered', 'acknowledged')`;
    const params: any[] = [];
    if (tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(tenantId);
    }
    query += ` GROUP BY severity`;
    const result = await this.db.query(query, params);
    const counts: Record<string, number> = { critical: 0, warning: 0, info: 0 };
    for (const row of result.rows) {
      counts[row.severity] = parseInt(row.count, 10);
    }
    return counts;
  }

  protected mapRowToEntity(row: any): MonitoringAlertInstanceEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      rule_id: row.rule_id,
      rule_name: row.rule_name,
      metric: row.metric,
      value: parseFloat(row.value),
      threshold: parseFloat(row.threshold),
      severity: row.severity,
      status: row.status,
      triggered_at: row.triggered_at ? new Date(row.triggered_at) : new Date(),
      acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at) : null,
      acknowledged_by: row.acknowledged_by,
      resolved_at: row.resolved_at ? new Date(row.resolved_at) : null,
      tags: row.tags || {},
      message: row.message,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
