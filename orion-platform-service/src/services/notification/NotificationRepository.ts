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
    return (await this.pool.query('SELECT * FROM notifications WHERE id = $1', [id])).rows[0] || null;
  }

  async findAll(options?: { userId?: string; status?: string; limit?: number; offset?: number }): Promise<Notification[]> {
    let query = 'SELECT * FROM notifications';
    const params: any[] = [];
    const conditions: string[] = [];
    if (options?.userId) { params.push(options.userId); conditions.push(`user_id = $${params.length}`); }
    if (options?.status) { params.push(options.status); conditions.push(`status = $${params.length}`); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';
    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${params.length}`; }
    if (options?.offset) { params.push(options.offset); query += ` OFFSET $${params.length}`; }
    return (await this.pool.query(query, params)).rows;
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const result = await this.pool.query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, message, channel, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [input.tenant_id, input.user_id, input.type, input.title, input.message, input.channel || 'in-app']
    );
    return result.rows[0];
  }

  async markAsSent(id: string): Promise<Notification | null> {
    const result = await this.pool.query(
      "UPDATE notifications SET status = 'sent', sent_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0] || null;
  }

  async markAsRead(id: string): Promise<Notification | null> {
    const result = await this.pool.query(
      "UPDATE notifications SET status = 'read', read_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0] || null;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.pool.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND status = 'sent'",
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async count(options?: { userId?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM notifications';
    const params: any[] = [];
    if (options?.userId) { params.push(options.userId); query += ' WHERE user_id = $1'; }
    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }
}