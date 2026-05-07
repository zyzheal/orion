/**
 * BlacklistedTokenRepository - PostgreSQL data access for revoked tokens
 *
 * Works with the existing token_blacklist table (migration 072).
 * Provides CRUD operations for token revocation with batch cleanup support.
 */

export interface BlacklistedTokenEntity {
  id: number;
  tokenHash: string;
  userId: string;
  tenantId: number;
  revokedAt: Date;
  expiresAt: Date;
  revokeReason: string;
  revokedBy?: string;
  metadata: Record<string, unknown>;
}

export interface CreateBlacklistedTokenInput {
  tokenHash: string;
  userId: string;
  tenantId: number;
  revokeReason: string;
  revokedBy?: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface BlacklistedTokenStats {
  totalRevoked: number;
  byReason: Record<string, number>;
  byTenant: Record<number, number>;
  byUser: Record<string, number>;
}

export class BlacklistedTokenRepository {
  constructor(
    private db: {
      query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
    },
  ) {}

  /** Find a revoked token by its JTI or hash */
  async findByHash(tokenHash: string): Promise<BlacklistedTokenEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM token_blacklist WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Create a new blacklisted token entry */
  async create(input: CreateBlacklistedTokenInput): Promise<BlacklistedTokenEntity> {
    const result = await this.db.query(
      `INSERT INTO token_blacklist (
        token_hash, user_id, tenant_id, revoked_at, expires_at,
        revoke_reason, revoked_by, metadata
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7)
      ON CONFLICT (token_hash) DO NOTHING
      RETURNING *`,
      [
        input.tokenHash,
        input.userId,
        input.tenantId,
        input.expiresAt,
        input.revokeReason,
        input.revokedBy ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    // On conflict, return the existing row
    if (result.rows.length === 0) {
      const existing = await this.findByHash(input.tokenHash);
      if (existing) return existing;
      // Fallback: create a synthetic entity
      return {
        id: 0,
        tokenHash: input.tokenHash,
        userId: input.userId,
        tenantId: input.tenantId,
        revokedAt: new Date(),
        expiresAt: input.expiresAt,
        revokeReason: input.revokeReason,
        revokedBy: input.revokedBy,
        metadata: input.metadata ?? {},
      };
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /** Revoke all active tokens for a specific user */
  async revokeAllUserTokens(
    userId: string,
    reason: string,
    expiresAt: Date,
  ): Promise<number> {
    const result = await this.db.query(
      `UPDATE token_blacklist
       SET revoke_reason = $2, expires_at = $3
       WHERE user_id = $1 AND expires_at > NOW()
       RETURNING id`,
      [userId, reason, expiresAt],
    );
    return result.rowCount ?? 0;
  }

  /** Revoke all tokens for a specific tenant */
  async revokeAllTenantTokens(
    tenantId: number,
    reason: string,
    expiresAt: Date,
  ): Promise<number> {
    const result = await this.db.query(
      `UPDATE token_blacklist
       SET revoke_reason = $2, expires_at = $3
       WHERE tenant_id = $1 AND expires_at > NOW()
       RETURNING id`,
      [tenantId, reason, expiresAt],
    );
    return result.rowCount ?? 0;
  }

  /** Cleanup expired tokens from the database */
  async cleanupExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM token_blacklist WHERE expires_at < NOW()`,
    );
    return result.rowCount ?? 0;
  }

  /** Get count of revoked tokens for a user */
  async getUserRevokedCount(userId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM token_blacklist WHERE user_id = $1 AND expires_at > NOW()`,
      [userId],
    );
    if (result.rows.length === 0) {
      throw new Error('No count data returned from database');
    }
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /** Get comprehensive statistics */
  async getStats(): Promise<BlacklistedTokenStats> {
    const result = await this.db.query(
      `SELECT
        COUNT(*) as total,
        COALESCE(json_object_agg(revoke_reason, cnt) FILTER (WHERE revoke_reason IS NOT NULL), '{}'::json) as by_reason,
        COALESCE(json_object_agg(tenant_id, cnt) FILTER (WHERE tenant_id IS NOT NULL), '{}'::json) as by_tenant,
        COALESCE(json_object_agg(user_id, cnt) FILTER (WHERE user_id IS NOT NULL), '{}'::json) as by_user
       FROM (
         SELECT revoke_reason, tenant_id, user_id, COUNT(*) as cnt
         FROM token_blacklist
         WHERE expires_at > NOW()
         GROUP BY revoke_reason, tenant_id, user_id
       ) sub`,
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('No stats data returned from database');
    }

    return {
      totalRevoked: parseInt(row?.total || '0', 10),
      byReason: row?.by_reason ? JSON.parse(typeof row.by_reason === 'string' ? row.by_reason : JSON.stringify(row.by_reason)) : {},
      byTenant: row?.by_tenant ? JSON.parse(typeof row.by_tenant === 'string' ? row.by_tenant : JSON.stringify(row.by_tenant)) : {},
      byUser: row?.by_user ? JSON.parse(typeof row.by_user === 'string' ? row.by_user : JSON.stringify(row.by_user)) : {},
    };
  }

  protected mapRowToEntity(row: any): BlacklistedTokenEntity {
    return {
      id: row.id,
      tokenHash: row.token_hash,
      userId: row.user_id,
      tenantId: row.tenant_id,
      revokedAt: row.revoked_at,
      expiresAt: row.expires_at,
      revokeReason: row.revoke_reason,
      revokedBy: row.revoked_by,
      metadata: row.metadata ?? {},
    };
  }
}
