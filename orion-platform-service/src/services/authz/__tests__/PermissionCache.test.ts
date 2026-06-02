/**
 * PermissionCache Tests - Redis-backed permission decision cache
 *
 * Covers: get/set, allow-only caching, invalidation strategies,
 * stats tracking, cache key building.
 */

import { PermissionCache, PermissionCacheKey, PermissionCacheEntry } from '../PermissionCache';

// Mock CacheService
function createMockCacheService() {
  const store = new Map<string, any>();
  return {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: any, _ttl?: number) => {
      store.set(key, value);
    }),
    invalidate: jest.fn(async (pattern: string) => {
      // Simple glob match: perm:* matches everything starting with perm:
      const prefix = pattern.replace(/\*/g, '');
      for (const key of Array.from(store.keys())) {
        if (key.startsWith(prefix)) {
          store.delete(key);
        }
      }
    }),
    _store: store,
  };
}

function makeCacheKey(overrides: Partial<PermissionCacheKey> = {}): PermissionCacheKey {
  return {
    userId: 'user-1',
    resourceType: 'pipeline',
    action: 'read',
    ...overrides,
  };
}

function makeAllowEntry(overrides: Partial<PermissionCacheEntry> = {}): PermissionCacheEntry {
  return {
    allowed: true,
    reason: 'RBAC check passed',
    source: 'rbac',
    cachedAt: Date.now(),
    ...overrides,
  };
}

function makeDenyEntry(): PermissionCacheEntry {
  return {
    allowed: false,
    reason: 'Insufficient permissions',
    source: 'rbac',
    cachedAt: Date.now(),
  };
}

describe('PermissionCache', () => {
  let mockCache: ReturnType<typeof createMockCacheService>;
  let cache: PermissionCache;

  beforeEach(() => {
    mockCache = createMockCacheService();
    cache = new PermissionCache(mockCache as any);
  });

  // ==================== get ====================

  describe('get', () => {
    it('should return cached entry on cache hit', async () => {
      const entry = makeAllowEntry();
      mockCache._store.set('perm:default:user-1:pipeline:read', entry);

      const result = await cache.get(makeCacheKey());

      expect(result).toEqual(entry);
    });

    it('should return null on cache miss', async () => {
      const result = await cache.get(makeCacheKey({ userId: 'user-missing' }));

      expect(result).toBeNull();
    });

    it('should increment hits counter on hit', async () => {
      mockCache._store.set('perm:default:user-1:pipeline:read', makeAllowEntry());

      await cache.get(makeCacheKey());

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
    });

    it('should increment misses counter on miss', async () => {
      await cache.get(makeCacheKey());

      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should build correct cache key with tenantId', async () => {
      await cache.get(makeCacheKey({ tenantId: 'tenant-abc' }));

      expect(mockCache.get).toHaveBeenCalledWith('perm:tenant-abc:user-1:pipeline:read');
    });

    it('should use default tenant when tenantId is not provided', async () => {
      await cache.get(makeCacheKey());

      expect(mockCache.get).toHaveBeenCalledWith('perm:default:user-1:pipeline:read');
    });
  });

  // ==================== set ====================

  describe('set', () => {
    it('should cache allow decisions', async () => {
      const entry = makeAllowEntry();

      await cache.set(makeCacheKey(), entry);

      expect(mockCache.set).toHaveBeenCalledWith(
        'perm:default:user-1:pipeline:read',
        entry,
        300, // default TTL
      );
    });

    it('should NOT cache deny decisions', async () => {
      const entry = makeDenyEntry();

      await cache.set(makeCacheKey(), entry);

      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should increment sets counter for allow entries', async () => {
      await cache.set(makeCacheKey(), makeAllowEntry());

      const stats = cache.getStats();
      expect(stats.sets).toBe(1);
    });

    it('should NOT increment sets counter for deny entries', async () => {
      await cache.set(makeCacheKey(), makeDenyEntry());

      const stats = cache.getStats();
      expect(stats.sets).toBe(0);
    });

    it('should use custom TTL when provided', async () => {
      const customCache = new PermissionCache(mockCache as any, 600);

      await customCache.set(makeCacheKey(), makeAllowEntry());

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        600,
      );
    });

    it('should build correct cache key with tenantId', async () => {
      await cache.set(makeCacheKey({ tenantId: 'tenant-xyz' }), makeAllowEntry());

      expect(mockCache.set).toHaveBeenCalledWith(
        'perm:tenant-xyz:user-1:pipeline:read',
        expect.any(Object),
        expect.any(Number),
      );
    });
  });

  // ==================== invalidateUser ====================

  describe('invalidateUser', () => {
    it('should invalidate all cache entries for a user', async () => {
      await cache.invalidateUser('user-1');

      expect(mockCache.invalidate).toHaveBeenCalledWith('perm:*:user-1:*');
    });

    it('should invalidate with specific tenantId', async () => {
      await cache.invalidateUser('user-1', 'tenant-abc');

      expect(mockCache.invalidate).toHaveBeenCalledWith('perm:tenant-abc:user-1:*');
    });

    it('should increment invalidations counter', async () => {
      await cache.invalidateUser('user-1');

      const stats = cache.getStats();
      expect(stats.invalidations).toBe(1);
    });
  });

  // ==================== invalidateTenant ====================

  describe('invalidateTenant', () => {
    it('should invalidate all cache entries for a tenant', async () => {
      await cache.invalidateTenant('tenant-1');

      expect(mockCache.invalidate).toHaveBeenCalledWith('perm:tenant-1:*');
    });

    it('should increment invalidations counter', async () => {
      await cache.invalidateTenant('tenant-1');

      const stats = cache.getStats();
      expect(stats.invalidations).toBe(1);
    });
  });

  // ==================== invalidateAll ====================

  describe('invalidateAll', () => {
    it('should invalidate all permission cache entries', async () => {
      await cache.invalidateAll();

      expect(mockCache.invalidate).toHaveBeenCalledWith('perm:*');
    });

    it('should increment invalidations counter', async () => {
      await cache.invalidateAll();

      const stats = cache.getStats();
      expect(stats.invalidations).toBe(1);
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return initial stats with all zeros', () => {
      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.invalidations).toBe(0);
    });

    it('should calculate hitRate correctly', async () => {
      // 1 hit + 1 miss = 50% hit rate
      mockCache._store.set('perm:default:user-1:pipeline:read', makeAllowEntry());
      await cache.get(makeCacheKey());
      await cache.get(makeCacheKey({ userId: 'user-2' }));

      const stats = cache.getStats() as any;
      expect(stats.hitRate).toBeCloseTo(0.5);
    });

    it('should return hitRate 0 when no requests made', () => {
      const stats = cache.getStats() as any;
      expect(stats.hitRate).toBe(0);
    });

    it('should track multiple operations', async () => {
      // 2 gets (1 hit, 1 miss), 1 set, 1 invalidation
      mockCache._store.set('perm:default:user-1:pipeline:read', makeAllowEntry());
      await cache.get(makeCacheKey());
      await cache.get(makeCacheKey({ userId: 'user-2' }));
      await cache.set(makeCacheKey({ userId: 'user-3' }), makeAllowEntry());
      await cache.invalidateUser('user-1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.invalidations).toBe(1);
    });
  });

  // ==================== resetStats ====================

  describe('resetStats', () => {
    it('should reset all stats to zero', async () => {
      mockCache._store.set('perm:default:user-1:pipeline:read', makeAllowEntry());
      await cache.get(makeCacheKey());
      await cache.set(makeCacheKey(), makeAllowEntry());
      await cache.invalidateUser('user-1');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.invalidations).toBe(0);
    });
  });

  // ==================== constructor ====================

  describe('constructor', () => {
    it('should use default TTL of 300 seconds', async () => {
      await cache.set(makeCacheKey(), makeAllowEntry());

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        300,
      );
    });

    it('should accept custom TTL', async () => {
      const customCache = new PermissionCache(mockCache as any, 120);

      await customCache.set(makeCacheKey(), makeAllowEntry());

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        120,
      );
    });

    it('should handle null cache gracefully', async () => {
      const nullCache = new PermissionCache(null);

      // Should not throw
      await expect(nullCache.get(makeCacheKey())).resolves.toBeNull();
      await expect(nullCache.set(makeCacheKey(), makeAllowEntry())).resolves.toBeUndefined();
    });
  });

  // ==================== Cache key format ====================

  describe('cache key format', () => {
    it('should produce key format: perm:{tenant}:{userId}:{resourceType}:{action}', async () => {
      await cache.get(makeCacheKey({
        userId: 'u-123',
        resourceType: 'deployment',
        action: 'execute',
        tenantId: 't-456',
      }));

      expect(mockCache.get).toHaveBeenCalledWith('perm:t-456:u-123:deployment:execute');
    });

    it('should use "default" as tenant when tenantId is undefined', async () => {
      await cache.get(makeCacheKey({ userId: 'u-1' }));

      expect(mockCache.get).toHaveBeenCalledWith('perm:default:u-1:pipeline:read');
    });
  });
});
