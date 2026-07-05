/**
 * ApiKeyRepository Tests - Supplementary coverage
 */

import { ApiKeyRepository, ApiKey } from '../ApiKeyRepository';

describe('ApiKeyRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: ApiKeyRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new ApiKeyRepository(mockDb as any);
  });

  describe('findById', () => {
    it('should return key when found', async () => {
      const mockRow: ApiKey = {
        id: 'k1', tenant_id: 't1', user_id: 'u1', name: 'test',
        key_hash: 'h1', permissions: ['read'], expires_at: null,
        last_used_at: null, created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findById('k1');

      expect(result).toEqual(mockRow);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM api_keys WHERE id = $1', ['k1']);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('connection refused'));

      await expect(repository.findById('k1')).rejects.toThrow('connection refused');
    });
  });

  describe('findAll', () => {
    it('should return all keys for a tenant', async () => {
      const mockRows: ApiKey[] = [
        { id: 'k1', tenant_id: 't1', user_id: 'u1', name: 'key-1', key_hash: 'h1', permissions: ['read'], expires_at: null, last_used_at: null, created_at: new Date() },
        { id: 'k2', tenant_id: 't1', user_id: 'u2', name: 'key-2', key_hash: 'h2', permissions: ['read', 'write'], expires_at: null, last_used_at: null, created_at: new Date() },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.findAll('t1');

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM api_keys WHERE tenant_id = $1', ['t1']);
    });

    it('should return empty array when no keys exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findAll('t1');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('timeout'));

      await expect(repository.findAll('t1')).rejects.toThrow('timeout');
    });
  });

  describe('create', () => {
    it('should insert a new API key and return it', async () => {
      const mockRow: ApiKey = {
        id: 'k-new', tenant_id: 't1', user_id: 'u1', name: 'new-key',
        key_hash: 'h1', permissions: ['read'], expires_at: null,
        last_used_at: null, created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.create('t1', 'u1', 'new-key', 'h1', ['read']);

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO api_keys');
      expect(sql).toContain('RETURNING *');
    });

    it('should handle optional expiresAt as null when not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'k1' }] });

      await repository.create('t1', 'u1', 'key', 'hash', ['read']);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[5]).toBeNull();
    });

    it('should pass expiresAt when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'k1' }] });
      const expiresAt = new Date('2026-12-31');

      await repository.create('t1', 'u1', 'key', 'hash', ['read'], expiresAt);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[5]).toEqual(expiresAt);
    });

    it('should handle empty permissions array', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'k1', permissions: [] }] });

      await repository.create('t1', 'u1', 'key', 'hash', []);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[4]).toEqual([]);
    });

    it('should handle multiple permissions', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'k1' }] });

      await repository.create('t1', 'u1', 'key', 'hash', ['read', 'write', 'admin']);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[4]).toEqual(['read', 'write', 'admin']);
    });

    it('should propagate database errors on create', async () => {
      mockDb.query.mockRejectedValue(new Error('unique constraint violation'));

      await expect(repository.create('t1', 'u1', 'key', 'hash', ['read']))
        .rejects.toThrow('unique constraint violation');
    });
  });

  describe('delete', () => {
    it('should return true when key deleted', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('k1');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM api_keys WHERE id = $1', ['k1']);
    });

    it('should return false when no rows affected', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('missing');

      expect(result).toBe(false);
    });

    it('should propagate database errors on delete', async () => {
      mockDb.query.mockRejectedValue(new Error('foreign key constraint'));

      await expect(repository.delete('k1')).rejects.toThrow('foreign key constraint');
    });
  });

  describe('updateLastUsed', () => {
    it('should update last_used_at timestamp', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      await repository.updateLastUsed('k1');

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('UPDATE api_keys SET last_used_at = NOW()');
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('last_used_at'), ['k1']);
    });

    it('should not throw when key does not exist', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      await expect(repository.updateLastUsed('non-existent')).resolves.toBeUndefined();
    });

    it('should propagate database errors on updateLastUsed', async () => {
      mockDb.query.mockRejectedValue(new Error('connection lost'));

      await expect(repository.updateLastUsed('k1')).rejects.toThrow('connection lost');
    });
  });

  describe('findByHash', () => {
    it('should return key when hash matches', async () => {
      const mockRow: ApiKey = {
        id: 'k1', tenant_id: 't1', user_id: 'u1', name: 'test',
        key_hash: 'abc123', permissions: ['read'], expires_at: null,
        last_used_at: null, created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findByHash('abc123');

      expect(result).toEqual(mockRow);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM api_keys WHERE key_hash = $1',
        ['abc123']
      );
    });

    it('should return null when hash not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findByHash('non-existent');

      expect(result).toBeNull();
    });

    it('should propagate database errors on findByHash', async () => {
      mockDb.query.mockRejectedValue(new Error('index corrupted'));

      await expect(repository.findByHash('hash123')).rejects.toThrow('index corrupted');
    });
  });
});
