import { DatabasePool } from '../database';
/**
 * WebhookRepository - Database layer for Webhook operations
 *
 * Maps to migration 021: webhooks & webhook_deliveries tables.
 * Maps to migration 061: webhook_endpoints, webhook_subscriptions, webhook_deliveries tables.
 * Note: DB column 'active' maps to 'enabled' in the interface for consistency.
 */

// ============================================================
// Legacy Webhook Interfaces (migration 021)
// ============================================================

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
  constructor(private pool: DatabasePool) {}

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

// ============================================================
// Enhanced Webhook Interfaces (migration 061)
// ============================================================

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  auth_type: 'none' | 'bearer' | 'basic' | 'api_key';
  auth_config: Record<string, any> | null;
  status: 'active' | 'inactive' | 'disabled';
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookSubscription {
  id: string;
  endpoint_id: string;
  event_type: string;
  filters: Record<string, any> | null;
  active: boolean;
  created_at: Date;
}

export interface WebhookDeliveryEnhanced {
  id: string;
  subscription_id: string;
  event_id: string;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempt: number;
  max_attempts: number;
  next_retry_at: Date | null;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  created_at: Date;
  delivered_at: Date | null;
}

// ============================================================
// Enhanced Repository Methods (migration 061)
// ============================================================

/** Map raw DB row to WebhookEndpoint interface */
function mapEndpoint(row: any): WebhookEndpoint {
  return {
    ...row,
    auth_type: row.auth_type || 'none',
    auth_config: row.auth_config || null,
    status: row.status || 'active',
  };
}

/** Map raw DB row to WebhookSubscription interface */
function mapSubscription(row: any): WebhookSubscription {
  return {
    ...row,
    filters: row.filters || null,
    active: row.active !== false,
  };
}

/** Map raw DB row to WebhookDeliveryEnhanced interface */
function mapDeliveryEnhanced(row: any): WebhookDeliveryEnhanced {
  return {
    ...row,
    payload: row.payload || {},
    status: row.status || 'pending',
    attempt: row.attempt || 0,
    max_attempts: row.max_attempts || 5,
    next_retry_at: row.next_retry_at || null,
    response_status: row.response_status || null,
    response_body: row.response_body || null,
    error_message: row.error_message || null,
    delivered_at: row.delivered_at || null,
  };
}

export class WebhookRepositoryEnhanced {
  constructor(private pool: DatabasePool) {}

  // ---- Webhook Endpoints ----

  async createEndpoint(input: {
    name: string;
    url: string;
    secret?: string;
    auth_type?: 'none' | 'bearer' | 'basic' | 'api_key';
    auth_config?: Record<string, any>;
    status?: 'active' | 'inactive' | 'disabled';
    created_by?: string;
  }): Promise<WebhookEndpoint> {
    const result = await this.pool.query(
      `INSERT INTO webhook_endpoints (name, url, secret, auth_type, auth_config, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        input.name,
        input.url,
        input.secret || null,
        input.auth_type || 'none',
        input.auth_config ? JSON.stringify(input.auth_config) : null,
        input.status || 'active',
        input.created_by || null,
      ]
    );
    return mapEndpoint(result.rows[0]);
  }

  async findEndpointById(id: string): Promise<WebhookEndpoint | null> {
    const row = (await this.pool.query(
      'SELECT * FROM webhook_endpoints WHERE id = $1',
      [id]
    )).rows[0];
    return row ? mapEndpoint(row) : null;
  }

  async listEndpoints(status?: 'active' | 'inactive' | 'disabled'): Promise<WebhookEndpoint[]> {
    let query = 'SELECT * FROM webhook_endpoints';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const rows = (await this.pool.query(query, params)).rows;
    return rows.map(mapEndpoint);
  }

  async updateEndpoint(
    id: string,
    input: Partial<{
      name: string;
      url: string;
      secret: string;
      auth_type: 'none' | 'bearer' | 'basic' | 'api_key';
      auth_config: Record<string, any>;
      status: 'active' | 'inactive' | 'disabled';
    }>
  ): Promise<WebhookEndpoint | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      updates.push(`name = $${paramIndex++}`);
    }
    if (input.url !== undefined) {
      params.push(input.url);
      updates.push(`url = $${paramIndex++}`);
    }
    if (input.secret !== undefined) {
      params.push(input.secret);
      updates.push(`secret = $${paramIndex++}`);
    }
    if (input.auth_type !== undefined) {
      params.push(input.auth_type);
      updates.push(`auth_type = $${paramIndex++}`);
    }
    if (input.auth_config !== undefined) {
      params.push(JSON.stringify(input.auth_config));
      updates.push(`auth_config = $${paramIndex++}`);
    }
    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramIndex++}`);
    }

    if (updates.length === 0) return this.findEndpointById(id);

    params.push(id);
    const row = (await this.pool.query(
      `UPDATE webhook_endpoints SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    )).rows[0];
    return row ? mapEndpoint(row) : null;
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM webhook_endpoints WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // ---- Webhook Subscriptions ----

  async createSubscription(input: {
    endpoint_id: string;
    event_type: string;
    filters?: Record<string, any>;
    active?: boolean;
  }): Promise<WebhookSubscription> {
    const result = await this.pool.query(
      `INSERT INTO webhook_subscriptions (endpoint_id, event_type, filters, active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        input.endpoint_id,
        input.event_type,
        input.filters ? JSON.stringify(input.filters) : null,
        input.active !== false,
      ]
    );
    return mapSubscription(result.rows[0]);
  }

  async findSubscriptionById(id: string): Promise<WebhookSubscription | null> {
    const row = (await this.pool.query(
      'SELECT * FROM webhook_subscriptions WHERE id = $1',
      [id]
    )).rows[0];
    return row ? mapSubscription(row) : null;
  }

  async findSubscriptionsByEvent(eventType: string, activeOnly: boolean = true): Promise<WebhookSubscription[]> {
    let query = `
      SELECT s.* FROM webhook_subscriptions s
      JOIN webhook_endpoints e ON s.endpoint_id = e.id
      WHERE s.event_type = $1
    `;
    const params: any[] = [eventType];

    if (activeOnly) {
      query += ' AND s.active = true AND e.status = $2';
      params.push('active');
    }

    query += ' ORDER BY s.created_at ASC';

    const rows = (await this.pool.query(query, params)).rows;
    return rows.map(mapSubscription);
  }

  async findSubscriptionsByEndpoint(endpointId: string): Promise<WebhookSubscription[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM webhook_subscriptions WHERE endpoint_id = $1 ORDER BY created_at DESC',
      [endpointId]
    )).rows;
    return rows.map(mapSubscription);
  }

  async updateSubscription(
    id: string,
    input: Partial<{
      filters: Record<string, any>;
      active: boolean;
    }>
  ): Promise<WebhookSubscription | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.filters !== undefined) {
      params.push(JSON.stringify(input.filters));
      updates.push(`filters = $${paramIndex++}`);
    }
    if (input.active !== undefined) {
      params.push(input.active);
      updates.push(`active = $${paramIndex++}`);
    }

    if (updates.length === 0) return this.findSubscriptionById(id);

    params.push(id);
    const row = (await this.pool.query(
      `UPDATE webhook_subscriptions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    )).rows[0];
    return row ? mapSubscription(row) : null;
  }

  async deleteSubscription(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM webhook_subscriptions WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // ---- Webhook Deliveries ----

  async recordDelivery(input: {
    subscription_id: string;
    event_id: string;
    payload: Record<string, any>;
  }): Promise<WebhookDeliveryEnhanced> {
    const result = await this.pool.query(
      `INSERT INTO webhook_deliveries (subscription_id, event_id, payload, status, attempt, created_at)
       VALUES ($1, $2, $3, 'pending', 0, NOW()) RETURNING *`,
      [input.subscription_id, input.event_id, JSON.stringify(input.payload)]
    );
    return mapDeliveryEnhanced(result.rows[0]);
  }

  async findDeliveryById(id: string): Promise<WebhookDeliveryEnhanced | null> {
    const row = (await this.pool.query(
      'SELECT * FROM webhook_deliveries WHERE id = $1',
      [id]
    )).rows[0];
    return row ? mapDeliveryEnhanced(row) : null;
  }

  async updateDelivery(
    id: string,
    input: Partial<{
      status: 'pending' | 'delivered' | 'failed' | 'retrying';
      attempt: number;
      next_retry_at: Date;
      response_status: number;
      response_body: string;
      error_message: string;
      delivered_at: Date;
    }>
  ): Promise<WebhookDeliveryEnhanced | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramIndex++}`);
    }
    if (input.attempt !== undefined) {
      params.push(input.attempt);
      updates.push(`attempt = $${paramIndex++}`);
    }
    if (input.next_retry_at !== undefined) {
      params.push(input.next_retry_at);
      updates.push(`next_retry_at = $${paramIndex++}`);
    }
    if (input.response_status !== undefined) {
      params.push(input.response_status);
      updates.push(`response_status = $${paramIndex++}`);
    }
    if (input.response_body !== undefined) {
      params.push(input.response_body);
      updates.push(`response_body = $${paramIndex++}`);
    }
    if (input.error_message !== undefined) {
      params.push(input.error_message);
      updates.push(`error_message = $${paramIndex++}`);
    }
    if (input.delivered_at !== undefined) {
      params.push(input.delivered_at);
      updates.push(`delivered_at = $${paramIndex++}`);
    }

    if (updates.length === 0) return this.findDeliveryById(id);

    params.push(id);
    const row = (await this.pool.query(
      `UPDATE webhook_deliveries SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    )).rows[0];
    return row ? mapDeliveryEnhanced(row) : null;
  }

  async findPendingDeliveries(limit: number = 100): Promise<WebhookDeliveryEnhanced[]> {
    const rows = (await this.pool.query(
      `SELECT d.* FROM webhook_deliveries d
       JOIN webhook_subscriptions s ON d.subscription_id = s.id
       JOIN webhook_endpoints e ON s.endpoint_id = e.id
       WHERE d.status IN ('pending', 'retrying')
         AND d.attempt < d.max_attempts
         AND (d.next_retry_at IS NULL OR d.next_retry_at <= NOW())
         AND s.active = true
         AND e.status = 'active'
       ORDER BY d.created_at ASC
       LIMIT $1`,
      [limit]
    )).rows;
    return rows.map(mapDeliveryEnhanced);
  }

  async findDeliveriesBySubscription(subscriptionId: string, limit: number = 50): Promise<WebhookDeliveryEnhanced[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM webhook_deliveries WHERE subscription_id = $1 ORDER BY created_at DESC LIMIT $2',
      [subscriptionId, limit]
    )).rows;
    return rows.map(mapDeliveryEnhanced);
  }

  // ---- Get endpoint with subscriptions (for dispatch) ----

  async getEndpointWithSubscriptions(endpointId: string): Promise<{
    endpoint: WebhookEndpoint | null;
    subscriptions: WebhookSubscription[];
  }> {
    const endpoint = await this.findEndpointById(endpointId);
    if (!endpoint) return { endpoint: null, subscriptions: [] };

    const subscriptions = await this.findSubscriptionsByEndpoint(endpointId);
    return { endpoint, subscriptions };
  }
}