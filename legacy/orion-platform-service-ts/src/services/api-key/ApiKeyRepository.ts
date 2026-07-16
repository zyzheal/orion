import { DatabasePool } from '../database';
/**
 * ApiKeyRepository - Database layer for API Key operations
 */

export interface ApiKey {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  key_hash: string;
  permissions: string[];
  expires_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
}

export class ApiKeyRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<ApiKey | null> {
    return (await this.pool.query('SELECT * FROM api_keys WHERE id = $1', [id])).rows[0] || null;
  }

  async findAll(tenantId: string): Promise<ApiKey[]> {
    return (await this.pool.query('SELECT * FROM api_keys WHERE tenant_id = $1', [tenantId])).rows;
  }

  async create(tenantId: string, userId: string, name: string, keyHash: string, permissions: string[], expiresAt?: Date): Promise<ApiKey> {
    const result = await this.pool.query(
      'INSERT INTO api_keys (tenant_id, user_id, name, key_hash, permissions, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [tenantId, userId, name, keyHash, permissions, expiresAt || null]
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM api_keys WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [id]);
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    return (await this.pool.query('SELECT * FROM api_keys WHERE key_hash = $1', [keyHash])).rows[0] || null;
  }
}