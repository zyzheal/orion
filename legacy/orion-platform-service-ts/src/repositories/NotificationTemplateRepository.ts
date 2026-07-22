/**
 * NotificationTemplateRepository - Database layer for Notification Template operations
 *
 * CRUD + listing for notification templates with multi-tenant isolation.
 * Table: notification_templates
 */

import { getCurrentTenantId } from '../db/tenant-context-storage';
import { DatabasePool } from '../services/database';
import { OrionError, ErrorCode } from '../errors';

export interface NotificationTemplateEntity {
  id: string;
  tenant_id: string;
  name: string;
  event_type: string;
  subject: string | null;
  subject_template: string | null;
  body_template: string;
  variables: Record<string, any>;
  variables_schema: Record<string, any>;
  is_system: boolean;
  category: string;
  channel_ids: string[];
  created_by: string;
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

  async findById(id: string): Promise<NotificationTemplateEntity | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'SELECT * FROM notification_templates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findAll(options?: { event_type?: string; limit?: number; offset?: number }): Promise<NotificationTemplateEntity[]> {
    const tenantId = getCurrentTenantId();
    let query = 'SELECT * FROM notification_templates';
    const params: any[] = [];
    const conditions: string[] = [];
    params.push(tenantId);
    conditions.push(`tenant_id = $${params.length}`);

    if (options?.event_type) {
      params.push(options.event_type);
      conditions.push(`type = $${params.length}`);
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

  async findByEventType(eventType: string): Promise<NotificationTemplateEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'SELECT * FROM notification_templates WHERE tenant_id = $1 AND type = $2 ORDER BY created_at DESC',
      [tenantId, eventType]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async create(tenantId: string, input: CreateNotificationTemplateInput): Promise<NotificationTemplateEntity> {
    const id = `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const variables: Record<string, any> = { channel_ids: input.channel_ids ?? [] };

    const result = await this.pool.query(
      `INSERT INTO notification_templates (id, tenant_id, name, type, subject, subject_template, body, variables, variables_schema, is_system, category, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 'general', $10, NOW(), NOW())
       RETURNING *`,
      [
        id,
        tenantId,
        input.name,
        input.event_type,
        input.subject ?? null,
        input.subject ?? null,
        input.body_template,
        JSON.stringify(variables),
        JSON.stringify({}),
        tenantId,
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id: string, tenantId: string, updates: UpdateNotificationTemplateInput): Promise<NotificationTemplateEntity | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const setParts: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) { setParts.push(`name = $${idx++}`); params.push(updates.name); }
    if (updates.event_type !== undefined) { setParts.push(`type = $${idx++}`); params.push(updates.event_type); }
    if (updates.subject !== undefined) { setParts.push(`subject = $${idx++}`, `subject_template = $${idx++}`); params.push(updates.subject, updates.subject); }
    if (updates.body_template !== undefined) { setParts.push(`body = $${idx++}`); params.push(updates.body_template); }
    if (updates.channel_ids !== undefined) {
      setParts.push(`variables = jsonb_set(COALESCE(variables, '{}'), '{channel_ids}', $${idx++})`);
      params.push(JSON.stringify(updates.channel_ids));
    }

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
      query += ` AND type = $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): NotificationTemplateEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      event_type: row.type,
      subject: row.subject,
      subject_template: row.subject_template,
      body_template: row.body,
      variables: typeof row.variables === 'string' ? JSON.parse(row.variables) : (row.variables ?? {}),
      variables_schema: typeof row.variables_schema === 'string' ? JSON.parse(row.variables_schema) : (row.variables_schema ?? {}),
      is_system: row.is_system,
      category: row.category ?? 'general',
      channel_ids: (typeof row.variables === 'string' ? JSON.parse(row.variables) : (row.variables ?? {}))?.channel_ids ?? [],
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
