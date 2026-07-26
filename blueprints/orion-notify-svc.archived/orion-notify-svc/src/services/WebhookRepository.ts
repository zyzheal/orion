import type { DatabasePool } from '../utils/database';
import type { Webhook, WebhookDelivery } from '../types/webhook';

function mapWebhookRow(row: any): Webhook {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    url: row.url,
    events: Array.isArray(row.events) ? row.events : JSON.parse(row.events || '[]'),
    secret: row.secret,
    enabled: row.active,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function mapDeliveryRow(row: any): WebhookDelivery {
  return {
    id: row.id,
    webhook_id: row.webhook_id,
    event: row.event_type,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {}),
    status: row.status,
    response_code: row.response_code,
    response_body: row.response_body,
    attempt: row.attempt,
    next_retry_at: row.next_retry_at ? new Date(row.next_retry_at) : null,
    attempted_at: new Date(row.created_at),
  };
}

export class WebhookRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<Webhook | null> {
    const result = await this.pool.query('SELECT * FROM webhooks WHERE id = $1', [id]);
    return result.rows[0] ? mapWebhookRow(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<Webhook[]> {
    const result = await this.pool.query(
      'SELECT * FROM webhooks WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows.map(mapWebhookRow);
  }

  async create(tenantId: string, name: string, url: string, events: string[], secret?: string): Promise<Webhook> {
    const result = await this.pool.query(
      `INSERT INTO webhooks (tenant_id, name, url, events, secret, active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [tenantId, name, url, JSON.stringify(events), secret || null]
    );
    return mapWebhookRow(result.rows[0]);
  }

  async update(id: string, input: { name?: string; url?: string; events?: string[]; enabled?: boolean }): Promise<Webhook | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (input.name !== undefined) { params.push(input.name); sets.push(`name = $${idx++}`); }
    if (input.url !== undefined) { params.push(input.url); sets.push(`url = $${idx++}`); }
    if (input.events !== undefined) { params.push(JSON.stringify(input.events)); sets.push(`events = $${idx++}`); }
    if (input.enabled !== undefined) { params.push(input.enabled); sets.push(`active = $${idx++}`); }

    if (sets.length === 0) return this.findById(id);

    params.push(id);
    sets.push(`updated_at = NOW()`);

    const result = await this.pool.query(
      `UPDATE webhooks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] ? mapWebhookRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM webhooks WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async recordDelivery(webhookId: string, event: string, payload: Record<string, any>): Promise<WebhookDelivery> {
    const result = await this.pool.query(
      `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status, attempt, created_at)
       VALUES ($1, $2, $3, 'pending', 1, NOW()) RETURNING *`,
      [webhookId, event, JSON.stringify(payload)]
    );
    return mapDeliveryRow(result.rows[0]);
  }

  async updateDeliveryStatus(id: string, status: string, responseCode: number, responseBody: string, attempt?: number): Promise<void> {
    const sets: string[] = [`status = $1`, `response_code = $2`, `response_body = $3`];
    const params: any[] = [status, responseCode, responseBody];

    if (attempt !== undefined) {
      params.push(attempt);
      sets.push(`attempt = $${params.length}`);
    }

    params.push(id);
    sets.push(`updated_at = $${params.length + 1}`);

    await this.pool.query(
      `UPDATE webhook_deliveries SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    );
  }

  async findDeliveriesByWebhook(webhookId: string, limit: number = 50): Promise<WebhookDelivery[]> {
    const result = await this.pool.query(
      'SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT $2',
      [webhookId, limit]
    );
    return result.rows.map(mapDeliveryRow);
  }

  async findByTenantAndName(tenantId: string, name: string): Promise<Webhook | null> {
    const result = await this.pool.query(
      'SELECT * FROM webhooks WHERE tenant_id = $1 AND name = $2',
      [tenantId, name]
    );
    return result.rows[0] ? mapWebhookRow(result.rows[0]) : null;
  }
}
