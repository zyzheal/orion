import type { DatabasePool } from '../utils/database';
import type { Notification, CreateNotificationInput } from '../types/notification';

export class NotificationRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<Notification | null> {
    const result = await this.pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findAll(options?: { userId?: string; status?: string; limit?: number; offset?: number }): Promise<Notification[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options?.userId) { params.push(options.userId); conditions.push(`user_id = $${params.length}`); }
    if (options?.status) { params.push(options.status); conditions.push(`status = $${params.length}`); }

    let query = 'SELECT * FROM notifications';
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${params.length}`; }
    if (options?.offset) { params.push(options.offset); query += ` OFFSET $${params.length}`; }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRow(row));
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const result = await this.pool.query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, message, channel, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [input.tenant_id, input.user_id, input.type, input.title, input.message, input.channel || 'in-app']
    );
    return this.mapRow(result.rows[0]);
  }

  async markAsSent(id: string): Promise<Notification | null> {
    const result = await this.pool.query(
      "UPDATE notifications SET status = 'sent', sent_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markAsRead(id: string): Promise<Notification | null> {
    const result = await this.pool.query(
      "UPDATE notifications SET status = 'read', read_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.pool.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND status = 'sent'",
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async broadcast(tenantId: string, userIds: string[], type: string, title: string, message: string, channel?: string): Promise<number> {
    const values: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const userId of userIds) {
      values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, 'pending')`);
      params.push(tenantId, userId, type, title, message, channel || 'in-app');
      idx += 6;
    }

    const result = await this.pool.query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, message, channel, status)
       VALUES ${values.join(', ')} RETURNING id`,
      params
    );
    return result.rowCount ?? 0;
  }

  private mapRow(row: any): Notification {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      channel: row.channel,
      status: row.status,
      sent_at: row.sent_at ? new Date(row.sent_at) : null,
      read_at: row.read_at ? new Date(row.read_at) : null,
      created_at: new Date(row.created_at),
    };
  }
}
