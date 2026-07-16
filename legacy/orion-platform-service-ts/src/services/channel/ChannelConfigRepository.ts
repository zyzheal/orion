import { DatabasePool } from '../database';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface ChannelConfig {
  id: string;
  tenant_id: string;
  name: string;
  channel_type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  webhook_secret: string | null;
  auto_create_ticket: boolean;
  default_assignee: string | null;
  default_priority: string;
  rate_limit_per_minute: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateChannelConfigInput {
  name: string;
  channel_type: string;
  config: Record<string, unknown>;
  enabled?: boolean;
  webhook_secret?: string;
  auto_create_ticket?: boolean;
  default_assignee?: string;
  default_priority?: string;
  rate_limit_per_minute?: number;
  created_by?: string;
}

export interface UpdateChannelConfigInput {
  name?: string;
  channel_type?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
  webhook_secret?: string;
  auto_create_ticket?: boolean;
  default_assignee?: string;
  default_priority?: string;
  rate_limit_per_minute?: number;
}

export class ChannelConfigRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<ChannelConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM channel_configs WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(options?: {
    channelType?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: ChannelConfig[]; total: number }> {
    const tenantId = getCurrentTenantId();
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options?.channelType) {
      conditions.push(`channel_type = $${paramIndex}`);
      params.push(options.channelType);
      paramIndex++;
    }
    if (options?.enabled !== undefined) {
      conditions.push(`enabled = $${paramIndex}`);
      params.push(options.enabled);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM channel_configs WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM channel_configs WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  async create(input: CreateChannelConfigInput): Promise<ChannelConfig> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO channel_configs (tenant_id, name, channel_type, config, enabled, webhook_secret, auto_create_ticket, default_assignee, default_priority, rate_limit_per_minute, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        tenantId,
        input.name,
        input.channel_type,
        JSON.stringify(input.config),
        input.enabled ?? true,
        input.webhook_secret ?? null,
        input.auto_create_ticket ?? true,
        input.default_assignee ?? null,
        input.default_priority ?? 'medium',
        input.rate_limit_per_minute ?? 60,
        input.created_by ?? null,
      ]
    );
    return result.rows[0];
  }

  async update(id: string, input: UpdateChannelConfigInput): Promise<ChannelConfig | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }
    if (input.channel_type !== undefined) {
      setClauses.push(`channel_type = $${paramIndex}`);
      params.push(input.channel_type);
      paramIndex++;
    }
    if (input.config !== undefined) {
      setClauses.push(`config = $${paramIndex}`);
      params.push(JSON.stringify(input.config));
      paramIndex++;
    }
    if (input.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex}`);
      params.push(input.enabled);
      paramIndex++;
    }
    if (input.webhook_secret !== undefined) {
      setClauses.push(`webhook_secret = $${paramIndex}`);
      params.push(input.webhook_secret);
      paramIndex++;
    }
    if (input.auto_create_ticket !== undefined) {
      setClauses.push(`auto_create_ticket = $${paramIndex}`);
      params.push(input.auto_create_ticket);
      paramIndex++;
    }
    if (input.default_assignee !== undefined) {
      setClauses.push(`default_assignee = $${paramIndex}`);
      params.push(input.default_assignee);
      paramIndex++;
    }
    if (input.default_priority !== undefined) {
      setClauses.push(`default_priority = $${paramIndex}`);
      params.push(input.default_priority);
      paramIndex++;
    }
    if (input.rate_limit_per_minute !== undefined) {
      setClauses.push(`rate_limit_per_minute = $${paramIndex}`);
      params.push(input.rate_limit_per_minute);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push('updated_at = NOW()');
    params.push(id);

    const result = await this.pool.query(
      `UPDATE channel_configs SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM channel_configs WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
