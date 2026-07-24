import type { Alert, AlertSubscription } from '../types/monitor.js';
import type { IDbAdapter } from '../db/database.js';

export class AlertRepository {
  constructor(private pool: IDbAdapter) {}

  async create(
    tenantId: string,
    projectId: string,
    createdBy: string,
    alert: Omit<Alert, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'projectId' | 'createdBy' | 'status'>,
  ): Promise<Alert> {
    const result = await this.pool.query(
      `INSERT INTO alerts
       (tenant_id, project_id, rule_id, rule_name, severity, status, triggered_at,
        current_value, threshold, message, ticket_id, assignee_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [tenantId, projectId, alert.ruleId, alert.ruleName, alert.severity, 'active',
       new Date(alert.triggeredAt), alert.currentValue, alert.threshold, alert.message,
       alert.ticketId || null, alert.assigneeId || null, createdBy],
    );
    return this.entityToDto(result.rows[0]);
  }

  async findByTenant(
    tenantId: string,
    filters?: { projectId?: string; severity?: string; status?: string },
  ): Promise<Alert[]> {
    let sql = 'SELECT * FROM alerts WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (filters?.projectId) { params.push(filters.projectId); sql += ` AND project_id = $${params.length}`; }
    if (filters?.severity) { params.push(filters.severity); sql += ` AND severity = $${params.length}`; }
    if (filters?.status) { params.push(filters.status); sql += ` AND status = $${params.length}`; }
    sql += ' ORDER BY triggered_at DESC';
    const result = await this.pool.query(sql, params);
    return result.rows.map(r => this.entityToDto(r));
  }

  async findById(id: string): Promise<Alert | null> {
    const result = await this.pool.query('SELECT * FROM alerts WHERE id = $1', [id]);
    return result.rows[0] ? this.entityToDto(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: string): Promise<Alert | null> {
    const result = await this.pool.query(
      `UPDATE alerts SET status = $1, resolved_at = CASE WHEN $1 = 'resolved' THEN now() ELSE resolved_at END,
       updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    return result.rows[0] ? this.entityToDto(result.rows[0]) : null;
  }

  // Subscriptions
  async createSubscription(
    tenantId: string,
    userId: string,
    channels: string[],
    filters?: Record<string, unknown>,
  ): Promise<AlertSubscription> {
    const result = await this.pool.query(
      `INSERT INTO alert_subscriptions (tenant_id, user_id, channels, filters)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tenantId, userId, JSON.stringify(channels), filters ? JSON.stringify(filters) : null],
    );
    return this.subToDto(result.rows[0]);
  }

  async findSubscriptions(tenantId: string): Promise<AlertSubscription[]> {
    const result = await this.pool.query(
      'SELECT * FROM alert_subscriptions WHERE tenant_id = $1 AND enabled = true',
      [tenantId],
    );
    return result.rows.map(r => this.subToDto(r));
  }

  private entityToDto(row: any): Alert {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      severity: row.severity,
      status: row.status,
      triggeredAt: row.triggered_at.toISOString(),
      resolvedAt: row.resolved_at?.toISOString(),
      currentValue: Number(row.current_value),
      threshold: Number(row.threshold),
      message: row.message ?? '',
      ticketId: row.ticket_id,
      assigneeId: row.assignee_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      createdBy: row.created_by,
    };
  }

  private subToDto(row: any): AlertSubscription {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      channels: typeof row.channels === 'string' ? JSON.parse(row.channels) : row.channels,
      filters: row.filters ? (typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters) : undefined,
      enabled: row.enabled,
    };
  }
}
