/**
 * CacheRepository Tests - Database-backed cache storage
 */

import { CacheRepository, CacheEntry } from '../CacheRepository';

describe('CacheRepository', () => {
  let repo: CacheRepository;
  let mockPool: { query: jest.Mock };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new CacheRepository(mockPool as any);
  });

  describe('set', () => {
    it('should insert a new cache entry with default TTL', async () => {
      const now = new Date();
      const expectedRow: CacheEntry = {
        id: '1',
        tenant_id: 'tenant-1',
        key: 'test-key',
        value: { data: 'hello' },
        ttl: 3600,
        created_at: now,
        expires_at: new Date(now.getTime() + 3600000),
      };
      mockPool.query.mockResolvedValue({ rows: [expectedRow], rowCount: 1 });

      const result = await repo.set('tenant-1', 'test-key', { data: 'hello' });

      expect(result).toEqual(expectedRow);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO cache_entries');
      expect(sql).toContain('ON CONFLICT');
      expect(params[0]).toBe('tenant-1');
      expect(params[1]).toBe('test-key');
      expect(params[2]).toEqual({ data: 'hello' });
      expect(params[3]).toBe(3600);
    });

    it('should insert with custom TTL', async () => {
      const now = new Date();
      const expectedRow: CacheEntry = {
        id: '2',
        tenant_id: 'tenant-1',
        key: 'short-lived',
        value: { temp: true },
        ttl: 60,
        created_at: now,
        expires_at: new Date(now.getTime() + 60000),
      };
      mockPool.query.mockResolvedValue({ rows: [expectedRow], rowCount: 1 });

      const result = await repo.set('tenant-1', 'short-lived', { temp: true }, 60);

      expect(result.ttl).toBe(60);
      const [, params] = mockPool.query.mock.calls[0];
      expect(params[3]).toBe(60);
    });

    it('should handle upsert (ON CONFLICT) for existing key', async () => {
      const now = new Date();
      const expectedRow: CacheEntry = {
        id: '1',
        tenant_id: 'tenant-1',
        key: 'existing-key',
        value: { updated: true },
        ttl: 3600,
        created_at: now,
        expires_at: new Date(now.getTime() + 3600000),
      };
      mockPool.query.mockResolvedValue({ rows: [expectedRow], rowCount: 1 });

      const result = await repo.set('tenant-1', 'existing-key', { updated: true });

      expect(result.value).toEqual({ updated: true });
      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (tenant_id, key) DO UPDATE SET');
    });
  });

  describe('get', () => {
    it('should return a cache entry when found and not expired', async () => {
      const entry: CacheEntry = {
        id: '1',
        tenant_id: 'tenant-1',
        key: 'test-key',
        value: { data: 'cached' },
        ttl: 3600,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 3600000),
      };
      mockPool.query.mockResolvedValue({ rows: [entry], rowCount: 1 });

      const result = await repo.get('tenant-1', 'test-key');

      expect(result).toEqual(entry);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('expires_at > NOW()');
      expect(params).toEqual(['tenant-1', 'test-key']);
    });

    it('should return null when key is not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.get('tenant-1', 'missing-key');

      expect(result).toBeNull();
    });

    it('should return null when entry is expired (filtered by SQL)', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.get('tenant-1', 'expired-key');

      expect(result).toBeNull();
    });

    it('should scope query to tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.get('tenant-abc', 'key');

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[0]).toBe('tenant-abc');
    });
  });

  describe('delete', () => {
    it('should return true when a row is deleted', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const result = await repo.delete('tenant-1', 'test-key');

      expect(result).toBe(true);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM cache_entries');
      expect(params).toEqual(['tenant-1', 'test-key']);
    });

    it('should return false when no row matches', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.delete('tenant-1', 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should delete expired entries and return count', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 5 });

      const result = await repo.cleanup();

      expect(result).toBe(5);
      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM cache_entries WHERE expires_at < NOW()');
    });

    it('should return 0 when no entries are expired', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.cleanup();

      expect(result).toBe(0);
    });
  });
});
