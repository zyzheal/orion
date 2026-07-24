import { BaseRepository } from '../db/base-repository';

export interface MonitoringNotificationHistoryEntity {
  id: string;
  tenant_id: string;
  alert_id: string;
  channel_id: string;
  channel_type: string;
  status: string;
  sent_at: Date;
  error_message: string | null;
  response_payload: string | null;
  escalation_step: number | null;
  created_at: Date;
  updated_at: Date;
}

export class MonitoringNotificationHistoryRepository extends BaseRepository<MonitoringNotificationHistoryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'monitoring_notification_history');
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<MonitoringNotificationHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_notification_history WHERE tenant_id = $1 ORDER BY sent_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByAlertId(alertId: string): Promise<MonitoringNotificationHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_notification_history WHERE alert_id = $1 ORDER BY sent_at DESC`,
      [alertId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByChannelId(channelId: string): Promise<MonitoringNotificationHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_notification_history WHERE channel_id = $1 ORDER BY sent_at DESC`,
      [channelId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<MonitoringNotificationHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_notification_history WHERE status = $1 ORDER BY sent_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findWithFilters(filter: {
    alertId?: string;
    channelId?: string;
    status?: string;
    limit?: number;
  }): Promise<MonitoringNotificationHistoryEntity[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.alertId) {
      conditions.push(`alert_id = $${paramIndex}`);
      params.push(filter.alertId);
      paramIndex++;
    }
    if (filter.channelId) {
      conditions.push(`channel_id = $${paramIndex}`);
      params.push(filter.channelId);
      paramIndex++;
    }
    if (filter.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filter.status);
      paramIndex++;
    }

    let query = `SELECT * FROM monitoring_notification_history`;
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ` ORDER BY sent_at DESC`;

    if (filter.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filter.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): MonitoringNotificationHistoryEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      alert_id: row.alert_id,
      channel_id: row.channel_id,
      channel_type: row.channel_type,
      status: row.status,
      sent_at: row.sent_at ? new Date(row.sent_at) : new Date(),
      error_message: row.error_message,
      response_payload: row.response_payload,
      escalation_step: row.escalation_step,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
