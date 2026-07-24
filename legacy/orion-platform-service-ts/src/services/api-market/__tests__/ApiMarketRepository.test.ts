/**
 * ApiMarketRepository 单元测试
 *
 * 测试 API Marketplace 数据库层：Products、API Definitions、Developer Apps、Credentials、Subscriptions。
 */

import { ApiMarketRepository } from '../ApiMarketRepository';

describe('ApiMarketRepository', () => {
  let repo: ApiMarketRepository;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = { query: jest.fn() };
    repo = new ApiMarketRepository(mockPool);
  });

  // ==================== Products ====================

  describe('createProduct', () => {
    it('should create a product', async () => {
      const mockRow = { id: 'p1', name: 'Test API', slug: 'test-api' };
      mockPool.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.createProduct({ name: 'Test API', slug: 'test-api' });
      expect(result).toEqual(mockRow);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_products'),
        ['Test API', 'test-api', null, null, '1.0.0']
      );
    });

    it('should pass optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'p1' }] });
      await repo.createProduct({
        name: 'API',
        slug: 'api',
        description: 'desc',
        ownerId: 'u1',
        version: '2.0.0',
      });
      const params = mockPool.query.mock.calls[0][1];
      expect(params[2]).toBe('desc');
      expect(params[3]).toBe('u1');
      expect(params[4]).toBe('2.0.0');
    });
  });

  describe('findProductById', () => {
    it('should return product when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'p1' }] });
      const result = await repo.findProductById('p1');
      expect(result).toEqual({ id: 'p1' });
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findProductById('missing')).toBeNull();
    });
  });

  describe('findProductBySlug', () => {
    it('should return product by slug', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'p1', slug: 'test-api' }] });
      const result = await repo.findProductBySlug('test-api');
      expect(result).toEqual({ id: 'p1', slug: 'test-api' });
    });

    it('should return null when slug not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findProductBySlug('missing')).toBeNull();
    });
  });

  describe('listProducts', () => {
    it('should return all products', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'p1' }, { id: 'p2' }] });
      const result = await repo.listProducts();
      expect(result).toHaveLength(2);
    });
  });

  describe('updateProduct', () => {
    it('should update status', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'p1', status: 'published' }] });
      const result = await repo.updateProduct('p1', { status: 'published' });
      expect(result).not.toBeNull();
    });

    it('should update multiple fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'p1' }] });
      await repo.updateProduct('p1', { name: 'new', description: 'desc' });
      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('name = $1');
      expect(sql).toContain('description = $2');
    });

    it('should return existing when no fields to update', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'p1' }] });
      const result = await repo.updateProduct('p1', {});
      expect(result).toEqual({ id: 'p1' });
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.updateProduct('missing', { name: 'test' })).toBeNull();
    });
  });

  describe('deleteProduct', () => {
    it('should return true when deleted', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      expect(await repo.deleteProduct('p1')).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      expect(await repo.deleteProduct('missing')).toBe(false);
    });
  });

  // ==================== API Definitions ====================

  describe('createApiDefinition', () => {
    it('should create API definition', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'd1', version: '1.0.0' }] });
      const result = await repo.createApiDefinition('p1', '1.0.0', { openapi: '3.0.0' }, 'Initial');
      expect(result).toEqual({ id: 'd1', version: '1.0.0' });
    });

    it('should handle null changelog', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'd1' }] });
      await repo.createApiDefinition('p1', '1.0.0', {});
      const params = mockPool.query.mock.calls[0][1];
      expect(params[3]).toBeNull();
    });
  });

  describe('findApiDefinitionByProductAndVersion', () => {
    it('should return definition when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'd1' }] });
      const result = await repo.findApiDefinitionByProductAndVersion('p1', '1.0.0');
      expect(result).toEqual({ id: 'd1' });
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findApiDefinitionByProductAndVersion('p1', '9.9.9')).toBeNull();
    });
  });

  // ==================== Developer Apps ====================

  describe('createApp', () => {
    it('should create app', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'a1', name: 'My App' }] });
      const result = await repo.createApp({ developerId: 'd1', name: 'My App' });
      expect(result).toEqual({ id: 'a1', name: 'My App' });
    });

    it('should pass optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'a1' }] });
      await repo.createApp({
        developerId: 'd1',
        name: 'App',
        description: 'desc',
        redirectUris: ['https://callback.com'],
      });
      const params = mockPool.query.mock.calls[0][1];
      expect(params[2]).toBe('desc');
      expect(params[3]).toEqual(['https://callback.com']);
    });
  });

  describe('findAppById', () => {
    it('should return app when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'a1' }] });
      expect(await repo.findAppById('a1')).toEqual({ id: 'a1' });
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findAppById('missing')).toBeNull();
    });
  });

  describe('listAppsByDeveloper', () => {
    it('should return apps for developer', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'a1' }, { id: 'a2' }] });
      const result = await repo.listAppsByDeveloper('d1');
      expect(result).toHaveLength(2);
    });
  });

  describe('updateApp', () => {
    it('should update app fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'a1', name: 'new' }] });
      const result = await repo.updateApp('a1', { name: 'new', status: 'suspended' });
      expect(result).not.toBeNull();
    });

    it('should return existing when no fields to update', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'a1' }] });
      expect(await repo.updateApp('a1', {})).toEqual({ id: 'a1' });
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.updateApp('missing', { name: 'test' })).toBeNull();
    });
  });

  // ==================== Credentials ====================

  describe('createCredential', () => {
    it('should create credential', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'c1', client_id: 'client-1' }] });
      const result = await repo.createCredential({
        appId: 'a1',
        clientId: 'client-1',
        clientSecretHash: 'hash',
      });
      expect(result).toEqual({ id: 'c1', client_id: 'client-1' });
    });

    it('should use defaults for optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'c1' }] });
      await repo.createCredential({ appId: 'a1', clientId: 'c1', clientSecretHash: 'h' });
      const params = mockPool.query.mock.calls[0][1];
      expect(params[3]).toEqual(['read']);
      expect(params[4]).toBe(100);
      expect(params[5]).toBeNull();
    });
  });

  describe('findCredentialByClientId', () => {
    it('should return credential when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'c1' }] });
      expect(await repo.findCredentialByClientId('client-1')).toEqual({ id: 'c1' });
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findCredentialByClientId('missing')).toBeNull();
    });
  });

  describe('findCredentialById', () => {
    it('should return credential by id', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'c1' }] });
      expect(await repo.findCredentialById('c1')).toEqual({ id: 'c1' });
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findCredentialById('missing')).toBeNull();
    });
  });

  describe('updateCredentialLastUsed', () => {
    it('should return true when updated', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      expect(await repo.updateCredentialLastUsed('c1')).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      expect(await repo.updateCredentialLastUsed('missing')).toBe(false);
    });
  });

  describe('listCredentialsByApp', () => {
    it('should return credentials for app', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'c1' }] });
      const result = await repo.listCredentialsByApp('a1');
      expect(result).toHaveLength(1);
    });
  });

  // ==================== Subscriptions ====================

  describe('createSubscription', () => {
    it('should create subscription', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1', plan: 'basic' }] });
      const result = await repo.createSubscription('a1', 'p1', 'basic');
      expect(result).toEqual({ id: 's1', plan: 'basic' });
    });

    it('should use default quota', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1' }] });
      await repo.createSubscription('a1', 'p1', 'basic');
      const params = mockPool.query.mock.calls[0][1];
      expect(params[3]).toBe(1000);
    });

    it('should pass custom quota', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1' }] });
      await repo.createSubscription('a1', 'p1', 'premium', 5000);
      const params = mockPool.query.mock.calls[0][1];
      expect(params[3]).toBe(5000);
    });
  });

  describe('findSubscription', () => {
    it('should return subscription when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1' }] });
      expect(await repo.findSubscription('a1', 'p1')).toEqual({ id: 's1' });
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findSubscription('a1', 'p1')).toBeNull();
    });
  });

  describe('listSubscriptionsByApp', () => {
    it('should return subscriptions for app', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1' }, { id: 's2' }] });
      const result = await repo.listSubscriptionsByApp('a1');
      expect(result).toHaveLength(2);
    });
  });

  describe('updateSubscriptionUsage', () => {
    it('should return true when updated', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      expect(await repo.updateSubscriptionUsage('s1', 50)).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('used_today'),
        [50, 's1']
      );
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      expect(await repo.updateSubscriptionUsage('missing', 50)).toBe(false);
    });
  });
});
