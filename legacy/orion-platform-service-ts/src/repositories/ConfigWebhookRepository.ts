/**
 * ConfigWebhookRepository — Data access layer for config_webhooks table
 *
 * Stores webhook registrations that receive HTTP notifications
 * when configuration values change.
 */

// ==================== Types ====================

export interface ConfigWebhookEntity {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  secret?: string;
  eventTypes: string[]; // e.g., ['config.updated', 'config.created']
  domains: string[];     // e.g., ['pipeline', 'security']
  enabled: boolean;
  retryCount: number;
  timeoutMs: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWebhookInput {
  name: string;
  description?: string;
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  secret?: string;
  eventTypes?: string[];
  domains?: string[];
  enabled?: boolean;
  retryCount?: number;
  timeoutMs?: number;
  createdBy: string;
}

export interface UpdateWebhookInput {
  name?: string;
  description?: string;
  url?: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  secret?: string;
  eventTypes?: string[];
  domains?: string[];
  enabled?: boolean;
  retryCount?: number;
  timeoutMs?: number;
  updatedBy: string;
}

// ==================== Repository ====================

export class ConfigWebhookRepository {
  private tableName = 'config_webhooks';

  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  async create(tenantId: string, input: CreateWebhookInput): Promise<ConfigWebhookEntity> {
    const id = `cfg-webhook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO ${this.tableName}
       (id, tenant_id, name, description, url, method, headers, secret,
        event_types, domains, enabled, retry_count, timeout_ms, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        id,
        tenantId,
        input.name,
        input.description ?? null,
        input.url,
        input.method ?? 'POST',
        JSON.stringify(input.headers ?? {}),
        input.secret ?? null,
        input.eventTypes ?? [],
        input.domains ?? [],
        input.enabled ?? true,
        input.retryCount ?? 3,
        input.timeoutMs ?? 10000,
        input.createdBy,
      ],
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  async findById(id: string, tenantId: string): Promise<ConfigWebhookEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenantId(tenantId: string, options?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ConfigWebhookEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (options?.enabled !== undefined) {
      query += ` AND enabled = $${idx++}`;
      params.push(options.enabled);
    }

    query += ` ORDER BY created_at DESC`;

    if (options?.limit !== undefined) {
      query += ` LIMIT $${idx++}`;
      params.push(options.limit);
    }
    if (options?.offset !== undefined) {
      query += ` OFFSET $${idx++}`;
      params.push(options.offset);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByEvent(tenantId: string, eventType: string, domain?: string): Promise<ConfigWebhookEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND enabled = true`;
    const params: unknown[] = [tenantId];
    let idx = 2;

    // Match if event_types is empty (match all) or contains the event type
    query += ` AND (event_types = '{}' OR $${idx} = ANY(event_types))`;
    params.push(eventType);
    idx++;

    if (domain) {
      query += ` AND (domains = '{}' OR $${idx} = ANY(domains))`;
      params.push(domain);
      idx++;
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async update(id: string, tenantId: string, input: UpdateWebhookInput): Promise<ConfigWebhookEntity | undefined> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return undefined;

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { setClauses.push(`name = $${idx++}`); params.push(input.name); }
    if (input.description !== undefined) { setClauses.push(`description = $${idx++}`); params.push(input.description); }
    if (input.url !== undefined) { setClauses.push(`url = $${idx++}`); params.push(input.url); }
    if (input.method !== undefined) { setClauses.push(`method = $${idx++}`); params.push(input.method); }
    if (input.headers !== undefined) { setClauses.push(`headers = $${idx++}`); params.push(JSON.stringify(input.headers)); }
    if (input.secret !== undefined) { setClauses.push(`secret = $${idx++}`); params.push(input.secret); }
    if (input.eventTypes !== undefined) { setClauses.push(`event_types = $${idx++}`); params.push(input.eventTypes); }
    if (input.domains !== undefined) { setClauses.push(`domains = $${idx++}`); params.push(input.domains); }
    if (input.enabled !== undefined) { setClauses.push(`enabled = $${idx++}`); params.push(input.enabled); }
    if (input.retryCount !== undefined) { setClauses.push(`retry_count = $${idx++}`); params.push(input.retryCount); }
    if (input.timeoutMs !== undefined) { setClauses.push(`timeout_ms = $${idx++}`); params.push(input.timeoutMs); }

    setClauses.push(`updated_at = NOW()`);
    params.push(id, tenantId);

    const result = await this.db.query(
      `UPDATE ${this.tableName} SET ${setClauses.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params,
    );

    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async countByTenantId(tenantId: string, enabled?: boolean): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (enabled !== undefined) {
      query += ` AND enabled = $2`;
      params.push(enabled);
    }

    const result = await this.db.query(query, params);
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  private mapRowToEntity(row: any): ConfigWebhookEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? undefined,
      url: row.url,
      method: row.method ?? 'POST',
      headers: typeof row.headers === 'string' ? JSON.parse(row.headers) : (row.headers ?? {}),
      secret: row.secret ?? undefined,
      eventTypes: row.event_types ?? [],
      domains: row.domains ?? [],
      enabled: row.enabled ?? true,
      retryCount: row.retry_count ?? 3,
      timeoutMs: row.timeout_ms ?? 10000,
      createdBy: row.created_by,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
