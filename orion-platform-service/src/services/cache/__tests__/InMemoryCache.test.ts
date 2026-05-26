/**
 * InMemoryCache Tests
 *
 * F010: L1 memory cache with TTL + LRU
 */

import { InMemoryCache } from '../InMemoryCache';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });

  describe('get / set', () => {
    test('should store and retrieve a value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('should return undefined for missing key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    test('should overwrite existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });

    test('should store complex objects', () => {
      const obj = { name: 'test', count: 42, nested: { a: 1 } };
      cache.set('obj', obj);
      expect(cache.get('obj')).toEqual(obj);
    });
  });

  describe('TTL expiry', () => {
    test('should expire after TTL', () => {
      cache.set('key1', 'value1', 50); // 50ms TTL
      expect(cache.get('key1')).toBe('value1');

      // Wait for expiry
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cache.get('key1')).toBeUndefined();
          resolve();
        }, 100);
      });
    });

    test('should use default TTL when not specified', () => {
      const shortCache = new InMemoryCache({ defaultTtlMs: 50 });
      shortCache.set('key1', 'value1');
      expect(shortCache.get('key1')).toBe('value1');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortCache.get('key1')).toBeUndefined();
          resolve();
        }, 100);
      });
    });
  });

  describe('has', () => {
    test('should return true for existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    test('should return false for expired key', () => {
      cache.set('key1', 'value1', 50);
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cache.has('key1')).toBe(false);
          resolve();
        }, 100);
      });
    });

    test('should return false for missing key', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });
  });

  describe('delete', () => {
    test('should delete a key', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    test('should return false for non-existent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    test('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    test('should evict least recently used when at capacity', async () => {
      const smallCache = new InMemoryCache({ maxSize: 3 });
      smallCache.set('a', 1);
      await new Promise((r) => setTimeout(r, 2));
      smallCache.set('b', 2);
      await new Promise((r) => setTimeout(r, 2));
      smallCache.set('c', 3);

      // Access 'a' to make it recently used
      smallCache.get('a');

      // Add 'd' - should evict 'b' (LRU, oldest access)
      smallCache.set('d', 4);

      expect(smallCache.get('a')).toBe(1); // accessed recently, still there
      expect(smallCache.get('b')).toBeUndefined(); // LRU, evicted
      expect(smallCache.get('c')).toBe(3);
      expect(smallCache.get('d')).toBe(4);
    });

    test('should track eviction count in stats', async () => {
      const smallCache = new InMemoryCache({ maxSize: 2 });
      smallCache.set('a', 1);
      await new Promise((r) => setTimeout(r, 2));
      smallCache.set('b', 2);
      await new Promise((r) => setTimeout(r, 2));
      smallCache.set('c', 3); // triggers eviction

      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe('deleteByPattern', () => {
    test('should delete entries matching pattern', () => {
      cache.set('user:1', { id: 1 });
      cache.set('user:2', { id: 2 });
      cache.set('config:main', { key: 'main' });

      const deleted = cache.deleteByPattern('user:*');
      expect(deleted).toBe(2);
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('config:main')).toBeDefined();
    });

    test('should support exact match pattern', () => {
      cache.set('exact', 'value');
      cache.set('exact2', 'value2');

      const deleted = cache.deleteByPattern('exact');
      expect(deleted).toBe(1);
      expect(cache.get('exact')).toBeUndefined();
      expect(cache.get('exact2')).toBeDefined();
    });
  });

  describe('cleanupExpired', () => {
    test('should remove expired entries', () => {
      cache.set('key1', 'value1', 50);
      cache.set('key2', 'value2', 5000);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const cleaned = cache.cleanupExpired();
          expect(cleaned).toBe(1);
          expect(cache.get('key1')).toBeUndefined();
          expect(cache.get('key2')).toBe('value2');
          resolve();
        }, 100);
      });
    });
  });

  describe('stats', () => {
    test('should track hits and misses', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    test('should reset stats', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    test('should track expiration count', () => {
      cache.set('key1', 'value1', 50);
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          cache.get('key1'); // triggers expiration
          const stats = cache.getStats();
          expect(stats.expirations).toBe(1);
          resolve();
        }, 100);
      });
    });
  });
});
