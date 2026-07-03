import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { DatabasePool } from '../database';

/**
 * ScheduledNotification - Database layer for scheduled notifications
 */

export interface ScheduledNotification {
  id: string;
  tenant_id: string;
  user_id: string | null;
  template_id: string | null;
  type: string;
  title: string;
  message: string;
  channel: string;
  scheduled_at: Date;
  status: string;
  sent_at: Date | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateScheduledNotificationInput {
  user_id: string;
  type: string;
  title: string;
  message: string;
  channel?: string;
  scheduled_at: Date;
  template_id?: string;
}

export interface UpdateScheduledNotificationInput {
  title?: string;
  message?: string;
  scheduled_at?: Date;
  status?: string;
}

export class ScheduledNotificationRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<ScheduledNotification | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'SELECT * FROM scheduled_notifications WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findAll(options?: {
    userId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ScheduledNotification[]> {
    const tenantId = getCurrentTenantId();
    let query = 'SELECT * FROM scheduled_notifications';
    const params: any[] = [];
    const conditions: string[] = [];
    params.push(tenantId);
    conditions.push(`tenant_id = $${params.length}`);

    if (options?.userId) {
      params.push(options.userId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (options?.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }

    query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY scheduled_at ASC';

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

  async findPendingByTimeRange(start: Date, end: Date): Promise<ScheduledNotification[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `SELECT * FROM scheduled_notifications
       WHERE tenant_id = $1 AND status = 'pending' AND scheduled_at >= $2 AND scheduled_at <= $3
       ORDER BY scheduled_at ASC`,
      [tenantId, start, end]
    );
    return result.rows.map(row => this.mapRowToEntity(row[0]));
  }

  async create(input: CreateScheduledNotificationInput): Promise<ScheduledNotification> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO scheduled_notifications (
         tenant_id, user_id, template_id, type, title, message, channel, scheduled_at, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *`,
      [
        tenantId,
        input.user_id,
        input.template_id ?? null,
        input.type,
        input.title,
        input.message,
        input.channel || 'in-app',
        input.scheduled_at,
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id: string, updates: UpdateScheduledNotificationInput): Promise<ScheduledNotification | null> {
    const tenantId = getCurrentTenantId();
    const existing = await this.findById(id);
    if (!existing) return null;

    const setParts: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (updates.title !== undefined) { setParts.push(`title = $${idx++}`); params.push(updates.title); }
    if (updates.message !== undefined) { setParts.push(`message = $${idx++}`); params.push(updates.message); }
    if (updates.scheduled_at !== undefined) { setParts.push(`scheduled_at = $${idx++}`); params.push(updates.scheduled_at); }
    if (updates.status !== undefined) { setParts.push(`status = $${idx++}`); params.push(updates.status); }

    if (setParts.length === 0) return existing;

    setParts.push(`updated_at = NOW()`);
    params.push(id, tenantId);

    const result = await this.pool.query(
      `UPDATE scheduled_notifications SET ${setParts.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async markAsSent(id: string): Promise<ScheduledNotification | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      "UPDATE scheduled_notifications SET status = 'sent', sent_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *",
      [id, tenantId]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async cancel(id: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      "UPDATE scheduled_notifications SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status = 'pending'",
      [id, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'DELETE FROM scheduled_notifications WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async count(options?: { userId?: string; status?: string }): Promise<number> {
    const tenantId = getCurrentTenantId();
    let query = 'SELECT COUNT(*) as count FROM scheduled_notifications WHERE tenant_id = $1';
    const params: any[] = [tenantId];

    if (options?.userId) {
      params.push(options.userId);
      query += ` AND user_id = $${params.length}`;
    }
    if (options?.status) {
      params.push(options.status);
      query += ` AND status = $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): ScheduledNotification {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      template_id: row.template_id,
      type: row.type,
      title: row.title,
      message: row.message,
      channel: row.channel,
      scheduled_at: row.scheduled_at ? new Date(row.scheduled_at) : new Date(),
      status: row.status,
      sent_at: row.sent_at ? new Date(row.sent_at) : null,
      error_message: row.error_message,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
