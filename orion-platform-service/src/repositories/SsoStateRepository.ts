/**
 * SsoStateRepository - PostgreSQL data access for SSO OAuth state
 *
 * Works with the existing sso_states table (migration 183).
 * Provides state storage for CSRF protection during SSO flows.
 */

export interface SsoStateEntity {
  id: string;
  state: string;
  provider: string;
  data: string;
  expiresAt: Date;
  createdAt: Date;
}

export class SsoStateRepository {
  constructor(
    private db: {
      query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
    },
  ) {}

  /** Store a new SSO state */
  async create(state: string, provider: string, data: string, ttlSeconds: number): Promise<void> {
    await this.db.query(
      `INSERT INTO sso_states (state, provider, data, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::interval)
       ON CONFLICT (state) DO UPDATE SET data = $3, expires_at = NOW() + ($4 || ' seconds')::interval`,
      [state, provider, data, String(ttlSeconds)],
    );
  }

  /** Retrieve state data by state key */
  async findByState(state: string): Promise<SsoStateEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM sso_states WHERE state = $1 AND expires_at > NOW()`,
      [state],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Delete a state by state key */
  async deleteByState(state: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM sso_states WHERE state = $1`,
      [state],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Cleanup expired states */
  async cleanupExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM sso_states WHERE expires_at < NOW()`,
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): SsoStateEntity {
    return {
      id: row.id,
      state: row.state,
      provider: row.provider,
      data: row.data || '',
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}
