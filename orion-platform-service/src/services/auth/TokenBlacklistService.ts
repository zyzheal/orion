// orion-platform-service/src/services/auth/TokenBlacklistService.ts
import crypto from 'crypto';
import { EventEmitter } from 'events';
import pino from 'pino';
import { DatabasePool } from '../database';
import {
  BlacklistedTokenRepository,
  BlacklistedTokenEntity,
} from '../../repositories/BlacklistedTokenRepository';

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

/**
 * TokenBlacklistService - Manages revoked JWT tokens
 *
 * Primary storage: PostgreSQL (token_blacklist table via BlacklistedTokenRepository)
 * Cache layer: In-memory Map for fast lookups (read-through cache)
 * - On service restart, cache is warmed from database
 * - Expired tokens are cleaned up periodically
 */
export class TokenBlacklistService extends EventEmitter {
  private config: TokenBlacklistConfig;
  private repository: BlacklistedTokenRepository | null;
  private redisClient: any; // Would be actual Redis client in production

  // Read-through cache: hash -> entity
  private cache: Map<string, BlacklistedTokenEntity> = new Map();
  // Cache initialization flag
  private cacheInitialized = false;
  // Periodic cleanup timer
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(dbPool: DatabasePool | null, config: Partial<TokenBlacklistConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.repository = dbPool ? new BlacklistedTokenRepository(dbPool) : null;
  }

  async connect(): Promise<void> {
    logger.info('[TokenBlacklist] Service connected');

    // Warm cache from database
    await this.warmCache();

    // Start periodic cleanup (every 30 minutes)
    this.startPeriodicCleanup();
  }

  /** Warm the in-memory cache with recent entries from the database */
  private async warmCache(): Promise<void> {
    if (!this.repository) {
      logger.warn('[TokenBlacklist] No database connection, skipping cache warm');
      return;
    }

    try {
      // Load all non-expired tokens from DB into cache
      const result = await this.repository.getStats();
      logger.info(`[TokenBlacklist] Cache warmed: ${result.totalRevoked} revoked tokens in database`);
      this.cacheInitialized = true;
    } catch (error) {
      logger.error('[TokenBlacklist] Failed to warm cache:', error);
      // Still mark as initialized - will fall through to DB on misses
      this.cacheInitialized = true;
    }
  }

  /** Start periodic cleanup of expired tokens */
  private startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        const cleaned = await this.cleanupExpired();
        if (cleaned > 0) {
          logger.info(`[TokenBlacklist] Periodic cleanup removed ${cleaned} expired tokens`);
        }
      } catch (error) {
        logger.error('[TokenBlacklist] Periodic cleanup failed:', error);
      }
    }, 30 * 60 * 1000); // Every 30 minutes

    // Prevent timer from blocking process exit
    this.cleanupTimer.unref?.();
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
    revokedBy?: string,
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

    // Persist to database first (source of truth)
    try {
      if (this.repository) {
        await this.repository.create({
          tokenHash,
          userId,
          tenantId,
          revokeReason: reason,
          revokedBy,
          expiresAt,
        });
        logger.debug(`[TokenBlacklist] Token persisted: ${tokenHash.slice(0, 16)}...`);
      }
    } catch (error) {
      logger.error('[TokenBlacklist] Failed to persist token:', error);
      // Continue - in-memory cache is still valid
    }

    // Update in-memory cache (write-through)
    this.cache.set(tokenHash, {
      id: 0, // Assigned by DB
      tokenHash,
      userId,
      tenantId,
      revokedAt: now,
      expiresAt,
      revokeReason: reason,
      revokedBy,
      metadata: {},
    });

    // Emit event
    this.emit('token:revoked', info);

    logger.info(`[TokenBlacklist] Token revoked: ${tokenHash.slice(0, 16)}... reason=${reason} user=${userId}`);
  }

  /**
   * Check if a token is revoked (read-through cache pattern)
   */
  async isRevoked(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    // Check in-memory cache first
    const cached = this.cache.get(tokenHash);
    if (cached) {
      // Check if expired (cleanup automatically)
      if (cached.expiresAt < new Date()) {
        this.cache.delete(tokenHash);
        return false;
      }
      return true;
    }

    // Cache miss - check database (read-through)
    if (this.repository) {
      try {
        const entity = await this.repository.findByHash(tokenHash);
        if (entity) {
          // Populate cache for future lookups
          this.cache.set(tokenHash, entity);
          return true;
        }
      } catch (error) {
        logger.error('[TokenBlacklist] Failed to check database:', error);
      }
    }

    return false;
  }

  /**
   * Get revoked token info
   */
  async getRevokedTokenInfo(token: string): Promise<RevokedTokenInfo | null> {
    const tokenHash = this.hashToken(token);

    // Check cache
    const cached = this.cache.get(tokenHash);
    if (cached) {
      if (cached.expiresAt < new Date()) {
        this.cache.delete(tokenHash);
        return null;
      }
      return {
        tokenHash: cached.tokenHash,
        userId: cached.userId,
        tenantId: cached.tenantId,
        revokedAt: cached.revokedAt,
        expiresAt: cached.expiresAt,
        revokeReason: cached.revokeReason,
        revokedBy: cached.revokedBy,
      };
    }

    // Check database
    if (this.repository) {
      try {
        const entity = await this.repository.findByHash(tokenHash);
        if (entity) {
          this.cache.set(tokenHash, entity);
          return {
            tokenHash: entity.tokenHash,
            userId: entity.userId,
            tenantId: entity.tenantId,
            revokedAt: entity.revokedAt,
            expiresAt: entity.expiresAt,
            revokeReason: entity.revokeReason,
            revokedBy: entity.revokedBy,
          };
        }
      } catch (error) {
        logger.error('[TokenBlacklist] Failed to get token info:', error);
      }
    }

    return null;
  }

  /**
   * Revoke all tokens for a specific user (batch revocation)
   */
  async revokeAllUserTokens(userId: string, reason: string): Promise<number> {
    const expiresAt = new Date(Date.now() + this.config.ttlSeconds * 1000);
    let count = 0;

    if (this.repository) {
      try {
        count = await this.repository.revokeAllUserTokens(userId, reason, expiresAt);
        logger.info(`[TokenBlacklist] Batch revoked ${count} tokens for user ${userId} in database`);
      } catch (error) {
        logger.error('[TokenBlacklist] Failed to batch revoke user tokens in DB:', error);
      }
    }

    // Also count in-memory tokens for this user
    const inMemoryCount = Array.from(this.cache.values()).filter(
      (e) => e.userId === userId && e.expiresAt >= new Date(),
    ).length;

    const total = count + inMemoryCount;

    this.emit('user:tokens_revoked', {
      userId,
      reason,
      revokedCount: total,
      timestamp: new Date(),
    });

    logger.info(`[TokenBlacklist] Batch revocation for user: ${userId} count=${total} reason=${reason}`);

    return total;
  }

  /**
   * Revoke all tokens for a specific tenant (tenant-wide revocation)
   */
  async revokeTenantTokens(tenantId: number, reason: string): Promise<number> {
    const expiresAt = new Date(Date.now() + this.config.ttlSeconds * 1000);
    let count = 0;

    if (this.repository) {
      try {
        count = await this.repository.revokeAllTenantTokens(tenantId, reason, expiresAt);
      } catch (error) {
        logger.error('[TokenBlacklist] Failed to batch revoke tenant tokens in DB:', error);
      }
    }

    // Also count in-memory tokens for this tenant
    const inMemoryCount = Array.from(this.cache.values()).filter(
      (e) => e.tenantId === tenantId && e.expiresAt >= new Date(),
    ).length;

    const total = count + inMemoryCount;

    this.emit('tenant:tokens_revoked', {
      tenantId,
      reason,
      revokedCount: total,
      timestamp: new Date(),
    });

    logger.info(`[TokenBlacklist] Tenant-wide revocation: tenant=${tenantId} count=${total} reason=${reason}`);

    return total;
  }

  /**
   * Get count of revoked tokens for a specific user
   */
  async getUserRevokedCount(userId: string): Promise<number> {
    if (this.repository) {
      try {
        return await this.repository.getUserRevokedCount(userId);
      } catch (error) {
        logger.error('[TokenBlacklist] Failed to get user revoked count from DB:', error);
      }
    }

    // Fallback to in-memory count
    return Array.from(this.cache.values()).filter((e) => e.userId === userId).length;
  }

  /**
   * Cleanup expired tokens from blacklist
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let cacheCleaned = 0;

    // Clean in-memory cache
    for (const [hash, entity] of this.cache.entries()) {
      if (entity.expiresAt < now) {
        this.cache.delete(hash);
        cacheCleaned++;
      }
    }

    // Clean database
    let dbCleaned = 0;
    if (this.repository) {
      try {
        dbCleaned = await this.repository.cleanupExpired();
        logger.debug(`[TokenBlacklist] Cleaned up ${dbCleaned} expired tokens from database`);
      } catch (error) {
        logger.error('[TokenBlacklist] Failed to cleanup database:', error);
      }
    }

    const totalCleaned = cacheCleaned + dbCleaned;

    this.emit('cleanup:completed', {
      cleanedCount: totalCleaned,
      memoryCleaned: cacheCleaned,
      dbCleaned,
      timestamp: now,
    });

    logger.info(`[TokenBlacklist] Cleanup completed: removed ${cacheCleaned} from memory, ${dbCleaned} from database`);

    return totalCleaned;
  }

  /**
   * Get statistics about revoked tokens
   */
  async getStats(): Promise<TokenBlacklistStats> {
    if (this.repository) {
      try {
        return await this.repository.getStats();
      } catch (error) {
        logger.error('[TokenBlacklist] Failed to get stats from DB:', error);
      }
    }

    // Fallback to in-memory stats
    const byReason: Record<string, number> = {};
    const byTenant: Record<number, number> = {};
    const byUser: Record<string, number> = {};

    for (const info of this.cache.values()) {
      byReason[info.revokeReason] = (byReason[info.revokeReason] || 0) + 1;
      byTenant[info.tenantId] = (byTenant[info.tenantId] || 0) + 1;
      byUser[info.userId] = (byUser[info.userId] || 0) + 1;
    }

    return {
      totalRevoked: this.cache.size,
      byReason,
      byTenant,
      byUser,
    };
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.cache.clear();
    this.removeAllListeners();
    logger.info('[TokenBlacklist] Service disconnected');
  }
}
