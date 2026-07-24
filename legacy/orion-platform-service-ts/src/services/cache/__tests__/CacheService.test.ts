/**
 * CacheService Tests - Test Redis-backed cache operations
 */

import { CacheService } from '../CacheService';
import { RedisCache } from '../../redis-cache';

describe('CacheService', () => {
  let mockRedis: jest.Mocked<RedisCache>;
  let service: CacheService;

  beforeEach(() => {
    mockRedis = {
      isHealthy: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      getClient: jest.fn(),
    } as unknown as jest.Mocked<RedisCache>;

    service = new CacheService(mockRedis, 300);
  });

  describe('get', () => {
    it('should return parsed value when Redis has data', async () => {
      mockRedis.isHealthy.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(JSON.stringify({ name: 'test', value: 42 }));

      const result = await service.get<{ name: string; value: number }>('test-key');

      expect(result).toEqual({ name: 'test', value: 42 });
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when Redis is not healthy', async () => {
      mockRedis.isHealthy.mockReturnValue(false);

      const result = await service.get('test-key');

      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should return null when key does not exist', async () => {
      mockRedis.isHealthy.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });

    it('should return null on JSON parse error', async () => {
      mockRedis.isHealthy.mockReturnValue(true);
      mockRedis.get.mockResolvedValue('not-valid-json{{{');

      const result = await service.get('corrupt-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set JSON-serialized value with TTL', async () => {
      mockRedis.isHealthy.mockReturnValue(true);

      await service.set('test-key', { name: 'test' }, 60);

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', JSON.stringify({ name: 'test' }), 60);
    });

    it('should use default TTL when not provided', async () => {
      mockRedis.isHealthy.mockReturnValue(true);

      await service.set('test-key', { data: 123 });

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', JSON.stringify({ data: 123 }), 300);
    });

    it('should be a no-op when Redis is not healthy', async () => {
      mockRedis.isHealthy.mockReturnValue(false);

      await service.set('test-key', { data: 123 });

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should not throw on Redis error', async () => {
      mockRedis.isHealthy.mockReturnValue(true);
      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(service.set('test-key', {})).resolves.toBeUndefined();
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      mockRedis.isHealthy.mockReturnValue(true);

      await service.del('test-key');

      expect(mockRedis.delete).toHaveBeenCalledWith('test-key');
    });

    it('should be a no-op when Redis is not healthy', async () => {
      mockRedis.isHealthy.mockReturnValue(false);

      await service.del('test-key');

      expect(mockRedis.delete).not.toHaveBeenCalled();
    });

    it('should not throw on delete error', async () => {
      mockRedis.isHealthy.mockReturnValue(true);
      mockRedis.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.del('test-key')).resolves.toBeUndefined();
    });
  });

  describe('getOrLoad', () => {
    it('should return cached value when available', async () => {
      mockRedis.isHealthy.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(JSON.stringify({ cached: true }));
      const loader = jest.fn().mockResolvedValue({ fromLoader: true });

      const result = await service.getOrLoad('key', loader);

      expect(result).toEqual({ cached: true });
      expect(loader).not.toHaveBeenCalled();
    });

    it('should call loader and cache result when cache miss', async () => {
      mockRedis.isHealthy.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      const loader = jest.fn().mockResolvedValue({ fromLoader: true });

      const result = await service.getOrLoad('key', loader, 120);

      expect(result).toEqual({ fromLoader: true });
      expect(loader).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith('key', JSON.stringify({ fromLoader: true }), 120);
    });
  });

  describe('invalidate', () => {
    it('should delete keys matching pattern', async () => {
      mockRedis.isHealthy.mockReturnValue(true);
      const mockClient = {
        keys: jest.fn().mockResolvedValue(['key1', 'key2', 'key3']),
        del: jest.fn().mockResolvedValue(3),
      };
      mockRedis.getClient.mockReturnValue(mockClient as any);

      await service.invalidate('config:*');

      expect(mockClient.keys).toHaveBeenCalledWith('config:*');
      expect(mockClient.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should be a no-op when Redis is not healthy', async () => {
      mockRedis.isHealthy.mockReturnValue(false);

      await expect(service.invalidate('config:*')).resolves.toBeUndefined();
    });

    it('should not throw on error', async () => {
      mockRedis.isHealthy.mockReturnValue(true);
      mockRedis.getClient.mockReturnValue({
        keys: jest.fn().mockRejectedValue(new Error('Keys failed')),
      } as any);

      await expect(service.invalidate('config:*')).resolves.toBeUndefined();
    });
  });
});

describe('CacheService with null Redis', () => {
  let service: CacheService;

  beforeEach(() => {
    service = new CacheService(null);
  });

  it('should return null for get', async () => {
    const result = await service.get('key');
    expect(result).toBeNull();
  });

  it('should be a no-op for set', async () => {
    await expect(service.set('key', {})).resolves.toBeUndefined();
  });

  it('should be a no-op for del', async () => {
    await expect(service.del('key')).resolves.toBeUndefined();
  });

  it('should call loader for getOrLoad', async () => {
    const loader = jest.fn().mockResolvedValue({ loaded: true });
    const result = await service.getOrLoad('key', loader);
    expect(result).toEqual({ loaded: true });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('should be a no-op for invalidate', async () => {
    await expect(service.invalidate('pattern:*')).resolves.toBeUndefined();
  });
});
