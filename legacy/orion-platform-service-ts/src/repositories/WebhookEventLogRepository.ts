import { BaseRepository } from '../db/base-repository';

export interface WebhookEventLogEntity {
  id: string;
  event_type: string;
  repo_type: string;
  repo_name: string;
  event_id: string;
  success: boolean;
  error: string;
  tenant_id: string;
  created_at: Date;
}

export class WebhookEventLogRepository extends BaseRepository<WebhookEventLogEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'webhook_event_log');
  }

  async findByEventType(eventType: string, limit: number = 50): Promise<WebhookEventLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM webhook_event_log WHERE event_type = $1 ORDER BY created_at DESC LIMIT $2`,
      [eventType, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByRepoType(repoType: string, limit: number = 50): Promise<WebhookEventLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM webhook_event_log WHERE repo_type = $1 ORDER BY created_at DESC LIMIT $2`,
      [repoType, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<WebhookEventLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM webhook_event_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findRecent(limit: number = 50): Promise<WebhookEventLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM webhook_event_log ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async cleanup(retentionDays: number = 30): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM webhook_event_log WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`,
    );
    return result.rowCount || 0;
  }

  protected mapRowToEntity(row: any): WebhookEventLogEntity {
    return {
      id: row.id,
      event_type: row.event_type,
      repo_type: row.repo_type,
      repo_name: row.repo_name,
      event_id: row.event_id,
      success: row.success,
      error: row.error,
      tenant_id: row.tenant_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
