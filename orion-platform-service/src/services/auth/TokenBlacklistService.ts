// orion-platform-service/src/services/auth/TokenBlacklistService.ts
/**
 * TokenBlacklistService — Revoked JWT token management
 *
 * Storage tiering:
 *   Layer 1: Redis (distributed, TTL-based, fastest) — optional
 *   Layer 2: PostgreSQL (token_blacklist table via BlacklistedTokenRepository) — persistent
 *   Layer 3: In-memory Map (local read-through / write-through fallback)
 *
 * On DB failure, silently falls back to in-memory Map as transient storage.
 * Maintains EventEmitter for backward-compatible event consumers (auth-enhanced-routes, tests).
 */
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import { DatabasePool } from '../database';
import {
  BlacklistedTokenRepository,
  BlacklistedTokenEntity,
} from '../../repositories/BlacklistedTokenRepository';
import { FallbackStorageService } from '../fallback/FallbackStorageService';
import { FallbackStorageRepository } from '../../repositories/FallbackStorageRepository';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('TokenBlacklistService');

// ---------------------------------------------------------------------------
// Redis client type definition (ioredis) — optional dependency
// ---------------------------------------------------------------------------
interface RedisClient {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<string>;
  del(key: string): Promise<number>;
  quit?(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Public interfaces — these contract must not change
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

/**
 * TokenBlacklistService manages revoked JWT tokens across three storage tiers.
 *
 * All public methods are resilient: if PostgreSQL fails they silently fall
 * back to the local in-memory Map.  Redis is purely an optimisation layer.
 */
export class TokenBlacklistService extends EventEmitter {
  private config: TokenBlacklistConfig;
  private repository: BlacklistedTokenRepository | null;
  private dbPool: DatabasePool | null;
  private redisClient: RedisClient | null = null;
  private cache: Map<string, BlacklistedTokenEntity> = new Map();

  // --- persistence layers -------------------------------------------------
  // Tier 1: Redis (distributed, TTL-based) — optional
  // Tier 2: PostgreSQL via BlacklistedTokenRepository (source-of-truth)
  // Tier 3: FallbackStorageService (local read-through / write-through fallback)
  private fallbackStore!: FallbackStorageService;
  private dbDown = false;    // global DB-down sentinel

  // Periodic cleanup timer
  private cleanupTimer: NodeJS.Timeout | null = null;
  // Redis connection state
  private redisConnected = false;

  constructor(dbPool: DatabasePool | null, config: Partial<TokenBlacklistConfig> = {}, fallbackStore?: FallbackStorageService) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dbPool = dbPool;
    this.repository = dbPool ? new BlacklistedTokenRepository(dbPool) : null;

    // FallbackStorageService for unified cache/persistence layer
    if (fallbackStore) {
      this.fallbackStore = fallbackStore;
    } else {
      this.fallbackStore = new FallbackStorageService({
        prefix: 'token:blacklist',
        maxSize: 5000,
        ttlMs: this.config.ttlSeconds * 1000,
        persistToDb: false,
        tenantId: '0',
      });
    }

    this.connectRedis();
  }

  // -----------------------------------------------------------------------
  // Redis — optional distributed cache
  // -----------------------------------------------------------------------

  /** Connect to Redis (optional, for distributed token revocation). */
  private connectRedis(): void {
    const redisUrl = process.env.REDIS_URL || this.config.redisUrl;
    if (!redisUrl) {
      logger.info('[TokenBlacklist] Redis not configured, using DB + memory cache');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require('ioredis');
      this.redisClient = new Redis(redisUrl);

      (this.redisClient as any).on('connect', () => {
        logger.info('[TokenBlacklist] Connected to Redis');
        this.redisConnected = true;
      });

      (this.redisClient as any).on('error', (err: Error) => {
        logger.warn({ err, traceId: getCurrentTraceId() }, '[TokenBlacklist] Redis connection error');
        this.redisConnected = false;
      });

      (this.redisClient as any).on('disconnect', () => {
        logger.info('[TokenBlacklist] Redis disconnected');
        this.redisConnected = false;
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn({ err, traceId: getCurrentTraceId() }, '[TokenBlacklist] Failed to connect to Redis');
    }
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async connect(): Promise<void> {
    logger.info('[TokenBlacklist] Service connected');

    // Start FallbackStorageService with optional repository
    const repo = this.dbPool ? new FallbackStorageRepository(this.dbPool) : null;
    this.fallbackStore.start(repo);
    await this.fallbackStore.loadFromDb();

    await this.warmCache();
    this.startPeriodicCleanup();
  }

  async disconnect(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    await this.fallbackStore.clear();
    this.dbDown = false;
    this.removeAllListeners();

    if (this.redisConnected && this.redisClient) {
      try {
        await (this.redisClient as any).quit?.();
        logger.info('[TokenBlacklist] Redis connection closed');
      } catch { /* ignore */ }
    }
    this.redisConnected = false;
  }

  // -----------------------------------------------------------------------
  // Cache warming & periodic cleanup
  // -----------------------------------------------------------------------

  /** Warm local cache from FallbackStorageService on startup. */
  private async warmCache(): Promise<void> {
    if (!this.repository && !this.fallbackStore) {
      logger.warn('[TokenBlacklist] No DB connection, cache warm skipped');
      return;
    }

    try {
      const stats = await this.fallbackStore.getStats();
      const totalRevoked = (stats as any).liveEntries || 0;
      logger.info({ totalRevoked, traceId: getCurrentTraceId() }, '[TokenBlacklist] Cache warmed');
      this.dbDown = false;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ err, traceId: getCurrentTraceId() }, '[TokenBlacklist] Failed to warm cache from storage, falling back to memory');
      this.dbDown = true;
    }
  }

  /** Start periodic cleanup of expired tokens (every 30 minutes). */
  private startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        const cleaned = await this.cleanupExpired();
        if (cleaned > 0) {
          logger.info({ cleaned, traceId: getCurrentTraceId() }, '[TokenBlacklist] Periodic cleanup removed expired tokens');
        }
      } catch (error) {
        logger.error('[TokenBlacklist] Periodic cleanup failed', error);
      }
    }, 30 * 60 * 1000);

    this.cleanupTimer.unref?.();
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** SHA-256 token hash (64-char hex). */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Attempt to persist to DB; sets dbDown on failure. */
  private async persistToDB(entity: BlacklistedTokenEntity): Promise<void> {
    if (this.dbDown || !this.repository) return;
    try {
      await this.repository.create({
        tokenHash: entity.tokenHash,
        userId: entity.userId,
        tenantId: entity.tenantId,
        revokeReason: entity.revokeReason,
        revokedBy: entity.revokedBy,
        expiresAt: entity.expiresAt,
      });
    } catch (error) {
      this.dbDown = true;
      logger.error('[TokenBlacklist] DB write failed, switching to memory-only', error);
    }
  }

  /**
   * Lookup by token hash in DB, updating local cache on hit.
   * Returns undefined if DB is down or not found.
   */
  private async lookupInDB(tokenHash: string): Promise<BlacklistedTokenEntity | undefined> {
    if (this.dbDown || !this.repository) return undefined;
    try {
      const entity = await this.repository.findByHash(tokenHash);
      if (entity) {
        this.cache.set(tokenHash, entity);
      }
      return entity;
    } catch (error) {
      this.dbDown = true;
      logger.error('[TokenBlacklist] DB read failed, switching to memory-only', error);
      return undefined;
    }
  }

  // -----------------------------------------------------------------------
  // Core API — token lifecycle
  // -----------------------------------------------------------------------

  /**
   * Revoke a token. Writes to all three tiers:
   * Redis (distributed) -> PostgreSQL (source-of-truth) -> in-memory (local).
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

    const entity: BlacklistedTokenEntity = {
      id: 0, // assigned by DB
      tokenHash,
      userId,
      tenantId,
      revokedAt: now,
      expiresAt,
      revokeReason: reason,
      revokedBy,
      metadata: {},
    };

    // Tier 1: Redis (fast, distributed, TTL-based)
    if (this.redisConnected && this.redisClient) {
      try {
        const ttl = Math.max(0, Math.floor(expiresAt.getTime() / 1000) - Math.floor(Date.now() / 1000));
        if (ttl > 0) {
          await this.redisClient.setex(`${this.config.keyPrefix}${tokenHash}`, ttl, '1');
        }
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.warn({ err, traceId: getCurrentTraceId() }, '[TokenBlacklist] Redis write failed, continuing to DB');
      }
    }

    // Tier 2: PostgreSQL (source-of-truth)
    await this.persistToDB(entity);

    // Tier 3: in-memory (write-through — always succeeds locally)
    this.cache.set(tokenHash, entity);

    // Emit event for backward-compatible consumers
    this.emit('token:revoked', info);

    logger.debug({ tokenHashPrefix: tokenHash.slice(0, 16), reason, userId, traceId: getCurrentTraceId() }, '[TokenBlacklist] Token revoked');
  }

  /**
   * Check if a token is revoked.
   * Three-tier lookup: Redis -> DB (read-through) -> in-memory cache.
   */
  async isRevoked(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    // Tier 1: Redis
    if (this.redisConnected && this.redisClient) {
      try {
        const hit = await this.redisClient.get(`${this.config.keyPrefix}${tokenHash}`);
        if (hit) return true;
      } catch { /* ignore, fall through */ }
    }

    // Tier 2: DB (read-through — populates cache on hit)
    const dbEntity = await this.lookupInDB(tokenHash);
    if (dbEntity && dbEntity.expiresAt >= new Date()) {
      return true;
    }
    if (dbEntity && dbEntity.expiresAt < new Date()) {
      this.cache.delete(tokenHash);
    }

    // Tier 3: in-memory cache
    const cached = this.cache.get(tokenHash);
    if (cached) {
      if (cached.expiresAt < new Date()) {
        this.cache.delete(tokenHash);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Get detailed info about a revoked token.
   * Returns null if token is not found or expired.
   */
  async getRevokedTokenInfo(token: string): Promise<RevokedTokenInfo | null> {
    const tokenHash = this.hashToken(token);

    // Tier 1: in-memory cache first (fastest local lookup)
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

    // Tier 2: DB (read-through — populates cache on hit)
    const dbEntity = await this.lookupInDB(tokenHash);
    if (dbEntity && dbEntity.expiresAt >= new Date()) {
      return {
        tokenHash: dbEntity.tokenHash,
        userId: dbEntity.userId,
        tenantId: dbEntity.tenantId,
        revokedAt: dbEntity.revokedAt,
        expiresAt: dbEntity.expiresAt,
        revokeReason: dbEntity.revokeReason,
        revokedBy: dbEntity.revokedBy,
      };
    }
    if (dbEntity && dbEntity.expiresAt < new Date()) {
      this.cache.delete(tokenHash);
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // Batch revocation
  // -----------------------------------------------------------------------

  /** Revoke all tokens for a specific user. Falls back to cache on DB failure. */
  async revokeAllUserTokens(userId: string, reason: string): Promise<number> {
    let dbCount = 0;

    if (!this.dbDown && this.repository) {
      try {
        const expiresAt = new Date(Date.now() + this.config.ttlSeconds * 1000);
        dbCount = await this.repository.revokeAllUserTokens(userId, reason, expiresAt);
      } catch (error) {
        this.dbDown = true;
        logger.error('[TokenBlacklist] DB batch revoke user failed', error);
      }
    }

    // Also count in-memory tokens for this user
    const now = new Date();
    const inMemoryCount = Array.from(this.cache.values()).filter(
      (e) => e.userId === userId && e.expiresAt >= now,
    ).length;

    const total = dbCount + inMemoryCount;

    this.emit('user:tokens_revoked', { userId, reason, revokedCount: total, timestamp: now });
    logger.info({ userId, count: total, reason, traceId: getCurrentTraceId() }, '[TokenBlacklist] Batch revoked user tokens');

    return total;
  }

  /** Revoke all tokens for a specific tenant. */
  async revokeTenantTokens(tenantId: number, reason: string): Promise<number> {
    let dbCount = 0;

    if (!this.dbDown && this.repository) {
      try {
        const expiresAt = new Date(Date.now() + this.config.ttlSeconds * 1000);
        dbCount = await this.repository.revokeAllTenantTokens(tenantId, reason, expiresAt);
      } catch (error) {
        this.dbDown = true;
        logger.error('[TokenBlacklist] DB batch revoke tenant failed', error);
      }
    }

    const now = new Date();
    const inMemoryCount = Array.from(this.cache.values()).filter(
      (e) => e.tenantId === tenantId && e.expiresAt >= now,
    ).length;

    const total = dbCount + inMemoryCount;

    this.emit('tenant:tokens_revoked', { tenantId, reason, revokedCount: total, timestamp: now });
    logger.info({ tenantId, count: total, reason, traceId: getCurrentTraceId() }, '[TokenBlacklist] Tenant-wide revocation');

    return total;
  }

  // -----------------------------------------------------------------------
  // Query helpers
  // -----------------------------------------------------------------------

  /** Count of revoked tokens for a user. Falls back to in-memory count. */
  async getUserRevokedCount(userId: string): Promise<number> {
    if (!this.dbDown && this.repository) {
      try {
        return await this.repository.getUserRevokedCount(userId);
      } catch (error) {
        this.dbDown = true;
        logger.error('[TokenBlacklist] DB getUserRevokedCount failed', error);
      }
    }
    // Fallback to in-memory
    return Array.from(this.cache.values()).filter((e) => e.userId === userId).length;
  }

  /**
   * Remove expired tokens from all tiers.
   * Returns total count cleaned (memory + DB combined).
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let cacheCleaned = 0;

    // Clean in-memory
    for (const [hash, entity] of this.cache.entries()) {
      if (entity.expiresAt < now) {
        this.cache.delete(hash);
        cacheCleaned++;
      }
    }

    // Clean PostgreSQL
    let dbCleaned = 0;
    if (!this.dbDown && this.repository) {
      try {
        dbCleaned = await this.repository.cleanupExpired();
      } catch (error) {
        this.dbDown = true;
        logger.error('[TokenBlacklist] DB cleanup failed', error);
      }
    }

    const total = cacheCleaned + dbCleaned;
    this.emit('cleanup:completed', { cleanedCount: total, memoryCleaned: cacheCleaned, dbCleaned, timestamp: now });
    logger.info({ cacheCleaned, dbCleaned, traceId: getCurrentTraceId() }, '[TokenBlacklist] Cleanup completed');

    return total;
  }

  /**
   * Comprehensive statistics. Falls back to in-memory stats on DB failure.
   */
  async getStats(): Promise<TokenBlacklistStats> {
    if (!this.dbDown && this.repository) {
      try {
        const repoStats = await this.repository.getStats();
        return {
          totalRevoked: repoStats.totalRevoked,
          byReason: repoStats.byReason,
          byTenant: repoStats.byTenant,
          byUser: repoStats.byUser,
        };
      } catch (error) {
        this.dbDown = true;
        logger.error('[TokenBlacklist] DB getStats failed', error);
      }
    }

    // Fallback to in-memory stats
    const byReason: Record<string, number> = {};
    const byTenant: Record<number, number> = {};
    const byUser: Record<string, number> = {};
    const now = new Date();

    for (const entity of this.cache.values()) {
      if (entity.expiresAt < now) continue;
      byReason[entity.revokeReason] = (byReason[entity.revokeReason] || 0) + 1;
      byTenant[entity.tenantId] = (byTenant[entity.tenantId] || 0) + 1;
      byUser[entity.userId] = (byUser[entity.userId] || 0) + 1;
    }

    return {
      totalRevoked: this.cache.size,
      byReason,
      byTenant,
      byUser,
    };
  }
}
