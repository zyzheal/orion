import { getCurrentTenantId } from '../db/tenant-context-storage';
import { DatabasePool } from '../services/database';

/**
 * DoNotDisturb - Database layer for do-not-disturb settings
 */

export interface DoNotDisturb {
  id: string;
  tenant_id: string;
  user_id: string;
  start_time: Date;
  end_time: Date;
  reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDoNotDisturbInput {
  user_id: string;
  start_time: Date;
  end_time: Date;
  reason?: string;
}

export class DoNotDisturbRepository {
  constructor(private pool: DatabasePool) {}

  async findByUser(userId: string): Promise<DoNotDisturb | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'SELECT * FROM do_not_disturb WHERE user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1',
      [userId, tenantId]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async upsert(userId: string, startTime: Date, endTime: Date, reason?: string): Promise<DoNotDisturb> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO do_not_disturb (tenant_id, user_id, start_time, end_time, reason)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, tenant_id) DO UPDATE SET
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         reason = EXCLUDED.reason,
         updated_at = NOW()
       RETURNING *`,
      [tenantId, userId, startTime, endTime, reason ?? null]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByUser(userId: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      'DELETE FROM do_not_disturb WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findActiveUsers(at: Date): Promise<string[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `SELECT user_id FROM do_not_disturb
       WHERE tenant_id = $1 AND start_time <= $2 AND end_time >= $2`,
      [tenantId, at]
    );
    return result.rows.map((row: any) => row.user_id);
  }

  protected mapRowToEntity(row: any): DoNotDisturb {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      start_time: row.start_time ? new Date(row.start_time) : new Date(),
      end_time: row.end_time ? new Date(row.end_time) : new Date(),
      reason: row.reason,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
