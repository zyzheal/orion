/**
 * NotificationDeliveryRepository - Database layer for notification delivery tracking
 *
 * Tracks individual channel delivery attempts with retry state,
 * fallback chain, and error details for multi-channel notifications.
 */
import { getCurrentTenantId } from '../db/tenant-context-storage';
import { DatabasePool } from '../services/database';

export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'retrying' | 'exhausted';
export type DeliveryChannel = 'email' | 'sms' | 'webhook' | 'push' | 'in-app';

export interface NotificationDelivery {
  id: string;
  tenant_id: string;
  notification_id: string;
  channel: DeliveryChannel;
  recipient: string;
  subject: string | null;
  body: string | null;
  status: DeliveryStatus;
  attempt_number: number;
  max_attempts: number;
  error_message: string | null;
  response_body: string | null;
  response_status: number | null;
  sent_at: Date | null;
  next_retry_at: Date | null;
  fallback_channel: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDeliveryInput {
  notification_id: string;
  channel: DeliveryChannel;
  recipient: string;
  subject?: string | null;
  body?: string | null;
  max_attempts?: number;
  fallback_channel?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateDeliveryInput {
  status?: DeliveryStatus;
  attempt_number?: number;
  error_message?: string | null;
  response_body?: string | null;
  response_status?: number | null;
  sent_at?: Date | null;
  next_retry_at?: Date | null;
  metadata?: Record<string, unknown>;
}

export class NotificationDeliveryRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<NotificationDelivery | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'SELECT * FROM notification_deliveries WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] || null;
  }

  async findByNotificationId(notificationId: string): Promise<NotificationDelivery[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'SELECT * FROM notification_deliveries WHERE notification_id = $1 AND tenant_id = $2 ORDER BY created_at ASC',
      [notificationId, tenantId]
    );
    return result.rows;
  }

  async findPendingForRetry(limit = 50): Promise<NotificationDelivery[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `SELECT * FROM notification_deliveries
       WHERE tenant_id = $1
         AND status IN ('pending', 'retrying')
         AND next_retry_at IS NOT NULL
         AND next_retry_at <= NOW()
         AND attempt_number <= max_attempts
       ORDER BY next_retry_at ASC
       LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  }

  async create(input: CreateDeliveryInput): Promise<NotificationDelivery> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO notification_deliveries (
        tenant_id, notification_id, channel, recipient, subject, body,
        status, attempt_number, max_attempts, fallback_channel, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 1, $7, $8, $9)
      RETURNING *`,
      [
        tenantId,
        input.notification_id,
        input.channel,
        input.recipient,
        input.subject ?? null,
        input.body ?? null,
        input.max_attempts ?? 3,
        input.fallback_channel ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    return result.rows[0];
  }

  async updateStatus(id: string, input: UpdateDeliveryInput): Promise<NotificationDelivery | null> {
    const tenantId = getCurrentTenantId();

    const fields: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 0;

    // id and tenant_id are always first
    params.push(id, tenantId);
    idx = 2;

    if (input.status !== undefined) {
      idx++;
      fields.push(`status = $${idx}`);
      params.push(input.status);
    }
    if (input.attempt_number !== undefined) {
      idx++;
      fields.push(`attempt_number = $${idx}`);
      params.push(input.attempt_number);
    }
    if (input.error_message !== undefined) {
      idx++;
      fields.push(`error_message = $${idx}`);
      params.push(input.error_message);
    }
    if (input.response_body !== undefined) {
      idx++;
      fields.push(`response_body = $${idx}`);
      params.push(input.response_body);
    }
    if (input.response_status !== undefined) {
      idx++;
      fields.push(`response_status = $${idx}`);
      params.push(input.response_status);
    }
    if (input.sent_at !== undefined) {
      idx++;
      fields.push(`sent_at = $${idx}`);
      params.push(input.sent_at);
    }
    if (input.next_retry_at !== undefined) {
      idx++;
      fields.push(`next_retry_at = $${idx}`);
      params.push(input.next_retry_at);
    }
    if (input.metadata !== undefined) {
      idx++;
      fields.push(`metadata = $${idx}`);
      params.push(JSON.stringify(input.metadata));
    }

    const result = await this.pool.query(
      `UPDATE notification_deliveries SET ${fields.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async incrementAttempt(id: string): Promise<NotificationDelivery | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `UPDATE notification_deliveries
       SET attempt_number = attempt_number + 1,
           status = 'retrying',
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0] || null;
  }

  async markExhausted(id: string, lastError?: string | null): Promise<NotificationDelivery | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `UPDATE notification_deliveries
       SET status = 'exhausted',
           error_message = COALESCE($3, error_message),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, lastError ?? null]
    );
    return result.rows[0] || null;
  }

  async count(options?: { notificationId?: string; status?: DeliveryStatus }): Promise<number> {
    const tenantId = getCurrentTenantId();
    const params: any[] = [tenantId];
    let where = 'WHERE tenant_id = $1';

    if (options?.notificationId) {
      params.push(options.notificationId);
      where += ` AND notification_id = $${params.length}`;
    }
    if (options?.status) {
      params.push(options.status);
      where += ` AND status = $${params.length}`;
    }

    const result = await this.pool.query(`SELECT COUNT(*) as count FROM notification_deliveries ${where}`, params);
    return parseInt(result.rows[0].count, 10);
  }
}
