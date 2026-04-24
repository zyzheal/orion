import { BaseRepository } from '../db/base-repository';

export interface NotificationChannelEntity {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  config: Record<string, any>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationChannelCreateInput {
  tenantId: string;
  name: string;
  type: string;
  config: Record<string, any>;
  enabled?: boolean;
}

export interface NotificationChannelUpdateInput {
  name?: string;
  type?: string;
  config?: Record<string, any>;
  enabled?: boolean;
}

export class NotificationChannelRepository extends BaseRepository<NotificationChannelEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'notification_channels');
  }

  async findByTenant(tenantId: string, options?: { enabledOnly?: boolean }): Promise<NotificationChannelEntity[]> {
    let query = `SELECT * FROM notification_channels WHERE tenant_id = $1`;
    const params: any[] = [tenantId];

    if (options?.enabledOnly) {
      query += ` AND enabled = true`;
    }

    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByType(tenantId: string, type: string): Promise<NotificationChannelEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM notification_channels WHERE tenant_id = $1 AND type = $2 ORDER BY created_at DESC`,
      [tenantId, type],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): NotificationChannelEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: row.type,
      config: row.config ?? {},
      enabled: row.enabled ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}