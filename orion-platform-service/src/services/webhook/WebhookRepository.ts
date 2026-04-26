/**
 * WebhookRepository - Database layer for Webhook operations
 *
 * Maps to migration 021: webhooks & webhook_deliveries tables.
 * Note: DB column 'active' maps to 'enabled' in the interface for consistency.
 */

import { DatabasePool } from '../database';

export interface Webhook {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  enabled: boolean;  // DB column: 'active'
  created_at: Date;
  updated_at: Date;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;       // DB column: 'event_type'
  payload: Record<string, any>;
  status: string;
  response_code: number | null;
  response_body: string | null;
  attempt: number;
  next_retry_at: Date | null;
  attempted_at: Date;  // DB column: 'created_at'
}

/** Map raw DB row to Webhook interface (active -> enabled) */
function mapWebhook(row: any): Webhook {
  return { ...row, enabled: row.active };
}

/** Map raw DB row to WebhookDelivery interface */
function mapDelivery(row: any): WebhookDelivery {
  return {
    ...row,
    event: row.event_type,
    attempted_at: row.created_at,
  };
}

export class WebhookRepository {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  async findById(id: string): Promise<Webhook | null> {
    const row = (await this.pool.query('SELECT * FROM webhooks WHERE id = $1', [id])).rows[0];
    return row ? mapWebhook(row) : null;
  }

  async findAll(tenantId: string): Promise<Webhook[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM webhooks WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    )).rows;
    return rows.map(mapWebhook);
  }

  async create(tenantId: string, name: string, url: string, events: string[], secret?: string): Promise<Webhook> {
    const result = await this.pool.query(
      `INSERT INTO webhooks (tenant_id, name, url, events, secret, active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [tenantId, name, url, events, secret || null]
    );
    return mapWebhook(result.rows[0]);
  }

  async update(id: string, input: { name?: string; url?: string; events?: string[]; enabled?: boolean }): Promise<Webhook | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (input.name !== undefined) { params.push(input.name); updates.push(`name = $${paramIndex++}`); }
    if (input.url !== undefined) { params.push(input.url); updates.push(`url = $${paramIndex++}`); }
    if (input.events !== undefined) { params.push(input.events); updates.push(`events = $${paramIndex++}`); }
    // DB column is 'active'
    if (input.enabled !== undefined) { params.push(input.enabled); updates.push(`active = $${paramIndex++}`); }
    if (updates.length === 0) return this.findById(id);
    params.push(id);
    const row = (await this.pool.query(
      `UPDATE webhooks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    )).rows[0];
    return row ? mapWebhook(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM webhooks WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async recordDelivery(webhookId: string, event: string, payload: Record<string, any>): Promise<WebhookDelivery> {
    const result = await this.pool.query(
      `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status, created_at)
       VALUES ($1, $2, $3, 'pending', NOW()) RETURNING *`,
      [webhookId, event, payload]
    );
    return mapDelivery(result.rows[0]);
  }

  async markDelivered(id: string, responseCode: number, responseBody: string): Promise<void> {
    await this.pool.query(
      "UPDATE webhook_deliveries SET status = 'delivered', response_code = $1, response_body = $2 WHERE id = $3",
      [responseCode, responseBody, id]
    );
  }

  async findDeliveriesByWebhook(webhookId: string, limit: number = 50): Promise<WebhookDelivery[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT $2',
      [webhookId, limit]
    )).rows;
    return rows.map(mapDelivery);
  }

  async findByTenantAndName(tenantId: string, name: string): Promise<Webhook | null> {
    const row = (await this.pool.query(
      'SELECT * FROM webhooks WHERE tenant_id = $1 AND name = $2',
      [tenantId, name]
    )).rows[0];
    return row ? mapWebhook(row) : null;
  }
}