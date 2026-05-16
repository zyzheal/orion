export interface NotificationChannel {
  id: string;
  tenantId: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'pagerduty';
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationChannelInput {
  tenantId: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'pagerduty';
  enabled?: boolean;
  config: Record<string, unknown>;
}

export class NotificationChannelRepository {
  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }> },
  ) {}

  async create(data: CreateNotificationChannelInput): Promise<NotificationChannel> {
    const id = `channel-${crypto.randomUUID()}`;
    await this.db.query(
      `INSERT INTO notification_channels (id, tenant_id, name, type, enabled, config)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, data.tenantId, data.name, data.type, data.enabled ?? true, JSON.stringify(data.config)],
    );
    return { ...data, id, enabled: data.enabled ?? true, createdAt: new Date(), updatedAt: new Date() };
  }

  async findAll(tenantId: string, enabledOnly?: boolean): Promise<NotificationChannel[]> {
    let query = 'SELECT * FROM notification_channels WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (enabledOnly) {
      query += ' AND enabled = true';
    }
    query += ' ORDER BY type, name';
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRow(row));
  }

  async findById(id: string): Promise<NotificationChannel | null> {
    const result = await this.db.query('SELECT * FROM notification_channels WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${index++}`);
      values.push(updates.name);
    }
    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${index++}`);
      values.push(updates.enabled);
    }
    if (updates.config !== undefined) {
      fields.push(`config = $${index++}`);
      values.push(JSON.stringify(updates.config));
    }

    if (fields.length === 0) return existing;

    values.push(id);
    const result = await this.db.query(
      `UPDATE notification_channels SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${index} RETURNING *`,
      values,
    );
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM notification_channels WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): NotificationChannel {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: row.type,
      enabled: row.enabled,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
