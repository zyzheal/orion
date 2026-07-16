/**
 * ConfigWebhookDeliveryLogRepository — Data access layer for
 * config_webhook_deliveries table (delivery history for config webhooks).
 */

export interface ConfigWebhookDeliveryLogEntity {
  id: string;
  webhookId: string;
  eventType: string;
  payload: Record<string, any>;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempt: number;
  maxAttempts: number;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

export class ConfigWebhookDeliveryLogRepository {
  private tableName = 'config_webhook_deliveries';

  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  async create(entry: {
    webhookId: string;
    eventType: string;
    payload: Record<string, any>;
    status: ConfigWebhookDeliveryLogEntity['status'];
    attempt: number;
    maxAttempts: number;
    responseStatus?: number;
    responseBody?: string;
    errorMessage?: string;
    nextRetryAt?: Date;
    deliveredAt?: Date;
  }): Promise<ConfigWebhookDeliveryLogEntity> {
    const id = `cfg-delivery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO ${this.tableName}
       (id, webhook_id, event_type, payload, status, attempt, max_attempts,
        response_status, response_body, error_message, next_retry_at, delivered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id,
        entry.webhookId,
        entry.eventType,
        JSON.stringify(entry.payload),
        entry.status,
        entry.attempt,
        entry.maxAttempts,
        entry.responseStatus ?? null,
        entry.responseBody ?? null,
        entry.errorMessage ?? null,
        entry.nextRetryAt ?? null,
        entry.deliveredAt ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByWebhookId(webhookId: string, limit: number = 50): Promise<ConfigWebhookDeliveryLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName}
       WHERE webhook_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [webhookId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<ConfigWebhookDeliveryLogEntity[]> {
    const result = await this.db.query(
      `SELECT d.* FROM ${this.tableName} d
       JOIN config_webhooks w ON w.id = d.webhook_id
       WHERE w.tenant_id = $1
       ORDER BY d.created_at DESC
       LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findRecent(limit: number = 50): Promise<ConfigWebhookDeliveryLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async cleanup(retentionDays: number = 30): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName}
       WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`,
    );
    return result.rowCount ?? 0;
  }

  private mapRowToEntity(row: any): ConfigWebhookDeliveryLogEntity {
    return {
      id: row.id,
      webhookId: row.webhook_id,
      eventType: row.event_type,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload ?? {}),
      status: row.status,
      attempt: row.attempt,
      maxAttempts: row.max_attempts,
      responseStatus: row.response_status ?? undefined,
      responseBody: row.response_body ?? undefined,
      errorMessage: row.error_message ?? undefined,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : undefined,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
