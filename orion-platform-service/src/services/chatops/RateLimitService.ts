/**
 * Rate Limit Service
 *
 * Manages ChatOps rate limit configurations
 */

import { DatabasePool } from '../database';
import { v4 as uuidv4 } from 'uuid';

export interface RateLimitConfig {
  id: string;
  target_type: 'user' | 'group' | 'command';
  target_id: string | null;
  command_name: string | null;
  limit_type: 'minute' | 'hour' | 'day';
  limit_count: number;
  window_seconds: number;
  description: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRateLimitInput {
  target_type: 'user' | 'group' | 'command';
  target_id?: string;
  command_name?: string;
  limit_type: 'minute' | 'hour' | 'day';
  limit_count: number;
  window_seconds: number;
  description?: string;
  enabled?: boolean;
}

export interface UpdateRateLimitInput {
  target_type?: 'user' | 'group' | 'command';
  target_id?: string;
  command_name?: string;
  limit_type?: 'minute' | 'hour' | 'day';
  limit_count?: number;
  window_seconds?: number;
  description?: string;
  enabled?: boolean;
}

export class RateLimitService {
  constructor(private pool: DatabasePool) {}

  async getAll(): Promise<RateLimitConfig[]> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_rate_limits ORDER BY target_type, command_name'
    );
    return result.rows;
  }

  async getById(id: string): Promise<RateLimitConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_rate_limits WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(input: CreateRateLimitInput): Promise<RateLimitConfig> {
    const id = uuidv4();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO chatops_rate_limits
       (id, target_type, target_id, command_name, limit_type, limit_count, window_seconds, description, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, input.target_type, input.target_id || null, input.command_name || null,
       input.limit_type, input.limit_count, input.window_seconds,
       input.description || '', input.enabled ?? true, now, now]
    );

    return this.getById(id) as Promise<RateLimitConfig>;
  }

  async update(id: string, input: UpdateRateLimitInput): Promise<RateLimitConfig | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (input.target_type !== undefined) { updates.push(`target_type = $${pi++}`); params.push(input.target_type); }
    if (input.target_id !== undefined) { updates.push(`target_id = $${pi++}`); params.push(input.target_id || null); }
    if (input.command_name !== undefined) { updates.push(`command_name = $${pi++}`); params.push(input.command_name || null); }
    if (input.limit_type !== undefined) { updates.push(`limit_type = $${pi++}`); params.push(input.limit_type); }
    if (input.limit_count !== undefined) { updates.push(`limit_count = $${pi++}`); params.push(input.limit_count); }
    if (input.window_seconds !== undefined) { updates.push(`window_seconds = $${pi++}`); params.push(input.window_seconds); }
    if (input.description !== undefined) { updates.push(`description = $${pi++}`); params.push(input.description); }
    if (input.enabled !== undefined) { updates.push(`enabled = $${pi++}`); params.push(input.enabled); }

    if (updates.length > 0) {
      updates.push(`updated_at = $${pi++}`);
      params.push(new Date(), id);
      await this.pool.query(
        `UPDATE chatops_rate_limits SET ${updates.join(', ')} WHERE id = $${pi}`,
        params
      );
    }

    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM chatops_rate_limits WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if a command execution exceeds rate limits
   */
  async checkLimit(userId: string, commandName: string): Promise<{ allowed: boolean; remaining?: number; resetAt?: Date }> {
    const limits = await this.pool.query(
      `SELECT * FROM chatops_rate_limits
       WHERE enabled = true
       AND (
         (target_type = 'command' AND command_name = $1)
         OR (target_type = 'user' AND target_id IS NULL)
         OR (target_type = 'user' AND target_id = $2)
       )`,
      [commandName, userId]
    );

    if (limits.rows.length === 0) {
      return { allowed: true };
    }

    // In production, this would check Redis counters
    // For now, return allowed since we don't have Redis integration
    return { allowed: true };
  }
}
