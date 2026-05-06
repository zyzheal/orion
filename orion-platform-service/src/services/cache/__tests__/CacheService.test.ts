/**
 * CacheService Tests - Test cache read/write, TTL, invalidation
 */

import { CacheService, CacheServiceError } from '../CacheService';
import { CacheRepository, CacheEntry } from '../CacheRepository';

describe('CacheService', () => {
  let mockRepository: jest.Mocked<CacheRepository>;
  let service: CacheService;

  beforeEach(() => {
    mockRepository = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      cleanup: jest.fn(),
    } as unknown as jest.Mocked<CacheRepository>;

    service = new CacheService(mockRepository);
  });

  describe('set', () => {
    it('should set a cache entry with default TTL', async () => {
      const mockEntry: CacheEntry = {
        id: 'cache-1',
        tenant_id: 'tenant-1',
        key: 'test-key',
        value: { data: 'test' },
        ttl: 3600,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 3600000),
      };
      mockRepository.set.mockResolvedValue(mockEntry);

      const result = await service.set('tenant-1', 'test-key', { data: 'test' });

      expect(result).toEqual(mockEntry);
      expect(mockRepository.set).toHaveBeenCalledWith('tenant-1', 'test-key', { data: 'test' }, undefined);
    });

    it('should set a cache entry with custom TTL', async () => {
      const mockEntry: CacheEntry = {
        id: 'cache-2',
        tenant_id: 'tenant-1',
        key: 'ttl-key',
        value: { data: 'test' },
        ttl: 7200,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 7200000),
      };
      mockRepository.set.mockResolvedValue(mockEntry);

      const result = await service.set('tenant-1', 'ttl-key', { data: 'test' }, 7200);

      expect(result).toEqual(mockEntry);
      expect(mockRepository.set).toHaveBeenCalledWith('tenant-1', 'ttl-key', { data: 'test' }, 7200);
    });
  });

  describe('get', () => {
    it('should return cache entry when key exists', async () => {
      const mockEntry: CacheEntry = {
        id: 'cache-1',
        tenant_id: 'tenant-1',
        key: 'existing-key',
        value: { result: 'found' },
        ttl: 3600,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 3600000),
      };
      mockRepository.get.mockResolvedValue(mockEntry);

      const result = await service.get('tenant-1', 'existing-key');

      expect(result).toEqual(mockEntry);
      expect(mockRepository.get).toHaveBeenCalledWith('tenant-1', 'existing-key');
    });

    it('should return null when key does not exist', async () => {
      mockRepository.get.mockResolvedValue(null);

      const result = await service.get('tenant-1', 'missing-key');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a cache entry and return true', async () => {
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.delete('tenant-1', 'to-delete');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('tenant-1', 'to-delete');
    });

    it('should return false when key does not exist', async () => {
      mockRepository.delete.mockResolvedValue(false);

      const result = await service.delete('tenant-1', 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('clearExpired', () => {
    it('should return count of cleaned up entries', async () => {
      mockRepository.cleanup.mockResolvedValue(5);

      const result = await service.clearExpired();

      expect(result).toBe(5);
      expect(mockRepository.cleanup).toHaveBeenCalled();
    });

    it('should return 0 when no expired entries', async () => {
      mockRepository.cleanup.mockResolvedValue(0);

      const result = await service.clearExpired();

      expect(result).toBe(0);
    });
  });
});

describe('CacheRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: CacheRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new CacheRepository(mockDb as any);
  });

  describe('set', () => {
    it('should insert a cache entry with ON CONFLICT upsert', async () => {
      const mockRow = {
        id: 'cache-1',
        tenant_id: 'tenant-1',
        key: 'test-key',
        value: { data: 'value' },
        ttl: 3600,
        created_at: new Date(),
        expires_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.set('tenant-1', 'test-key', { data: 'value' });

      expect(result).toEqual(mockRow);
      const callArgs = mockDb.query.mock.calls[0];
      expect(callArgs[0]).toContain('ON CONFLICT');
      expect(callArgs[1][0]).toBe('tenant-1');
      expect(callArgs[1][1]).toBe('test-key');
    });

    it('should use default TTL of 3600 when not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'cache-1' }] });

      await repository.set('tenant-1', 'key', {});

      const params = mockDb.query.mock.calls[0][1];
      expect(params[3]).toBe(3600); // default TTL
    });

    it('should use custom TTL when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'cache-1' }] });

      await repository.set('tenant-1', 'key', {}, 7200);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[3]).toBe(7200);
    });
  });

  describe('get', () => {
    it('should return entry when not expired', async () => {
      const mockRow = { id: 'cache-1', key: 'test', value: { data: 'ok' } };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.get('tenant-1', 'test');

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('expires_at > NOW()');
    });

    it('should return null when no entry found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.get('tenant-1', 'missing');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return true when entry deleted', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('tenant-1', 'key');

      expect(result).toBe(true);
    });

    it('should return false when no entry found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('tenant-1', 'missing');

      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should delete expired entries and return count', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 10 });

      const result = await repository.cleanup();

      expect(result).toBe(10);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('expires_at < NOW()');
    });
  });
});
