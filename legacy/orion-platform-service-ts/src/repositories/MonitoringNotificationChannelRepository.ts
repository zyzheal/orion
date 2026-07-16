import { BaseRepository } from '../db/base-repository';

export interface MonitoringNotificationChannelEntity {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  enabled: boolean;
  severity_filter: string[];
  created_at: Date;
  updated_at: Date;
}

export class MonitoringNotificationChannelRepository extends BaseRepository<MonitoringNotificationChannelEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'monitoring_notification_channels');
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<MonitoringNotificationChannelEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_notification_channels WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabled(): Promise<MonitoringNotificationChannelEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_notification_channels WHERE enabled = true ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByType(type: string): Promise<MonitoringNotificationChannelEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_notification_channels WHERE type = $1 ORDER BY created_at DESC`,
      [type],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db.query(
      `UPDATE monitoring_notification_channels SET enabled = $1, updated_at = NOW() WHERE id = $2`,
      [enabled, id],
    );
  }

  protected mapRowToEntity(row: any): MonitoringNotificationChannelEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      type: row.type,
      config: row.config || {},
      enabled: row.enabled,
      severity_filter: row.severity_filter || [],
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
