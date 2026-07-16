import { DatabasePool } from '../database';
/**
 * CacheRepository - Database layer for Cache operations
 */

export interface CacheEntry {
  id: string;
  tenant_id: string;
  key: string;
  value: Record<string, any>;
  ttl: number;
  created_at: Date;
  expires_at: Date;
}

export class CacheRepository {
  constructor(private pool: DatabasePool) {}

  async set(tenantId: string, key: string, value: Record<string, any>, ttl: number = 3600): Promise<CacheEntry> {
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const result = await this.pool.query(
      `INSERT INTO cache_entries (tenant_id, key, value, ttl, created_at, expires_at)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = $3, ttl = $4, created_at = NOW(), expires_at = $5
       RETURNING *`,
      [tenantId, key, value, ttl, expiresAt]
    );
    return result.rows[0];
  }

  async get(tenantId: string, key: string): Promise<CacheEntry | null> {
    const result = await this.pool.query(
      'SELECT * FROM cache_entries WHERE tenant_id = $1 AND key = $2 AND expires_at > NOW()',
      [tenantId, key]
    );
    return result.rows[0] || null;
  }

  async delete(tenantId: string, key: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM cache_entries WHERE tenant_id = $1 AND key = $2', [tenantId, key]);
    return result.rowCount > 0;
  }

  async cleanup(): Promise<number> {
    const result = await this.pool.query('DELETE FROM cache_entries WHERE expires_at < NOW()');
    return result.rowCount;
  }
}