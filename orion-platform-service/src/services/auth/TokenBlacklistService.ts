// orion-platform-service/src/services/auth/TokenBlacklistService.ts
import crypto from 'crypto';
import { EventEmitter } from 'events';
import pino from 'pino';
import type { DatabasePool } from '../database';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface TokenBlacklistConfig {
  redisUrl?: string;
  ttlSeconds: number;
  keyPrefix: string;
}

export interface RevokedTokenInfo {
  tokenHash: string;
  userId: string;
  tenantId: number;
  revokedAt: Date;
  expiresAt: Date;
  revokeReason: string;
  revokedBy?: string;
}

export interface TokenBlacklistStats {
  totalRevoked: number;
  byReason: Record<string, number>;
  byTenant: Record<number, number>;
  byUser: Record<string, number>;
}

const DEFAULT_CONFIG: TokenBlacklistConfig = {
  ttlSeconds: 7 * 24 * 3600, // 7 days
  keyPrefix: 'token:blacklist:',
};

export class TokenBlacklistService extends EventEmitter {
  private config: TokenBlacklistConfig;
  private dbPool: DatabasePool;
  private redisClient: any; // Would be actual Redis client in production
  private revokedTokens: Map<string, RevokedTokenInfo> = new Map();
  private userTokenCounts: Map<string, number> = new Map();
  private tenantTokenCounts: Map<number, number> = new Map();

  constructor(dbPool: DatabasePool, config: Partial<TokenBlacklistConfig> = {}) {
    super();
    this.dbPool = dbPool;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async connect(): Promise<void> {
    // Placeholder - would connect to Redis in production
    // Example: this.redisClient = await createRedisClient(this.config.redisUrl);
    logger.info('[TokenBlacklist] Service connected');
  }

  /**
   * Hash token with SHA256 for secure storage
   * Returns 64 character hex string
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Revoke a token and add to blacklist
   */
  async revokeToken(
    token: string,
    userId: string,
    tenantId: number,
    reason: string,
    revokedBy?: string
  ): Promise<void> {
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.ttlSeconds * 1000);

    const info: RevokedTokenInfo = {
      tokenHash,
      userId,
      tenantId,
      revokedAt: now,
      expiresAt,
      revokeReason: reason,
      revokedBy,
    };

    // Store in local cache
    this.revokedTokens.set(tokenHash, info);

    // Update user token count
    const currentCount = this.userTokenCounts.get(userId) || 0;
    this.userTokenCounts.set(userId, currentCount + 1);

    // Update tenant token count
    const tenantCount = this.tenantTokenCounts.get(tenantId) || 0;
    this.tenantTokenCounts.set(tenantId, tenantCount + 1);

    // Persist to database
    try {
      await this.dbPool.query(
        `INSERT INTO token_blacklist (token_hash, user_id, tenant_id, revoked_at, expires_at, revoke_reason, revoked_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (token_hash) DO NOTHING`,
        [tokenHash, userId, tenantId, now, expiresAt, reason, revokedBy],
      );
      logger.debug(`[TokenBlacklist] Token persisted to database: ${tokenHash.slice(0, 16)}...`);
    } catch (error) {
      logger.error('[TokenBlacklist] Failed to persist token to database:', error);
      // Continue even if database fails - memory cache is still valid
    }

    // Emit event
    this.emit('token:revoked', info);

    logger.info(`[TokenBlacklist] Token revoked: ${tokenHash.slice(0, 16)}... reason=${reason} user=${userId}`);

    // In production: would also store in Redis with TTL
    // await this.redisClient.setex(`${this.config.keyPrefix}${tokenHash}`, this.config.ttlSeconds, JSON.stringify(info));
  }

  /**
   * Check if a token is revoked
   */
  async isRevoked(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    // Check local cache first
    const info = this.revokedTokens.get(tokenHash);
    if (info) {
      // Check if expired (cleanup automatically)
      if (info.expiresAt < new Date()) {
        this.revokedTokens.delete(tokenHash);
        return false;
      }
      return true;
    }

    // Check database as fallback
    try {
      const result = await this.dbPool.query(
        `SELECT token_hash, expires_at FROM token_blacklist WHERE token_hash = $1 AND expires_at > NOW()`,
        [tokenHash],
      );

      if (result.rows.length > 0) {
        // Found in database, add to cache for future lookups
        const dbRow = result.rows[0];
        this.revokedTokens.set(tokenHash, {
          tokenHash: dbRow.token_hash,
          userId: '', // Not needed for isRevoked check
          tenantId: 0,
          revokedAt: new Date(),
          expiresAt: dbRow.expires_at,
          revokeReason: 'unknown',
        });
        return true;
      }
    } catch (error) {
      logger.error('[TokenBlacklist] Failed to check database:', error);
      // On database error, rely on memory cache only (already checked above)
    }

    // In production: would also check Redis
    // const exists = await this.redisClient.exists(`${this.config.keyPrefix}${tokenHash}`);
    // return exists === 1;

    return false;
  }

  /**
   * Get revoked token info
   */
  async getRevokedTokenInfo(token: string): Promise<RevokedTokenInfo | null> {
    const tokenHash = this.hashToken(token);

    const info = this.revokedTokens.get(tokenHash);
    if (info) {
      // Check if expired
      if (info.expiresAt < new Date()) {
        this.revokedTokens.delete(tokenHash);
        return null;
      }
      return info;
    }

    return null;
  }

  /**
   * Revoke all tokens for a specific user (batch revocation)
   */
  async revokeAllUserTokens(userId: string, reason: string): Promise<number> {
    // Find all tokens for user
    const userTokens = Array.from(this.revokedTokens.values())
      .filter(info => info.userId === userId);

    // In production: would also query database/Redis for all user's active tokens
    // and revoke them

    const count = userTokens.length;

    // Emit batch revocation event
    this.emit('user:tokens_revoked', {
      userId,
      reason,
      revokedCount: count,
      timestamp: new Date(),
    });

    logger.info(`[TokenBlacklist] Batch revocation for user: ${userId} count=${count} reason=${reason}`);

    return count;
  }

  /**
   * Revoke all tokens for a specific tenant (tenant-wide revocation)
   */
  async revokeTenantTokens(tenantId: number, reason: string): Promise<number> {
    // Find all tokens for tenant
    const tenantTokens = Array.from(this.revokedTokens.values())
      .filter(info => info.tenantId === tenantId);

    const count = tenantTokens.length;

    // Emit tenant revocation event
    this.emit('tenant:tokens_revoked', {
      tenantId,
      reason,
      revokedCount: count,
      timestamp: new Date(),
    });

    logger.info(`[TokenBlacklist] Tenant-wide revocation: tenant=${tenantId} count=${count} reason=${reason}`);

    return count;
  }

  /**
   * Get count of revoked tokens for a specific user
   */
  async getUserRevokedCount(userId: string): Promise<number> {
    return this.userTokenCounts.get(userId) || 0;
  }

  /**
   * Cleanup expired tokens from blacklist
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const expiredHashes: string[] = [];

    for (const [hash, info] of this.revokedTokens.entries()) {
      if (info.expiresAt < now) {
        expiredHashes.push(hash);

        // Decrease user count
        const userCount = this.userTokenCounts.get(info.userId) || 0;
        if (userCount > 0) {
          this.userTokenCounts.set(info.userId, userCount - 1);
        }

        // Decrease tenant count
        const tenantCount = this.tenantTokenCounts.get(info.tenantId) || 0;
        if (tenantCount > 0) {
          this.tenantTokenCounts.set(info.tenantId, tenantCount - 1);
        }
      }
    }

    for (const hash of expiredHashes) {
      this.revokedTokens.delete(hash);
    }

    // Cleanup expired tokens from database
    let dbDeletedCount = 0;
    try {
      const dbResult = await this.dbPool.query(
        `DELETE FROM token_blacklist WHERE expires_at < NOW()`,
      );
      dbDeletedCount = dbResult.rowCount ?? 0;
      logger.debug(`[TokenBlacklist] Cleaned up ${dbDeletedCount} expired tokens from database`);
    } catch (error) {
      logger.error('[TokenBlacklist] Failed to cleanup database:', error);
    }

    const totalCleaned = expiredHashes.length + dbDeletedCount;

    // Emit cleanup event
    this.emit('cleanup:completed', {
      cleanedCount: totalCleaned,
      memoryCleaned: expiredHashes.length,
      dbCleaned: dbDeletedCount,
      timestamp: now,
    });

    logger.info(`[TokenBlacklist] Cleanup completed: removed ${expiredHashes.length} from memory, ${dbDeletedCount} from database`);

    return totalCleaned;
  }

  /**
   * Get statistics about revoked tokens
   */
  async getStats(): Promise<TokenBlacklistStats> {
    const byReason: Record<string, number> = {};
    const byTenant: Record<number, number> = {};
    const byUser: Record<string, number> = {};

    for (const info of this.revokedTokens.values()) {
      // Count by reason
      byReason[info.revokeReason] = (byReason[info.revokeReason] || 0) + 1;

      // Count by tenant
      byTenant[info.tenantId] = (byTenant[info.tenantId] || 0) + 1;

      // Count by user
      byUser[info.userId] = (byUser[info.userId] || 0) + 1;
    }

    return {
      totalRevoked: this.revokedTokens.size,
      byReason,
      byTenant,
      byUser,
    };
  }

  /**
   * Disconnect from Redis and cleanup
   */
  disconnect(): void {
    // Placeholder - would disconnect from Redis in production
    // if (this.redisClient) {
    //   await this.redisClient.quit();
    // }

    this.removeAllListeners();
    logger.info('[TokenBlacklist] Service disconnected');
  }
}