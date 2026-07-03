/**
 * MonitoringAlertEscalationRepository - 告警升级记录持久化
 *
 * 将告警升级状态持久化到 PostgreSQL，支持升级历史查询和审计。
 */

import { DatabasePool } from '../../database';

export interface MonitoringAlertEscalationEntity {
  id: string;
  tenant_id: string;
  alert_id: string;
  rule_id: string;
  policy_id: string | null;
  from_status: string;
  to_status: string;
  escalation_step: number | null;
  channel_ids: string[] | null;
  recipients: string[] | null;
  triggered_at: Date;
  completed_at: Date | null;
  error_message: string | null;
  created_at: Date;
}

export interface CreateAlertEscalationInput {
  tenant_id: string;
  alert_id: string;
  rule_id: string;
  policy_id?: string | null;
  from_status: string;
  to_status: string;
  escalation_step?: number | null;
  channel_ids?: string[] | null;
  recipients?: string[] | null;
  triggered_at?: Date;
  completed_at?: Date | null;
  error_message?: string | null;
}

export class MonitoringAlertEscalationRepository {
  constructor(private db: DatabasePool) {}

  async create(input: CreateAlertEscalationInput): Promise<MonitoringAlertEscalationEntity> {
    const {
      tenant_id,
      alert_id,
      rule_id,
      policy_id = null,
      from_status,
      to_status,
      escalation_step = null,
      channel_ids = null,
      recipients = null,
      triggered_at = new Date(),
      completed_at = null,
      error_message = null,
    } = input;

    const result = await this.db.query(
      `INSERT INTO monitoring_alert_escalations
        (tenant_id, alert_id, rule_id, policy_id, from_status, to_status, escalation_step, channel_ids, recipients, triggered_at, completed_at, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        tenant_id,
        alert_id,
        rule_id,
        policy_id,
        from_status,
        to_status,
        escalation_step,
        channel_ids,
        recipients,
        triggered_at,
        completed_at,
        error_message,
      ]
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  async findById(id: string, tenantId?: string): Promise<MonitoringAlertEscalationEntity | null> {
    if (tenantId) {
      const result = await this.db.query(
        'SELECT * FROM monitoring_alert_escalations WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    }
    const result = await this.db.query('SELECT * FROM monitoring_alert_escalations WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByAlertId(alertId: string, tenantId?: string): Promise<MonitoringAlertEscalationEntity[]> {
    if (tenantId) {
      const result = await this.db.query(
        'SELECT * FROM monitoring_alert_escalations WHERE alert_id = $1 AND tenant_id = $2 ORDER BY triggered_at DESC',
        [alertId, tenantId]
      );
      return result.rows.map(row => this.mapRowToEntity(row));
    }
    const result = await this.db.query(
      'SELECT * FROM monitoring_alert_escalations WHERE alert_id = $1 ORDER BY triggered_at DESC',
      [alertId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByRuleId(ruleId: string, tenantId?: string): Promise<MonitoringAlertEscalationEntity[]> {
    if (tenantId) {
      const result = await this.db.query(
        'SELECT * FROM monitoring_alert_escalations WHERE rule_id = $1 AND tenant_id = $2 ORDER BY triggered_at DESC',
        [ruleId, tenantId]
      );
      return result.rows.map(row => this.mapRowToEntity(row));
    }
    const result = await this.db.query(
      'SELECT * FROM monitoring_alert_escalations WHERE rule_id = $1 ORDER BY triggered_at DESC',
      [ruleId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findAll(tenantId?: string, limit = 100): Promise<MonitoringAlertEscalationEntity[]> {
    if (tenantId) {
      const result = await this.db.query(
        'SELECT * FROM monitoring_alert_escalations WHERE tenant_id = $1 ORDER BY triggered_at DESC LIMIT $2',
        [tenantId, limit]
      );
      return result.rows.map(row => this.mapRowToEntity(row));
    }
    const result = await this.db.query(
      'SELECT * FROM monitoring_alert_escalations ORDER BY triggered_at DESC LIMIT $1',
      [limit]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateCompletedAt(id: string, completedAt: Date, errorMessage?: string | null, tenantId?: string): Promise<MonitoringAlertEscalationEntity | null> {
    const updates: string[] = ['completed_at = $1'];
    const params: any[] = [completedAt];
    let paramIndex = 2;

    if (errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      params.push(errorMessage);
    }

    if (tenantId) {
      const whereClause = `WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}`;
      params.push(id, tenantId);
      const result = await this.db.query(
        `UPDATE monitoring_alert_escalations SET ${updates.join(', ')} ${whereClause} RETURNING *`,
        params
      );
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    }

    const result = await this.db.query(
      `UPDATE monitoring_alert_escalations SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      [...params, id]
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async countByAlertId(alertId: string, tenantId?: string): Promise<number> {
    if (tenantId) {
      const result = await this.db.query(
        'SELECT COUNT(*) as count FROM monitoring_alert_escalations WHERE alert_id = $1 AND tenant_id = $2',
        [alertId, tenantId]
      );
      return parseInt(result.rows[0].count, 10);
    }
    const result = await this.db.query(
      'SELECT COUNT(*) as count FROM monitoring_alert_escalations WHERE alert_id = $1',
      [alertId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  private mapRowToEntity(row: any): MonitoringAlertEscalationEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      alert_id: row.alert_id,
      rule_id: row.rule_id,
      policy_id: row.policy_id,
      from_status: row.from_status,
      to_status: row.to_status,
      escalation_step: row.escalation_step,
      channel_ids: row.channel_ids || [],
      recipients: row.recipients || [],
      triggered_at: row.triggered_at ? new Date(row.triggered_at) : new Date(),
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      error_message: row.error_message,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
