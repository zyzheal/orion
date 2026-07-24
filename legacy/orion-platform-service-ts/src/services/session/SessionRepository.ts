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
  status?: string;
  last_activity_at?: Date;
  ip_address?: string;
  user_agent?: string;
}

export class SessionRepository {
  constructor(private pool: DatabasePool) {}

  async create(userId: string, tenantId: string, token: string, expiresAt: Date): Promise<Session> {
    const result = await this.pool.query(
      `INSERT INTO active_sessions (user_id, tenant_id, session_token, expires_at, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, user_id, tenant_id, session_token as token, expires_at, created_at, status, last_activity_at, ip_address, user_agent`,
      [userId, tenantId, token, expiresAt]
    );
    return result.rows[0];
  }

  async findByToken(token: string): Promise<Session | null> {
    const result = await this.pool.query(
      `SELECT id, user_id, tenant_id, session_token as token, expires_at, created_at, status, last_activity_at, ip_address, user_agent
       FROM active_sessions
       WHERE session_token = $1 AND expires_at > NOW()`,
      [token]
    );
    return result.rows[0] || null;
  }

  async revoke(token: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM active_sessions WHERE session_token = $1', [token]);
    return result.rowCount > 0;
  }

  async cleanup(): Promise<number> {
    const result = await this.pool.query('DELETE FROM active_sessions WHERE expires_at < NOW()');
    return result.rowCount;
  }

  async findByUser(userId: string, tenantId?: string): Promise<Session[]> {
    if (tenantId) {
      const result = await this.pool.query(
        `SELECT id, user_id, tenant_id, session_token as token, expires_at, created_at, status, last_activity_at, ip_address, user_agent
         FROM active_sessions
         WHERE user_id = $1 AND tenant_id = $2 AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [userId, tenantId]
      );
      return result.rows;
    }
    const result = await this.pool.query(
      `SELECT id, user_id, tenant_id, session_token as token, expires_at, created_at, status, last_activity_at, ip_address, user_agent
       FROM active_sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async refresh(token: string, extendHours: number = 24): Promise<Session | null> {
    const expiresAt = new Date(Date.now() + extendHours * 60 * 60 * 1000);
    const result = await this.pool.query(
      'UPDATE active_sessions SET expires_at = $2, last_activity_at = NOW() WHERE session_token = $1 AND expires_at > NOW() RETURNING id, user_id, tenant_id, session_token as token, expires_at, created_at, status, last_activity_at, ip_address, user_agent',
      [token, expiresAt]
    );
    return result.rows[0] || null;
  }
}