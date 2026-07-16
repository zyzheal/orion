import { DatabasePool } from '../database';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface ChannelMessage {
  id: string;
  tenant_id: string;
  channel_id: string;
  direction: string;
  message_type: string | null;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
  ticket_id: string | null;
  status: string;
  error_message: string | null;
  received_at: Date;
  processed_at: Date | null;
}

export interface CreateChannelMessageInput {
  channel_id: string;
  direction: string;
  message_type?: string;
  from_address?: string;
  to_address?: string;
  subject?: string;
  body?: string;
  metadata?: Record<string, unknown>;
  ticket_id?: string;
  status?: string;
  error_message?: string;
}

export class ChannelMessageRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<ChannelMessage | null> {
    const result = await this.pool.query(
      'SELECT * FROM channel_messages WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(options?: {
    channelId?: string;
    direction?: string;
    status?: string;
    ticketId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: ChannelMessage[]; total: number }> {
    const tenantId = getCurrentTenantId();
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options?.channelId) {
      conditions.push(`channel_id = $${paramIndex}`);
      params.push(options.channelId);
      paramIndex++;
    }
    if (options?.direction) {
      conditions.push(`direction = $${paramIndex}`);
      params.push(options.direction);
      paramIndex++;
    }
    if (options?.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }
    if (options?.ticketId) {
      conditions.push(`ticket_id = $${paramIndex}`);
      params.push(options.ticketId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM channel_messages WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM channel_messages WHERE ${whereClause} ORDER BY received_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  async create(input: CreateChannelMessageInput): Promise<ChannelMessage> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO channel_messages (tenant_id, channel_id, direction, message_type, from_address, to_address, subject, body, metadata, ticket_id, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        tenantId,
        input.channel_id,
        input.direction,
        input.message_type ?? null,
        input.from_address ?? null,
        input.to_address ?? null,
        input.subject ?? null,
        input.body ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.ticket_id ?? null,
        input.status ?? 'received',
        input.error_message ?? null,
      ]
    );
    return result.rows[0];
  }

  async updateStatus(id: string, status: string, extra?: { ticketId?: string; errorMessage?: string }): Promise<ChannelMessage | null> {
    const setClauses = ['status = $1', 'processed_at = NOW()'];
    const params: unknown[] = [status];
    let paramIndex = 2;

    if (extra?.ticketId) {
      setClauses.push(`ticket_id = $${paramIndex}`);
      params.push(extra.ticketId);
      paramIndex++;
    }
    if (extra?.errorMessage) {
      setClauses.push(`error_message = $${paramIndex}`);
      params.push(extra.errorMessage);
      paramIndex++;
    }

    params.push(id);
    const result = await this.pool.query(
      `UPDATE channel_messages SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async getByChannel(channelId: string, limit?: number): Promise<ChannelMessage[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'SELECT * FROM channel_messages WHERE tenant_id = $1 AND channel_id = $2 ORDER BY received_at DESC LIMIT $3',
      [tenantId, channelId, limit || 50]
    );
    return result.rows;
  }
}
