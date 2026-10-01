/**
 * TokenBlacklistChecker tests
 *
 * Phase 4.1/4.2: JWT key unification + Token blacklist mechanism
 */

import crypto from 'crypto';
import { TokenBlacklistChecker } from '../token-blacklist-checker';

// Mock Redis client
function createMockRedis(existingKeys: Set<string> = new Set()) {
  return {
    get: jest.fn(async (key: string) => existingKeys.has(key) ? '1' : null),
    exists: jest.fn(async (key: string) => existingKeys.has(key) ? 1 : 0),
  };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

describe('TokenBlacklistChecker', () => {
  describe('isRevoked', () => {
    it('returns false when no Redis client is set', async () => {
      const checker = new TokenBlacklistChecker();
      const result = await checker.isRevoked('some-token');
      expect(result).toBe(false);
    });

    it('returns false for non-revoked token', async () => {
      const checker = new TokenBlacklistChecker();
      const redis = createMockRedis();
      checker.setRedisClient(redis);

      const result = await checker.isRevoked('valid-token');
      expect(result).toBe(false);
      expect(redis.exists).toHaveBeenCalledWith(`token:blacklist:${hashToken('valid-token')}`);
    });

    it('returns true for revoked token in Redis', async () => {
      const token = 'revoked-token';
      const hash = hashToken(token);
      const redisKeys = new Set([`token:blacklist:${hash}`]);

      const checker = new TokenBlacklistChecker();
      const redis = createMockRedis(redisKeys);
      checker.setRedisClient(redis);

      const result = await checker.isRevoked(token);
      expect(result).toBe(true);
    });

    it('uses local cache on repeated lookups', async () => {
      const token = 'cached-token';
      const hash = hashToken(token);
      const redisKeys = new Set([`token:blacklist:${hash}`]);

      const checker = new TokenBlacklistChecker({ cacheTtlMs: 60000 });
      const redis = createMockRedis(redisKeys);
      checker.setRedisClient(redis);

      // First call hits Redis
      await checker.isRevoked(token);
      expect(redis.exists).toHaveBeenCalledTimes(1);

      // Second call uses cache
      const result = await checker.isRevoked(token);
      expect(result).toBe(true);
      expect(redis.exists).toHaveBeenCalledTimes(1); // Still 1
    });

    it('falls back to allow on Redis failure (fail-open)', async () => {
      const checker = new TokenBlacklistChecker();
      const redis = {
        get: jest.fn(async () => { throw new Error('Redis down'); }),
        exists: jest.fn(async () => { throw new Error('Redis down'); }),
      };
      checker.setRedisClient(redis);

      const result = await checker.isRevoked('any-token');
      expect(result).toBe(false);
    });

    it('uses custom key prefix', async () => {
      const checker = new TokenBlacklistChecker({ keyPrefix: 'custom:prefix:' });
      const redis = createMockRedis();
      checker.setRedisClient(redis);

      await checker.isRevoked('test-token');
      expect(redis.exists).toHaveBeenCalledWith(`custom:prefix:${hashToken('test-token')}`);
    });
  });

  describe('clearCache', () => {
    it('clears the local cache', async () => {
      const token = 'test-token';
      const hash = hashToken(token);
      const redisKeys = new Set([`token:blacklist:${hash}`]);

      const checker = new TokenBlacklistChecker({ cacheTtlMs: 60000 });
      const redis = createMockRedis(redisKeys);
      checker.setRedisClient(redis);

      // Populate cache
      await checker.isRevoked(token);
      expect(redis.exists).toHaveBeenCalledTimes(1);

      // Clear cache
      checker.clearCache();

      // Next call should hit Redis again
      await checker.isRevoked(token);
      expect(redis.exists).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanupCache', () => {
    it('removes expired cache entries', async () => {
      const checker = new TokenBlacklistChecker({ cacheTtlMs: 1 }); // 1ms TTL
      const redis = createMockRedis();
      checker.setRedisClient(redis);

      await checker.isRevoked('token1');
      expect(redis.exists).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      checker.cleanupCache();

      // Next call should hit Redis again
      await checker.isRevoked('token1');
      expect(redis.exists).toHaveBeenCalledTimes(2);
    });
  });
});
