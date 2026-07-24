/**
 * ApiVersionService 单元测试
 */

import { ApiVersionService, ApiVersion } from '../ApiVersionService';

// Mock repository
const mockVersionRepo = {
  createVersion: jest.fn(),
  findByApiId: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  deleteVersion: jest.fn(),
  findByTenant: jest.fn(),
};

jest.mock('../../../repositories/ApiVersionRepository', () => ({
  ApiVersionRepository: jest.fn().mockImplementation(() => mockVersionRepo),
}));

describe('ApiVersionService', () => {
  let service: ApiVersionService;
  let serviceWithDb: ApiVersionService;
  const mockDb = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApiVersionService();
    serviceWithDb = new ApiVersionService(mockDb as any);
  });

  describe('constructor', () => {
    it('should create service without DB', () => {
      expect(service).toBeDefined();
    });

    it('should create service with DB', () => {
      expect(serviceWithDb).toBeDefined();
    });

    it('should create service with undefined db', () => {
      const svc = new ApiVersionService(undefined);
      expect(svc).toBeDefined();
    });
  });

  describe('registerApiVersion', () => {
    it('should register version without DB (in-memory fallback)', async () => {
      const result = await service.registerApiVersion('tenant1', {
        apiId: 'api1',
        version: 'v1.0',
        definition: { endpoints: { '/users': {} } },
      });

      expect(result).toBeDefined();
      expect(result.tenantId).toBe('tenant1');
      expect(result.apiId).toBe('api1');
      expect(result.version).toBe('v1.0');
      expect(result.status).toBe('active');
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.definition).toEqual({ endpoints: { '/users': {} } });
    });

    it('should register version with DB', async () => {
      const now = new Date();
      mockVersionRepo.createVersion.mockResolvedValue({
        id: 'v1',
        tenantId: 'tenant1',
        apiId: 'api1',
        version: 'v2.0',
        definition: { paths: {} },
        status: 'active',
        createdAt: now,
        deprecatedAt: null,
      });

      const result = await serviceWithDb.registerApiVersion('tenant1', {
        apiId: 'api1',
        version: 'v2.0',
        definition: { paths: {} },
      });

      expect(result.id).toBe('v1');
      expect(result.version).toBe('v2.0');
      expect(result.status).toBe('active');
      expect(mockVersionRepo.createVersion).toHaveBeenCalledTimes(1);
    });

    it('should generate unique IDs for in-memory registrations', async () => {
      const v1 = await service.registerApiVersion('tenant1', {
        apiId: 'api1',
        version: 'v1',
        definition: {},
      });
      const v2 = await service.registerApiVersion('tenant1', {
        apiId: 'api1',
        version: 'v2',
        definition: {},
      });

      expect(v1.id).not.toBe(v2.id);
    });

    it('should handle deprecatedAt from DB entity', async () => {
      const now = new Date();
      const deprecatedAt = new Date('2024-06-01');
      mockVersionRepo.createVersion.mockResolvedValue({
        id: 'v1',
        tenantId: 'tenant1',
        apiId: 'api1',
        version: 'v1',
        definition: {},
        status: 'deprecated',
        createdAt: now,
        deprecatedAt,
      });

      const result = await serviceWithDb.registerApiVersion('tenant1', {
        apiId: 'api1',
        version: 'v1',
        definition: {},
      });

      expect(result.deprecatedAt).toBeDefined();
      expect(result.status).toBe('deprecated');
    });

    it('should handle undefined deprecatedAt from DB entity', async () => {
      const now = new Date();
      mockVersionRepo.createVersion.mockResolvedValue({
        id: 'v1',
        tenantId: 'tenant1',
        apiId: 'api1',
        version: 'v1',
        definition: {},
        status: 'active',
        createdAt: now,
        deprecatedAt: undefined,
      });

      const result = await serviceWithDb.registerApiVersion('tenant1', {
        apiId: 'api1',
        version: 'v1',
        definition: {},
      });

      expect(result.deprecatedAt).toBeUndefined();
    });
  });

  describe('listApiVersions', () => {
    it('should return empty array when no repository', async () => {
      const result = await service.listApiVersions('api1');

      expect(result).toEqual([]);
    });

    it('should return versions from repository', async () => {
      const now = new Date();
      mockVersionRepo.findByApiId.mockResolvedValue([
        {
          id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
          definition: {}, status: 'active', createdAt: now, deprecatedAt: null,
        },
        {
          id: 'v2', tenantId: 'tenant1', apiId: 'api1', version: 'v2.0',
          definition: {}, status: 'active', createdAt: now, deprecatedAt: null,
        },
      ]);

      const result = await serviceWithDb.listApiVersions('api1');

      expect(result.length).toBe(2);
      expect(result[0].version).toBe('v1.0');
      expect(result[1].version).toBe('v2.0');
    });

    it('should return empty array when no versions exist', async () => {
      mockVersionRepo.findByApiId.mockResolvedValue([]);

      const result = await serviceWithDb.listApiVersions('api1');

      expect(result).toEqual([]);
    });
  });

  describe('getVersion', () => {
    it('should return null when no repository', async () => {
      const result = await service.getVersion('v1');

      expect(result).toBeNull();
    });

    it('should return null when version not found', async () => {
      mockVersionRepo.findById.mockResolvedValue(null);

      const result = await serviceWithDb.getVersion('nonexistent');

      expect(result).toBeNull();
    });

    it('should return version from repository', async () => {
      const now = new Date();
      mockVersionRepo.findById.mockResolvedValue({
        id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
        definition: { endpoints: {} }, status: 'active', createdAt: now, deprecatedAt: null,
      });

      const result = await serviceWithDb.getVersion('v1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('v1');
      expect(result!.version).toBe('v1.0');
      expect(result!.status).toBe('active');
    });

    it('should map deprecatedAt correctly', async () => {
      const now = new Date();
      const deprecatedAt = new Date('2024-01-15');
      mockVersionRepo.findById.mockResolvedValue({
        id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
        definition: {}, status: 'deprecated', createdAt: now, deprecatedAt,
      });

      const result = await serviceWithDb.getVersion('v1');

      expect(result!.deprecatedAt).toBeDefined();
    });
  });

  describe('deprecateVersion', () => {
    it('should return null when no repository', async () => {
      const result = await service.deprecateVersion('v1');

      expect(result).toBeNull();
    });

    it('should return null when version not found', async () => {
      mockVersionRepo.updateStatus.mockResolvedValue(null);

      const result = await serviceWithDb.deprecateVersion('nonexistent');

      expect(result).toBeNull();
    });

    it('should deprecate version and return result', async () => {
      const now = new Date();
      const deprecatedAt = new Date();
      mockVersionRepo.updateStatus.mockResolvedValue({
        id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
        definition: {}, status: 'deprecated', createdAt: now, deprecatedAt,
      });

      const result = await serviceWithDb.deprecateVersion('v1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('deprecated');
      expect(mockVersionRepo.updateStatus).toHaveBeenCalledWith('v1', 'deprecated');
    });
  });

  describe('checkCompatibility', () => {
    it('should return null when version not found (no DB)', async () => {
      const result = await service.checkCompatibility('v1', {});

      expect(result).toBeNull();
    });

    it('should return null when version not found in DB', async () => {
      mockVersionRepo.findById.mockResolvedValue(null);

      const result = await serviceWithDb.checkCompatibility('nonexistent', {});

      expect(result).toBeNull();
    });

    it('should return compatible when no breaking changes', async () => {
      const now = new Date();
      mockVersionRepo.findById.mockResolvedValue({
        id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
        definition: {
          endpoints: {
            '/users': {
              get: { parameters: { id: 'string' } },
            },
          },
        },
        status: 'active', createdAt: now, deprecatedAt: null,
      });

      const result = await serviceWithDb.checkCompatibility('v1', {
        endpoints: {
          '/users': {
            get: { parameters: { id: 'string' } },
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result!.compatible).toBe(true);
      expect(result!.breakingChanges).toEqual([]);
      expect(result!.warnings).toEqual([]);
    });

    it('should detect removed endpoint', async () => {
      const now = new Date();
      mockVersionRepo.findById.mockResolvedValue({
        id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
        definition: {
          endpoints: {
            '/users': { get: {} },
            '/orders': { get: {} },
          },
        },
        status: 'active', createdAt: now, deprecatedAt: null,
      });

      const result = await serviceWithDb.checkCompatibility('v1', {
        endpoints: {
          '/users': { get: {} },
        },
      });

      expect(result!.compatible).toBe(false);
      expect(result!.breakingChanges.length).toBe(1);
      expect(result!.breakingChanges[0]).toContain('Endpoint removed: /orders');
    });

    it('should detect removed method', async () => {
      const now = new Date();
      mockVersionRepo.findById.mockResolvedValue({
        id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
        definition: {
          endpoints: {
            '/users': {
              get: {},
              post: {},
            },
          },
        },
        status: 'active', createdAt: now, deprecatedAt: null,
      });

      const result = await serviceWithDb.checkCompatibility('v1', {
        endpoints: {
          '/users': {
            get: {},
          },
        },
      });

      expect(result!.compatible).toBe(false);
      expect(result!.breakingChanges.length).toBe(1);
      expect(result!.breakingChanges[0]).toContain('Method removed: POST /users');
    });

    it('should detect removed required parameter', async () => {
      const now = new Date();
      mockVersionRepo.findById.mockResolvedValue({
        id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
        definition: {
          endpoints: {
            '/users': {
              get: { parameters: { id: 'string', name: 'string' } },
            },
          },
        },
        status: 'active', createdAt: now, deprecatedAt: null,
      });

      const result = await serviceWithDb.checkCompatibility('v1', {
        endpoints: {
          '/users': {
            get: { parameters: { id: 'string' } },
          },
        },
      });

      expect(result!.compatible).toBe(false);
      expect(result!.breakingChanges.length).toBe(1);
      expect(result!.breakingChanges[0]).toContain('Required parameter removed: name');
    });

    it('should detect new endpoint as warning', async () => {
      const now = new Date();
      mockVersionRepo.findById.mockResolvedValue({
        id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
        definition: {
          endpoints: {
            '/users': { get: {} },
          },
        },
        status: 'active', createdAt: now, deprecatedAt: null,
      });

      const result = await serviceWithDb.checkCompatibility('v1', {
        endpoints: {
          '/users': { get: {} },
          '/orders': { get: {} },
        },
      });

      expect(result!.compatible).toBe(true);
      expect(result!.breakingChanges).toEqual([]);
      expect(result!.warnings.length).toBe(1);
      expect(result!.warnings[0]).toContain('New endpoint added: /orders');
    });

    it('should handle empty definitions (no endpoints)', async () => {
      const now = new Date();
      mockVersionRepo.findById.mockResolvedValue({
        id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
        definition: {},
        status: 'active', createdAt: now, deprecatedAt: null,
      });

      const result = await serviceWithDb.checkCompatibility('v1', {});

      expect(result!.compatible).toBe(true);
      expect(result!.breakingChanges).toEqual([]);
      expect(result!.warnings).toEqual([]);
    });

    it('should handle multiple breaking changes', async () => {
      const now = new Date();
      mockVersionRepo.findById.mockResolvedValue({
        id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
        definition: {
          endpoints: {
            '/users': { get: { parameters: { id: 'string', name: 'string' } } },
            '/orders': { get: {} },
          },
        },
        status: 'active', createdAt: now, deprecatedAt: null,
      });

      const result = await serviceWithDb.checkCompatibility('v1', {
        endpoints: {
          '/users': { post: {} },
        },
      });

      // /orders endpoint removed + GET method removed from /users = 2 breaking changes
      // (parameters check only happens for methods present in both old and new)
      expect(result!.compatible).toBe(false);
      expect(result!.breakingChanges.length).toBeGreaterThanOrEqual(2);
    });

    it('should include checkedAt timestamp', async () => {
      const now = new Date();
      mockVersionRepo.findById.mockResolvedValue({
        id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
        definition: { endpoints: {} },
        status: 'active', createdAt: now, deprecatedAt: null,
      });

      const result = await serviceWithDb.checkCompatibility('v1', {});

      expect(result!.checkedAt).toBeDefined();
      expect(typeof result!.checkedAt).toBe('string');
    });
  });

  describe('deleteVersion', () => {
    it('should return false when no repository', async () => {
      const result = await service.deleteVersion('v1');

      expect(result).toBe(false);
    });

    it('should return true when version deleted successfully', async () => {
      mockVersionRepo.deleteVersion.mockResolvedValue(true);

      const result = await serviceWithDb.deleteVersion('v1');

      expect(result).toBe(true);
    });

    it('should return false when version not found', async () => {
      mockVersionRepo.deleteVersion.mockResolvedValue(false);

      const result = await serviceWithDb.deleteVersion('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getVersionsByTenant', () => {
    it('should return empty array when no repository', async () => {
      const result = await service.getVersionsByTenant('tenant1');

      expect(result).toEqual([]);
    });

    it('should return versions from repository', async () => {
      const now = new Date();
      mockVersionRepo.findByTenant.mockResolvedValue([
        {
          id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
          definition: {}, status: 'active', createdAt: now, deprecatedAt: null,
        },
        {
          id: 'v2', tenantId: 'tenant1', apiId: 'api2', version: 'v1.0',
          definition: {}, status: 'deprecated', createdAt: now, deprecatedAt: new Date(),
        },
      ]);

      const result = await serviceWithDb.getVersionsByTenant('tenant1');

      expect(result.length).toBe(2);
      expect(result[0].tenantId).toBe('tenant1');
      expect(result[1].status).toBe('deprecated');
    });

    it('should return empty array when no versions for tenant', async () => {
      mockVersionRepo.findByTenant.mockResolvedValue([]);

      const result = await serviceWithDb.getVersionsByTenant('tenant1');

      expect(result).toEqual([]);
    });

    it('should correctly map deprecatedAt for null values', async () => {
      const now = new Date();
      mockVersionRepo.findByTenant.mockResolvedValue([
        {
          id: 'v1', tenantId: 'tenant1', apiId: 'api1', version: 'v1.0',
          definition: {}, status: 'active', createdAt: now, deprecatedAt: null,
        },
      ]);

      const result = await serviceWithDb.getVersionsByTenant('tenant1');

      expect(result[0].deprecatedAt).toBeUndefined();
    });
  });
});
