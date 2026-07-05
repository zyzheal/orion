import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { DatabasePool } from '../database';

/**
 * NotificationRepository - Database layer for Notification operations
 */


export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  sent_at: Date | null;
  read_at: Date | null;
  created_at: Date;
}

export interface CreateNotificationInput {
  tenant_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  channel?: string;
}

export class NotificationRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<Notification | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'SELECT * FROM notifications WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] || null;
  }

  async findAll(options?: { userId?: string; status?: string; limit?: number; offset?: number }): Promise<Notification[]> {
    const tenantId = getCurrentTenantId();
    let query = 'SELECT * FROM notifications';
    const params: any[] = [];
    const conditions: string[] = [];
    params.push(tenantId);
    conditions.push(`tenant_id = $${params.length}`);
    if (options?.userId) { params.push(options.userId); conditions.push(`user_id = $${params.length}`); }
    if (options?.status) { params.push(options.status); conditions.push(`status = $${params.length}`); }
    query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';
    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${params.length}`; }
    if (options?.offset) { params.push(options.offset); query += ` OFFSET $${params.length}`; }
    return (await this.pool.query(query, params)).rows;
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, message, channel, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [tenantId, input.user_id, input.type, input.title, input.message, input.channel || 'in-app']
    );
    return result.rows[0];
  }

  async markAsSent(id: string): Promise<Notification | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      "UPDATE notifications SET status = 'sent', sent_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *",
      [id, tenantId]
    );
    return result.rows[0] || null;
  }

  async markAsRead(id: string): Promise<Notification | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      "UPDATE notifications SET status = 'read', read_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *",
      [id, tenantId]
    );
    return result.rows[0] || null;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND status = 'sent' AND tenant_id = $2",
      [userId, tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async count(options?: { userId?: string }): Promise<number> {
    const tenantId = getCurrentTenantId();
    let query = 'SELECT COUNT(*) as count FROM notifications';
    const params: any[] = [];
    params.push(tenantId);
    let whereClause = ' WHERE tenant_id = $1';
    if (options?.userId) { params.push(options.userId); whereClause += ` AND user_id = $${params.length}`; }
    query += whereClause;
    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }
}