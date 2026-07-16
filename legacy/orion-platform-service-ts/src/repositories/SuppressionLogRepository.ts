import { BaseRepository } from '../db/base-repository';

export interface SuppressionLogEntity {
  id: string;
  tenantId: string;
  alertId: string;
  ruleType: string;
  reason: string;
  loggedAt: Date;
}

export class SuppressionLogRepository extends BaseRepository<SuppressionLogEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_suppression_log');
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<SuppressionLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_suppression_log WHERE tenant_id = $1 ORDER BY logged_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByAlertId(alertId: string): Promise<SuppressionLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_suppression_log WHERE alert_id = $1 ORDER BY logged_at DESC`,
      [alertId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByRuleType(ruleType: string, tenantId?: string, limit: number = 100): Promise<SuppressionLogEntity[]> {
    let query = `SELECT * FROM alert_suppression_log WHERE rule_type = $1`;
    const params: any[] = [ruleType];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    query += ` ORDER BY logged_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findInRange(startTime: Date, endTime: Date, tenantId?: string): Promise<SuppressionLogEntity[]> {
    let query = `SELECT * FROM alert_suppression_log WHERE logged_at >= $1 AND logged_at <= $2`;
    const params: any[] = [startTime, endTime];
    if (tenantId) {
      query += ` AND tenant_id = $3`;
      params.push(tenantId);
    }
    query += ` ORDER BY logged_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteOlderThan(before: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM alert_suppression_log WHERE logged_at < $1`,
      [before],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): SuppressionLogEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      alertId: row.alert_id,
      ruleType: row.rule_type,
      reason: row.reason,
      loggedAt: row.logged_at,
    };
  }
}
