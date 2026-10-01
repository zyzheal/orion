/**
 * Token Blacklist Checker - Gateway-side token revocation checking
 *
 * Reads from the same Redis instance used by platform service's TokenBlacklistService.
 * Platform service writes revoked tokens to Redis with prefix "token:blacklist:{hash}".
 * This checker reads from Redis to reject revoked tokens at the Gateway level.
 *
 * Phase 4.1/4.2: JWT key unification + Token blacklist mechanism
 */

import crypto from 'crypto';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface RedisClient {
  get(key: string): Promise<string | null>;
  exists(key: string): Promise<number>;
}

export class TokenBlacklistChecker {
  private redisClient: RedisClient | null = null;
  private keyPrefix: string;
  // Local cache for fast repeated lookups (token hash -> boolean)
  private cache: Map<string, { revoked: boolean; checkedAt: number }> = new Map();
  private cacheTtlMs: number = 30_000; // 30 seconds local cache

  constructor(options?: { keyPrefix?: string; cacheTtlMs?: number }) {
    this.keyPrefix = options?.keyPrefix || 'token:blacklist:';
    if (options?.cacheTtlMs !== undefined) {
      this.cacheTtlMs = options.cacheTtlMs;
    }
  }

  setRedisClient(client: RedisClient): void {
    this.redisClient = client;
  }

  /**
   * Hash token with SHA256 (same algorithm as platform service TokenBlacklistService)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Check if a token has been revoked.
   *
   * Lookup order:
   * 1. Local in-memory cache (fastest, 30s TTL)
   * 2. Redis (shared with platform service, TTL-based auto-expiry)
   *
   * @returns true if the token is revoked and should be rejected
   */
  async isRevoked(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    // 1. Check local cache
    const cached = this.cache.get(tokenHash);
    if (cached && Date.now() - cached.checkedAt < this.cacheTtlMs) {
      return cached.revoked;
    }

    // 2. Check Redis
    if (this.redisClient) {
      try {
        const exists = await this.redisClient.exists(`${this.keyPrefix}${tokenHash}`);
        const revoked = exists === 1;

        // Update cache
        this.cache.set(tokenHash, { revoked, checkedAt: Date.now() });

        return revoked;
      } catch (error: any) {
        logger.warn({ err: error.message }, '[TokenBlacklistChecker] Redis check failed, allowing token');
        // On Redis failure, allow the token (fail-open for availability)
        // The platform service's DB-level check provides a second safety net
        return false;
      }
    }

    // No Redis available - allow token (development mode)
    return false;
  }

  /**
   * Clear the local cache (e.g., after bulk revocation events)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [hash, entry] of this.cache.entries()) {
      if (now - entry.checkedAt >= this.cacheTtlMs) {
        this.cache.delete(hash);
      }
    }
  }
}

export const tokenBlacklistChecker = new TokenBlacklistChecker();
