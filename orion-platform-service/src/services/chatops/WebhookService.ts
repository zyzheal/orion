/**
 * Webhook Service
 *
 * Manages ChatOps webhook configurations and delivery
 */

import { DatabasePool } from '../database';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret_key: string | null;
  enabled: boolean;
  retry_count: number;
  retry_interval_seconds: number;
  timeout_seconds: number;
  headers: Record<string, string>;
  description: string;
  created_by: string;
  last_triggered_at: Date | null;
  last_status: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  events: string[];
  secret_key?: string;
  enabled?: boolean;
  retry_count?: number;
  retry_interval_seconds?: number;
  timeout_seconds?: number;
  headers?: Record<string, string>;
  description?: string;
  created_by?: string;
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: string[];
  secret_key?: string;
  enabled?: boolean;
  retry_count?: number;
  retry_interval_seconds?: number;
  timeout_seconds?: number;
  headers?: Record<string, string>;
  description?: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: Date;
}

export class WebhookService {
  constructor(private pool: DatabasePool) {}

  async getAll(): Promise<WebhookConfig[]> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_webhooks ORDER BY created_at DESC'
    );
    return result.rows.map(row => ({
      ...row,
      events: Array.isArray(row.events) ? row.events : JSON.parse(row.events || '[]'),
      headers: typeof row.headers === 'string' ? JSON.parse(row.headers) : row.headers,
    }));
  }

  async getById(id: string): Promise<WebhookConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_webhooks WHERE id = $1',
      [id]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      ...row,
      events: Array.isArray(row.events) ? row.events : JSON.parse(row.events || '[]'),
      headers: typeof row.headers === 'string' ? JSON.parse(row.headers) : row.headers,
    };
  }

  async create(input: CreateWebhookInput): Promise<WebhookConfig> {
    const id = uuidv4();
    const now = new Date();
    const secret = input.secret_key || crypto.randomBytes(32).toString('hex');

    await this.pool.query(
      `INSERT INTO chatops_webhooks
       (id, name, url, events, secret_key, enabled, retry_count, retry_interval_seconds, timeout_seconds, headers, description, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, input.name, input.url, JSON.stringify(input.events), secret,
       input.enabled ?? true, input.retry_count ?? 3, input.retry_interval_seconds ?? 30,
       input.timeout_seconds ?? 10, JSON.stringify(input.headers || {}),
       input.description || '', input.created_by || 'system', now, now]
    );

    return this.getById(id) as Promise<WebhookConfig>;
  }

  async update(id: string, input: UpdateWebhookInput): Promise<WebhookConfig | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (input.name !== undefined) { updates.push(`name = $${pi++}`); params.push(input.name); }
    if (input.url !== undefined) { updates.push(`url = $${pi++}`); params.push(input.url); }
    if (input.events !== undefined) { updates.push(`events = $${pi++}`); params.push(JSON.stringify(input.events)); }
    if (input.secret_key !== undefined) { updates.push(`secret_key = $${pi++}`); params.push(input.secret_key || null); }
    if (input.enabled !== undefined) { updates.push(`enabled = $${pi++}`); params.push(input.enabled); }
    if (input.retry_count !== undefined) { updates.push(`retry_count = $${pi++}`); params.push(input.retry_count); }
    if (input.retry_interval_seconds !== undefined) { updates.push(`retry_interval_seconds = $${pi++}`); params.push(input.retry_interval_seconds); }
    if (input.timeout_seconds !== undefined) { updates.push(`timeout_seconds = $${pi++}`); params.push(input.timeout_seconds); }
    if (input.headers !== undefined) { updates.push(`headers = $${pi++}`); params.push(JSON.stringify(input.headers)); }
    if (input.description !== undefined) { updates.push(`description = $${pi++}`); params.push(input.description); }

    if (updates.length > 0) {
      updates.push(`updated_at = $${pi++}`);
      params.push(new Date(), id);
      await this.pool.query(
        `UPDATE chatops_webhooks SET ${updates.join(', ')} WHERE id = $${pi}`,
        params
      );
    }

    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM chatops_webhooks WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async testWebhook(id: string): Promise<{ success: boolean; status?: number; error?: string }> {
    const webhook = await this.getById(id);
    if (!webhook) return { success: false, error: 'Webhook not found' };

    try {
      // Simulate delivery test
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatOps-Signature': this.signPayload(JSON.stringify({ test: true }), webhook.secret_key),
          ...(webhook.headers || {}),
        },
        body: JSON.stringify({ event: 'test', timestamp: new Date().toISOString() }),
        signal: AbortSignal.timeout((webhook.timeout_seconds || 10) * 1000),
      });

      await this.logDelivery(id, 'test', { test: true }, response.status, await response.text());
      return { success: response.ok, status: response.status };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      await this.logDelivery(id, 'test', { test: true }, null, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async getLogs(webhookId: string, limit = 20): Promise<WebhookLog[]> {
    const result = await this.pool.query(
      `SELECT * FROM chatops_webhook_logs
       WHERE webhook_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [webhookId, limit]
    );
    return result.rows.map(row => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    }));
  }

  private async logDelivery(
    webhookId: string,
    eventType: string,
    payload: Record<string, unknown>,
    status: number | null,
    responseBody: string | null,
    errorMessage?: string,
    retryCount = 0
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO chatops_webhook_logs
       (id, webhook_id, event_type, payload, response_status, response_body, error_message, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uuidv4(), webhookId, eventType, JSON.stringify(payload),
       status, responseBody, errorMessage || null, retryCount]
    );

    // Update webhook last_triggered_at and last_status
    await this.pool.query(
      `UPDATE chatops_webhooks
       SET last_triggered_at = NOW(), last_status = $1
       WHERE id = $2`,
      [errorMessage ? 'failed' : (status === 200 ? 'success' : 'error'), webhookId]
    );
  }

  private signPayload(payload: string, secret: string | null): string {
    if (!secret) return '';
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Deliver an event to matching webhooks
   */
  async deliverEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const webhooks = await this.getAll();
    const matching = webhooks.filter(w => w.enabled && w.events.includes(eventType));

    for (const webhook of matching) {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-ChatOps-Signature': this.signPayload(JSON.stringify(payload), webhook.secret_key),
            ...(webhook.headers || {}),
          },
          body: JSON.stringify({ event: eventType, ...payload, timestamp: new Date().toISOString() }),
          signal: AbortSignal.timeout((webhook.timeout_seconds || 10) * 1000),
        });

        await this.logDelivery(webhook.id, eventType, payload, response.status, await response.text());
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        await this.logDelivery(webhook.id, eventType, payload, null, errorMsg);
      }
    }
  }
}
