import { DatabasePool } from '../database';
/**
 * SessionRepository - Database layer for Session operations
 */

export interface Session {
  id: string;
  user_id: string;
  tenant_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export class SessionRepository {
  constructor(private pool: DatabasePool) {}

  async create(userId: string, tenantId: string, token: string, expiresAt: Date): Promise<Session> {
    const result = await this.pool.query(
      'INSERT INTO sessions (user_id, tenant_id, token, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, tenantId, token, expiresAt]
    );
    return result.rows[0];
  }

  async findByToken(token: string): Promise<Session | null> {
    const result = await this.pool.query(
      'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    return result.rows[0] || null;
  }

  async revoke(token: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    return result.rowCount > 0;
  }

  async cleanup(): Promise<number> {
    const result = await this.pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
    return result.rowCount;
  }

  async findByUser(userId: string, tenantId?: string): Promise<Session[]> {
    if (tenantId) {
      const result = await this.pool.query(
        'SELECT * FROM sessions WHERE user_id = $1 AND tenant_id = $2 AND expires_at > NOW() ORDER BY created_at DESC',
        [userId, tenantId]
      );
      return result.rows;
    }
    const result = await this.pool.query(
      'SELECT * FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  async refresh(token: string, extendHours: number = 24): Promise<Session | null> {
    const expiresAt = new Date(Date.now() + extendHours * 60 * 60 * 1000);
    const result = await this.pool.query(
      'UPDATE sessions SET expires_at = $2 WHERE token = $1 AND expires_at > NOW() RETURNING *',
      [token, expiresAt]
    );
    return result.rows[0] || null;
  }
}