import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { DatabasePool } from '../database';

/**
 * NotificationTemplate - Database layer for notification templates
 */

export interface NotificationTemplate {
  id: string;
  tenant_id: string;
  name: string;
  event_type: string;
  subject: string | null;
  body_template: string;
  channel_ids: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateNotificationTemplateInput {
  name: string;
  event_type: string;
  subject?: string;
  body_template: string;
  channel_ids?: string[];
}

export interface UpdateNotificationTemplateInput {
  name?: string;
  event_type?: string;
  subject?: string;
  body_template?: string;
  channel_ids?: string[];
}

export class NotificationTemplateRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<NotificationTemplate | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'SELECT * FROM notification_templates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findAll(options?: { event_type?: string; limit?: number; offset?: number }): Promise<NotificationTemplate[]> {
    const tenantId = getCurrentTenantId();
    let query = 'SELECT * FROM notification_templates';
    const params: any[] = [];
    const conditions: string[] = [];
    params.push(tenantId);
    conditions.push(`tenant_id = $${params.length}`);

    if (options?.event_type) {
      params.push(options.event_type);
      conditions.push(`event_type = $${params.length}`);
    }

    query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }
    if (options?.offset) {
      params.push(options.offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByEventType(eventType: string): Promise<NotificationTemplate[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'SELECT * FROM notification_templates WHERE tenant_id = $1 AND event_type = $2 ORDER BY created_at DESC',
      [tenantId, eventType]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async create(input: CreateNotificationTemplateInput): Promise<NotificationTemplate> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO notification_templates (tenant_id, name, event_type, subject, body_template, channel_ids)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        tenantId,
        input.name,
        input.event_type,
        input.subject ?? null,
        input.body_template,
        input.channel_ids || [],
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id: string, updates: UpdateNotificationTemplateInput): Promise<NotificationTemplate | null> {
    const tenantId = getCurrentTenantId();
    const existing = await this.findById(id);
    if (!existing) return null;

    const setParts: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) { setParts.push(`name = $${idx++}`); params.push(updates.name); }
    if (updates.event_type !== undefined) { setParts.push(`event_type = $${idx++}`); params.push(updates.event_type); }
    if (updates.subject !== undefined) { setParts.push(`subject = $${idx++}`); params.push(updates.subject); }
    if (updates.body_template !== undefined) { setParts.push(`body_template = $${idx++}`); params.push(updates.body_template); }
    if (updates.channel_ids !== undefined) { setParts.push(`channel_ids = $${idx++}`); params.push(updates.channel_ids); }

    if (setParts.length === 0) return existing;

    setParts.push(`updated_at = NOW()`);
    params.push(id, tenantId);

    const result = await this.pool.query(
      `UPDATE notification_templates SET ${setParts.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'DELETE FROM notification_templates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async count(options?: { event_type?: string }): Promise<number> {
    const tenantId = getCurrentTenantId();
    let query = 'SELECT COUNT(*) as count FROM notification_templates WHERE tenant_id = $1';
    const params: any[] = [tenantId];

    if (options?.event_type) {
      params.push(options.event_type);
      query += ` AND event_type = $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): NotificationTemplate {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      event_type: row.event_type,
      subject: row.subject,
      body_template: row.body_template,
      channel_ids: row.channel_ids || [],
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
