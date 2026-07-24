/**
 * GlobalParamService Tests
 */

import { GlobalParamService, type GlobalParamServiceOptions } from '../GlobalParamService';

describe('GlobalParamService', () => {
  let mockDb: any;
  let service: GlobalParamService;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    const options: GlobalParamServiceOptions = { db: mockDb };
    service = new GlobalParamService(options);
  });

  // ==================== create ====================

  describe('create', () => {
    test('should create a tenant-scoped param', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // duplicate check
        .mockResolvedValueOnce({ rows: [{
          id: 'gp-1', tenant_id: 't-1', key: 'env', value: 'production',
          description: null, is_secret: false, scope: 'tenant',
          expires_at: null, created_at: new Date(), updated_at: new Date(),
        }], rowCount: 1 });

      const param = await service.create({
        tenantId: 't-1', key: 'env', value: 'production',
      });

      expect(param.key).toBe('env');
      expect(param.value).toBe('production');
      expect(param.scope).toBe('tenant');
      expect(param.isSecret).toBe(false);
    });

    test('should create a global-scoped param', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{
          id: 'gp-2', tenant_id: 't-1', key: 'global_version', value: '2.0',
          description: 'Global version', is_secret: false, scope: 'global',
          expires_at: null, created_at: new Date(), updated_at: new Date(),
        }], rowCount: 1 });

      const param = await service.create({
        tenantId: 't-1', key: 'global_version', value: '2.0',
        scope: 'global', description: 'Global version',
      });

      expect(param.scope).toBe('global');
    });

    test('should mask secret values', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{
          id: 'gp-3', tenant_id: 't-1', key: 'api_key', value: 'secret123456',
          description: null, is_secret: true, scope: 'tenant',
          expires_at: null, created_at: new Date(), updated_at: new Date(),
        }], rowCount: 1 });

      const param = await service.create({
        tenantId: 't-1', key: 'api_key', value: 'secret123456',
        isSecret: true,
      });

      expect(param.isSecret).toBe(true);
      expect(param.value).toBe('secr****'); // masked
    });

    test('should throw on duplicate key', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{
        id: 'gp-existing', tenant_id: 't-1', key: 'env', value: 'prod',
        description: null, is_secret: false, scope: 'tenant',
        expires_at: null, created_at: new Date(), updated_at: new Date(),
      }], rowCount: 1 });

      await expect(
        service.create({ tenantId: 't-1', key: 'env', value: 'staging' })
      ).rejects.toThrow('DUPLICATE_KEY');
    });

    test('should throw without repository', async () => {
      const noDbService = new GlobalParamService();
      await expect(
        noDbService.create({ tenantId: 't-1', key: 'k', value: 'v' })
      ).rejects.toThrow('NO_REPOSITORY');
    });
  });

  // ==================== get ====================

  describe('get', () => {
    test('should get tenant-scoped param', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{
        id: 'gp-1', tenant_id: 't-1', key: 'env', value: 'production',
        description: null, is_secret: false, scope: 'tenant',
        expires_at: null, created_at: new Date(), updated_at: new Date(),
      }], rowCount: 1 });

      const param = await service.get('t-1', 'env');
      expect(param).not.toBeNull();
      expect(param!.value).toBe('production');
    });

    test('should fall back to global-scoped param', async () => {
      // First call (tenant check) returns null, second call (global list) returns param
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{
          id: 'gp-global', tenant_id: '00000000-0000-0000-0000-000000000000',
          key: 'version', value: '2.0',
          description: null, is_secret: false, scope: 'global',
          expires_at: null, created_at: new Date(), updated_at: new Date(),
        }], rowCount: 1 });

      const param = await service.get('t-1', 'version');
      expect(param).not.toBeNull();
      expect(param!.value).toBe('2.0');
      expect(param!.scope).toBe('global');
    });

    test('should return null when param not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const param = await service.get('t-1', 'nonexistent');
      expect(param).toBeNull();
    });
  });

  // ==================== getBatch ====================

  describe('getBatch', () => {
    test('should resolve multiple keys', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{
          id: 'gp-1', tenant_id: 't-1', key: 'env', value: 'prod',
          description: null, is_secret: false, scope: 'tenant',
          expires_at: null, created_at: new Date(), updated_at: new Date(),
        }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // version not found
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // region fallback global
        .mockResolvedValueOnce({ rows: [{
          id: 'gp-global', tenant_id: '00000000-0000-0000-0000-000000000000',
          key: 'region', value: 'us-east-1',
          description: null, is_secret: false, scope: 'global',
          expires_at: null, created_at: new Date(), updated_at: new Date(),
        }], rowCount: 1 });

      const result = await service.getBatch('t-1', ['env', 'version', 'region']);
      expect(result).toEqual({ env: 'prod', region: 'us-east-1' });
    });
  });

  // ==================== resolve ====================

  describe('resolve', () => {
    test('should resolve with defaults for missing keys', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.resolve('t-1', {
        env: 'staging',
        version: '1.0.0',
      });

      expect(result).toEqual({ env: 'staging', version: '1.0.0' });
    });
  });

  // ==================== list ====================

  describe('list', () => {
    test('should list tenant params', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'gp-1', tenant_id: 't-1', key: 'env', value: 'prod',
        description: null, is_secret: false, scope: 'tenant',
        expires_at: null, created_at: new Date(), updated_at: new Date(),
      }, {
        id: 'gp-2', tenant_id: 't-1', key: 'region', value: 'us-east',
        description: null, is_secret: false, scope: 'tenant',
        expires_at: null, created_at: new Date(), updated_at: new Date(),
      }], rowCount: 2 });

      const params = await service.list('t-1');
      expect(params).toHaveLength(2);
      expect(params[0].key).toBe('env');
    });
  });

  // ==================== update ====================

  describe('update', () => {
    test('should update param value', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'gp-1', tenant_id: 't-1', key: 'env', value: 'staging',
        description: 'Updated env', is_secret: false, scope: 'tenant',
        expires_at: null, created_at: new Date(), updated_at: new Date(),
      }], rowCount: 1 });

      const param = await service.update('gp-1', { value: 'staging', description: 'Updated env' });
      expect(param.value).toBe('staging');
      expect(param.description).toBe('Updated env');
    });
  });

  // ==================== delete ====================

  describe('delete', () => {
    test('should delete a param', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await expect(service.delete('gp-1')).resolves.toBeUndefined();
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM global_params WHERE id = $1',
        ['gp-1']
      );
    });
  });

  // ==================== cleanupExpired ====================

  describe('cleanupExpired', () => {
    test('should delete expired params', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 5 });

      const count = await service.cleanupExpired(30);
      expect(count).toBe(5);
    });
  });
});
