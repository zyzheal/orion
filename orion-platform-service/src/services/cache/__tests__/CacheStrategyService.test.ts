/**
 * CacheStrategyService Tests - Multi-level cache (L1 InMemory + L2 Redis)
 *
 * F011: Multi-level cache read/write/delete strategy
 * F012: Cache protection (penetration, breakdown, avalanche)
 * F013: Cache warmup and invalidation
 */

import { CacheStrategyService } from '../CacheStrategyService';
import { InMemoryCache } from '../InMemoryCache';
import { CacheService } from '../CacheService';
import { RedisCache } from '../../redis-cache';

// Mock CacheService (L2)
jest.mock('../CacheService');

describe('CacheStrategyService', () => {
  let service: CacheStrategyService;
  let mockRedis: jest.Mocked<RedisCache>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      isHealthy: jest.fn().mockReturnValue(true),
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      getClient: jest.fn(),
    } as unknown as jest.Mocked<RedisCache>;

    // Mock CacheService methods
    (CacheService as jest.MockedClass<typeof CacheService>).prototype.get = jest.fn();
    (CacheService as jest.MockedClass<typeof CacheService>).prototype.set = jest.fn();
    (CacheService as jest.MockedClass<typeof CacheService>).prototype.del = jest.fn();
    (CacheService as jest.MockedClass<typeof CacheService>).prototype.getOrLoad = jest.fn();

    service = new CacheStrategyService(mockRedis);
  });

  describe('constructor', () => {
    it('should create with default options when no options given', () => {
      const svc = new CacheStrategyService();
      expect(svc.getL1Cache()).toBeInstanceOf(InMemoryCache);
      expect(svc.getL2Cache()).toBeNull();
    });

    it('should create with Redis as L2', () => {
      const svc = new CacheStrategyService(mockRedis);
      expect(svc.getL2Cache()).not.toBeNull();
    });

    it('should accept custom options', () => {
      const svc = new CacheStrategyService(mockRedis, {
        l1MaxEntries: 500,
        l1TtlMs: 10000,
        l2TtlMs: 60000,
        enablePenetrationProtection: false,
        enableBreakdownProtection: false,
        enableAvalancheProtection: false,
      });
      expect(svc.getL1Cache()).toBeInstanceOf(InMemoryCache);
    });
  });

  describe('get (L1 -> L2)', () => {
    it('should return value from L1 when available', async () => {
      service.getL1Cache().set('key1', 'l1-value', 10000);

      const result = await service.get<string>('key1');

      expect(result).toBe('l1-value');
    });

    it('should return value from L2 when L1 miss', async () => {
      (CacheService.prototype.get as jest.Mock).mockResolvedValue('l2-value');

      const result = await service.get<string>('key1');

      expect(result).toBe('l2-value');
      expect(CacheService.prototype.get).toHaveBeenCalledWith('key1');
    });

    it('should return undefined when both L1 and L2 miss', async () => {
      (CacheService.prototype.get as jest.Mock).mockResolvedValue(null);

      const result = await service.get<string>('missing');

      expect(result).toBeUndefined();
    });

    it('should populate L1 from L2 on L2 hit', async () => {
      (CacheService.prototype.get as jest.Mock).mockResolvedValue('l2-value');

      await service.get<string>('key1');

      // Now L1 should have it
      const l1Value = service.getL1Cache().get<string>('key1');
      expect(l1Value).toBe('l2-value');
    });

    it('should work without L2 (no Redis)', async () => {
      const noL2Service = new CacheStrategyService();

      const result = await noL2Service.get<string>('key1');

      expect(result).toBeUndefined();
    });
  });

  describe('getOrLoad (L1 -> L2 -> DB)', () => {
    it('should return from L1 without calling loader', async () => {
      service.getL1Cache().set('key1', 'cached', 10000);
      const loader = jest.fn().mockResolvedValue('from-db');

      const result = await service.getOrLoad('key1', loader);

      expect(result).toBe('cached');
      expect(loader).not.toHaveBeenCalled();
    });

    it('should return from L2 without calling loader', async () => {
      (CacheService.prototype.get as jest.Mock).mockResolvedValue('l2-data');
      const loader = jest.fn().mockResolvedValue('from-db');

      const result = await service.getOrLoad('key1', loader);

      expect(result).toBe('l2-data');
      expect(loader).not.toHaveBeenCalled();
    });

    it('should call loader on cache miss and populate both caches', async () => {
      (CacheService.prototype.get as jest.Mock).mockResolvedValue(null);
      (CacheService.prototype.set as jest.Mock).mockResolvedValue(undefined);
      const loader = jest.fn().mockResolvedValue('from-db');

      const result = await service.getOrLoad('key1', loader);

      expect(result).toBe('from-db');
      expect(loader).toHaveBeenCalledTimes(1);
      expect(CacheService.prototype.set).toHaveBeenCalled();
      // L1 should be populated
      expect(service.getL1Cache().get('key1')).toBe('from-db');
    });

    it('should pass ttlMs to set operations', async () => {
      (CacheService.prototype.get as jest.Mock).mockResolvedValue(null);
      (CacheService.prototype.set as jest.Mock).mockResolvedValue(undefined);
      const loader = jest.fn().mockResolvedValue('data');

      await service.getOrLoad('key1', loader, 5000);

      expect(CacheService.prototype.set).toHaveBeenCalledWith('key1', 'data', 5);
    });
  });

  describe('set (write-through)', () => {
    it('should set in both L1 and L2', async () => {
      (CacheService.prototype.set as jest.Mock).mockResolvedValue(undefined);

      await service.set('key1', 'value1');

      expect(service.getL1Cache().get('key1')).toBe('value1');
      expect(CacheService.prototype.set).toHaveBeenCalledWith('key1', 'value1', undefined);
    });

    it('should convert ttlMs to seconds for L2', async () => {
      (CacheService.prototype.set as jest.Mock).mockResolvedValue(undefined);

      await service.set('key1', 'value1', 10000);

      expect(CacheService.prototype.set).toHaveBeenCalledWith('key1', 'value1', 10);
    });

    it('should work without L2', async () => {
      const noL2Service = new CacheStrategyService();

      await noL2Service.set('key1', 'value1');

      expect(noL2Service.getL1Cache().get('key1')).toBe('value1');
    });
  });

  describe('delete (invalidate both)', () => {
    it('should delete from both L1 and L2', async () => {
      service.getL1Cache().set('key1', 'value', 10000);
      (CacheService.prototype.del as jest.Mock).mockResolvedValue(undefined);

      await service.delete('key1');

      expect(service.getL1Cache().get('key1')).toBeUndefined();
      expect(CacheService.prototype.del).toHaveBeenCalledWith('key1');
    });

    it('should work without L2', async () => {
      const noL2Service = new CacheStrategyService();
      noL2Service.getL1Cache().set('key1', 'value', 10000);

      await noL2Service.delete('key1');

      expect(noL2Service.getL1Cache().get('key1')).toBeUndefined();
    });
  });

  describe('deleteByPattern', () => {
    it('should delete matching entries from L1', () => {
      service.getL1Cache().set('user:1', { id: 1 }, 10000);
      service.getL1Cache().set('user:2', { id: 2 }, 10000);
      service.getL1Cache().set('config:main', {}, 10000);

      const deleted = service.deleteByPattern('user:*');

      expect(deleted).toBe(2);
      expect(service.getL1Cache().get('user:1')).toBeUndefined();
      expect(service.getL1Cache().get('config:main')).toBeDefined();
    });
  });

  describe('warmup', () => {
    it('should populate cache with entries', async () => {
      (CacheService.prototype.set as jest.Mock).mockResolvedValue(undefined);

      await service.warmup([
        { key: 'a', value: 1 },
        { key: 'b', value: 2, ttlMs: 5000 },
      ]);

      expect(service.getL1Cache().get('a')).toBe(1);
      expect(service.getL1Cache().get('b')).toBe(2);
      expect(CacheService.prototype.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('warmupWithLoader', () => {
    it('should load and cache values for given keys', async () => {
      (CacheService.prototype.set as jest.Mock).mockResolvedValue(undefined);
      const loader = jest.fn().mockImplementation(async (key: string) => `data-${key}`);

      await service.warmupWithLoader(['k1', 'k2', 'k3'], loader);

      expect(loader).toHaveBeenCalledTimes(3);
      expect(service.getL1Cache().get('k1')).toBe('data-k1');
      expect(service.getL1Cache().get('k2')).toBe('data-k2');
      expect(service.getL1Cache().get('k3')).toBe('data-k3');
    });

    it('should skip failed loads without blocking others', async () => {
      (CacheService.prototype.set as jest.Mock).mockResolvedValue(undefined);
      const loader = jest.fn().mockImplementation(async (key: string) => {
        if (key === 'fail') throw new Error('load error');
        return `data-${key}`;
      });

      await service.warmupWithLoader(['ok1', 'fail', 'ok2'], loader);

      expect(service.getL1Cache().get('ok1')).toBe('data-ok1');
      expect(service.getL1Cache().get('ok2')).toBe('data-ok2');
      expect(service.getL1Cache().get('fail')).toBeUndefined();
    });
  });

  describe('invalidateKeys', () => {
    it('should delete multiple keys from both L1 and L2', async () => {
      service.getL1Cache().set('k1', 'v1', 10000);
      service.getL1Cache().set('k2', 'v2', 10000);
      (CacheService.prototype.del as jest.Mock).mockResolvedValue(undefined);

      await service.invalidateKeys(['k1', 'k2']);

      expect(service.getL1Cache().get('k1')).toBeUndefined();
      expect(service.getL1Cache().get('k2')).toBeUndefined();
      expect(CacheService.prototype.del).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateByPattern', () => {
    it('should delete matching entries from L1', async () => {
      service.getL1Cache().set('cache:a', 1, 10000);
      service.getL1Cache().set('cache:b', 2, 10000);
      service.getL1Cache().set('other:c', 3, 10000);

      await service.invalidateByPattern('cache:*');

      expect(service.getL1Cache().get('cache:a')).toBeUndefined();
      expect(service.getL1Cache().get('other:c')).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      service.getL1Cache().set('key1', 'value', 10000);
      service.getL1Cache().get('key1'); // hit
      service.getL1Cache().get('missing'); // miss

      const stats = service.getStats();

      expect(stats.l1).toBeDefined();
      expect(stats.l1.size).toBe(1);
      expect(stats.l1.hits).toBe(1);
      expect(stats.l1.misses).toBe(1);
      expect(stats.l1.hitRate).toBe(0.5);
      expect(stats.l2).toBeDefined();
      expect(stats.combined).toBeDefined();
      expect(stats.protection).toBeDefined();
      expect(stats.protection.penetrationBlocks).toBe(0);
      expect(stats.protection.breakdownLocks).toBe(0);
      expect(stats.protection.avalancheRandomizations).toBeGreaterThanOrEqual(0);
    });

    it('should return zero hitRate when no accesses', () => {
      const stats = service.getStats();
      expect(stats.l1.hitRate).toBe(0);
      expect(stats.combined.hitRate).toBe(0);
    });
  });

  describe('getL1Cache / getL2Cache', () => {
    it('should return L1 InMemoryCache instance', () => {
      expect(service.getL1Cache()).toBeInstanceOf(InMemoryCache);
    });

    it('should return L2 CacheService instance when Redis provided', () => {
      expect(service.getL2Cache()).not.toBeNull();
    });

    it('should return null L2 when no Redis', () => {
      const noL2 = new CacheStrategyService();
      expect(noL2.getL2Cache()).toBeNull();
    });
  });

  describe('F012: avalanche protection (TTL randomization)', () => {
    it('should randomize TTL when avalanche protection is enabled', async () => {
      const svc = new CacheStrategyService(mockRedis, {
        enableAvalancheProtection: true,
        ttlRandomRatio: 0.3,
      });
      (CacheService.prototype.set as jest.Mock).mockResolvedValue(undefined);

      // Use svc.set() which goes through setL1 -> randomizeTtl
      for (let i = 0; i < 20; i++) {
        await svc.set(`key${i}`, i, 10000);
      }

      const stats = svc.getStats();
      expect(stats.protection.avalancheRandomizations).toBeGreaterThan(0);
    });

    it('should use exact TTL when avalanche protection is disabled', async () => {
      const svc = new CacheStrategyService(mockRedis, {
        enableAvalancheProtection: false,
      });
      (CacheService.prototype.set as jest.Mock).mockResolvedValue(undefined);

      await svc.set('key', 'value', 5000);

      const stats = svc.getStats();
      expect(stats.protection.avalancheRandomizations).toBe(0);
    });
  });

  describe('F012: breakdown protection (mutex lock)', () => {
    it('should deduplicate concurrent loads for the same key', async () => {
      (CacheService.prototype.get as jest.Mock).mockResolvedValue(null);
      (CacheService.prototype.set as jest.Mock).mockResolvedValue(undefined);

      let resolveLoader: (v: string) => void;
      const loaderPromise = new Promise<string>((resolve) => {
        resolveLoader = resolve;
      });
      const loader = jest.fn().mockReturnValue(loaderPromise);

      // Start two concurrent loads for the same key
      const p1 = service.getOrLoad('shared-key', loader);
      const p2 = service.getOrLoad('shared-key', loader);

      // Let microtasks process so both getOrLoad calls reach loadWithBreakdownProtection
      await Promise.resolve();

      // Loader should only be called once (second call reuses the pending promise)
      expect(loader).toHaveBeenCalledTimes(1);

      // Resolve the loader
      resolveLoader!('loaded-data');

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe('loaded-data');
      expect(r2).toBe('loaded-data');

      const stats = service.getStats();
      expect(stats.protection.breakdownLocks).toBeGreaterThanOrEqual(1);
    });

    it('should not deduplicate when breakdown protection is disabled', async () => {
      const noProtection = new CacheStrategyService(mockRedis, {
        enableBreakdownProtection: false,
      });
      (CacheService.prototype.get as jest.Mock).mockResolvedValue(null);
      (CacheService.prototype.set as jest.Mock).mockResolvedValue(undefined);

      const loader = jest.fn().mockResolvedValue('data');

      await Promise.all([
        noProtection.getOrLoad('key', loader),
        noProtection.getOrLoad('key', loader),
      ]);

      expect(loader).toHaveBeenCalledTimes(2);
    });
  });

  describe('F012: penetration protection (null value caching)', () => {
    it('should track penetration blocks in stats', async () => {
      const stats = service.getStats();
      expect(stats.protection.penetrationBlocks).toBe(0);
    });
  });
});
