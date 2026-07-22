/**
 * ApiKeyService Tests
 */

import { ApiKeyService, ApiKeyServiceError } from '../ApiKeyService';
import { ApiKeyRepository, ApiKey } from '../ApiKeyRepository';

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({ toString: () => 'mock-hex-key-1234567890abcdef' }),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue('mock-hash-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
    }),
  }),
}));

describe('ApiKeyService', () => {
  let mockRepository: jest.Mocked<ApiKeyRepository>;
  let service: ApiKeyService;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      updateLastUsed: jest.fn(),
      findByHash: jest.fn(),
    } as unknown as jest.Mocked<ApiKeyRepository>;

    service = new ApiKeyService(mockRepository);
  });

  describe('createKey', () => {
    it('should create a new API key with raw key returned', async () => {
      const mockKey: ApiKey = {
        id: 'key-1',
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        name: 'test-key',
        key_hash: 'mock-hash-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        permissions: ['read', 'write'],
        expires_at: null,
        last_used_at: null,
        created_at: new Date(),
      };
      mockRepository.create.mockResolvedValue(mockKey);

      const result = await service.createKey('tenant-1', 'user-1', 'test-key', ['read', 'write']);

      expect(result.key).toEqual(mockKey);
      expect(result.rawKey).toBe('mock-hex-key-1234567890abcdef');
      expect(mockRepository.create).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        'test-key',
        'mock-hash-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        ['read', 'write'],
        undefined
      );
    });

    it('should create a key with expiration when expiresInDays provided', async () => {
      const mockKey: ApiKey = {
        id: 'key-2',
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        name: 'expiring-key',
        key_hash: 'hash-1',
        permissions: ['read'],
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        last_used_at: null,
        created_at: new Date(),
      };
      mockRepository.create.mockResolvedValue(mockKey);

      const result = await service.createKey('tenant-1', 'user-1', 'expiring-key', ['read'], 30);

      expect(result.key.expires_at).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalled();
      const createCall = mockRepository.create.mock.calls[0];
      expect(createCall[5]).toBeInstanceOf(Date);
    });

    it('should throw when tenantId is missing', async () => {
      await expect(service.createKey('', 'user-1', 'key', ['read']))
        .rejects.toThrow(ApiKeyServiceError);
      await expect(service.createKey('', 'user-1', 'key', ['read']))
        .rejects.toThrow('Tenant ID and name required');
    });

    it('should throw when name is missing', async () => {
      await expect(service.createKey('tenant-1', 'user-1', '', ['read']))
        .rejects.toThrow(ApiKeyServiceError);
    });
  });

  describe('listKeys', () => {
    it('should return all keys for a tenant', async () => {
      const mockKeys: ApiKey[] = [
        { id: 'k1', tenant_id: 't1', user_id: 'u1', name: 'key-1', key_hash: 'h1', permissions: ['read'], expires_at: null, last_used_at: null, created_at: new Date() },
        { id: 'k2', tenant_id: 't1', user_id: 'u2', name: 'key-2', key_hash: 'h2', permissions: ['read', 'write'], expires_at: null, last_used_at: null, created_at: new Date() },
      ];
      mockRepository.findAll.mockResolvedValue(mockKeys);

      const result = await service.listKeys('t1');

      expect(result).toEqual(mockKeys);
      expect(mockRepository.findAll).toHaveBeenCalledWith('t1');
    });

    it('should return empty array when no keys exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.listKeys('t1');

      expect(result).toEqual([]);
    });
  });

  describe('revokeKey', () => {
    it('should revoke an existing key', async () => {
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.revokeKey('key-1');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('key-1');
    });

    it('should return false when key does not exist', async () => {
      mockRepository.delete.mockResolvedValue(false);

      const result = await service.revokeKey('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('verifyKey', () => {
    it('should return key record for valid non-expired key', async () => {
      const mockKey: ApiKey = {
        id: 'key-1',
        tenant_id: 't1',
        user_id: 'u1',
        name: 'test-key',
        key_hash: 'mock-hash-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        permissions: ['read'],
        expires_at: null,
        last_used_at: null,
        created_at: new Date(),
      };
      mockRepository.findByHash.mockResolvedValue(mockKey);
      mockRepository.updateLastUsed.mockResolvedValue(undefined);

      const result = await service.verifyKey('raw-key-value');

      expect(result).not.toBeNull();
      expect(result?.keyId).toBe('key-1');
      expect(mockRepository.updateLastUsed).toHaveBeenCalledWith('key-1');
    });

    it('should return null for non-existent key', async () => {
      mockRepository.findByHash.mockResolvedValue(null);

      const result = await service.verifyKey('invalid-key');

      expect(result).toBeNull();
    });

    it('should return null and delete expired key', async () => {
      const expiredKey: ApiKey = {
        id: 'key-expired',
        tenant_id: 't1',
        user_id: 'u1',
        name: 'expired',
        key_hash: 'hash',
        permissions: ['read'],
        expires_at: new Date(Date.now() - 86400000), // yesterday
        last_used_at: null,
        created_at: new Date(),
      };
      mockRepository.findByHash.mockResolvedValue(expiredKey);
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.verifyKey('expired-key');

      expect(result).toBeNull();
      expect(mockRepository.delete).toHaveBeenCalledWith('key-expired');
    });

    it('should not delete key with no expiration', async () => {
      const validKey: ApiKey = {
        id: 'key-valid',
        tenant_id: 't1',
        user_id: 'u1',
        name: 'valid',
        key_hash: 'hash',
        permissions: ['read'],
        expires_at: null,
        last_used_at: null,
        created_at: new Date(),
      };
      mockRepository.findByHash.mockResolvedValue(validKey);

      await service.verifyKey('valid-key');

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });
});

describe('ApiKeyServiceError', () => {
  it('should have correct name and code', () => {
    const error = new ApiKeyServiceError('test error', 'TEST_CODE');
    expect(error.name).toBe('ApiKeyServiceError');
    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('test error');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ApiKeyRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: ApiKeyRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new ApiKeyRepository(mockDb as any);
  });

  describe('findById', () => {
    it('should return key when found', async () => {
      const mockRow = { id: 'k1', tenant_id: 't1', user_id: 'u1', name: 'test', key_hash: 'h1' };
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
  });

  describe('findAll', () => {
    it('should return all keys for a tenant', async () => {
      const mockRows = [
        { id: 'k1', tenant_id: 't1', name: 'key-1' },
        { id: 'k2', tenant_id: 't1', name: 'key-2' },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.findAll('t1');

      expect(result).toEqual(mockRows);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM api_keys WHERE tenant_id = $1', ['t1']);
    });
  });

  describe('create', () => {
    it('should insert a new API key and return it', async () => {
      const mockRow = { id: 'k-new', tenant_id: 't1', user_id: 'u1', name: 'new-key', key_hash: 'h1', permissions: ['read'] };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.create('t1', 'u1', 'new-key', 'h1', ['read']);

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO api_keys');
      expect(sql).toContain('RETURNING *');
    });

    it('should handle optional expiresAt', async () => {
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
  });

  describe('delete', () => {
    it('should return true when key deleted', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('k1');

      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('missing');

      expect(result).toBe(false);
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
  });

  describe('findByHash', () => {
    it('should return key when hash matches', async () => {
      const mockRow = { id: 'k1', key_hash: 'abc123' };
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
  });
});
