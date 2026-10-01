/**
 * 租户管理路由单元测试
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  TenantManagementService,
  TenantRoutes,
  CreateTenantRequest,
  UpdateTenantRequest,
} from '../tenant.routes';
import { redisClient } from '../../utils/redis';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
  incr: jest.fn(),
} as any;

// Mock Fastify 应用
const mockApp = {
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
} as any;

describe('TenantManagementService', () => {
  let service: TenantManagementService;

  beforeEach(() => {
    service = new TenantManagementService();
    service.setRedisClient(mockRedis);
    jest.clearAllMocks();
  });

  describe('createTenant', () => {
    it('应该成功创建租户', async () => {
      // Mock Redis 响应
      mockRedis.exists.mockResolvedValue(0); // 名称不存在
      mockRedis.incr.mockResolvedValue(5); // 租户序号
      mockRedis.set.mockResolvedValue('OK');

      const requestData: CreateTenantRequest = {
        name: 'test-team',
        displayName: 'Test Team',
        tier: 'standard',
        ownerEmail: 'test@example.com',
      };

      const tenant = await service.createTenant(requestData);

      expect(tenant).toBeDefined();
      expect(tenant.name).toBe('test-team');
      expect(tenant.tier).toBe('standard');
      expect(tenant.status).toBe('active');
      expect(tenant.namespacePoolId).toMatch(/orion-tenant-pool-\d{3}/);
    });

    it('当租户名称已存在时抛出错误', async () => {
      mockRedis.exists.mockResolvedValue(1); // 名称已存在

      const requestData: CreateTenantRequest = {
        name: 'existing-team',
      };

      await expect(service.createTenant(requestData)).rejects.toThrow();
    });
  });

  describe('getTenant', () => {
    it('应该获取租户信息', async () => {
      const mockTenant = {
        id: 't005',
        name: 'test-team',
        displayName: 'Test Team',
        tier: 'standard',
        status: 'active',
        namespacePoolId: 'orion-tenant-pool-001',
        ownerEmail: 'test@example.com',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockTenant));

      const tenant = await service.getTenant('t005');

      expect(tenant).toBeDefined();
      expect(tenant?.id).toBe('t005');
      expect(tenant?.name).toBe('test-team');
    });

    it('当租户不存在时返回 null', async () => {
      mockRedis.get.mockResolvedValue(null);

      const tenant = await service.getTenant('t999');

      expect(tenant).toBeNull();
    });
  });

  describe('listTenants', () => {
    it('应该获取租户列表', async () => {
      mockRedis.keys.mockResolvedValue(['tenant:info:t001', 'tenant:info:t002']);
      mockRedis.get
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 't001',
            name: 'team-1',
            tier: 'standard',
            status: 'active',
            namespacePoolId: 'orion-tenant-pool-001',
            createdAt: '2026-01-01T00:00:00Z',
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 't002',
            name: 'team-2',
            tier: 'premium',
            status: 'active',
            namespacePoolId: 'orion-tenant-pool-001',
            createdAt: '2026-01-01T00:00:00Z',
          })
        );

      const result = await service.listTenants();

      expect(result.tenants).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('应该支持状态过滤', async () => {
      mockRedis.keys.mockResolvedValue(['tenant:info:t001', 'tenant:info:t002']);
      mockRedis.get
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 't001',
            name: 'team-1',
            tier: 'standard',
            status: 'active',
            namespacePoolId: 'orion-tenant-pool-001',
            createdAt: '2026-01-01T00:00:00Z',
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 't002',
            name: 'team-2',
            tier: 'premium',
            status: 'suspended',
            namespacePoolId: 'orion-tenant-pool-001',
            createdAt: '2026-01-01T00:00:00Z',
          })
        );

      const result = await service.listTenants({ status: 'active' });

      expect(result.tenants).toHaveLength(1);
      expect(result.tenants[0].status).toBe('active');
    });
  });

  describe('updateTenant', () => {
    it('应该更新租户信息', async () => {
      const existingTenant = {
        id: 't005',
        name: 'test-team',
        displayName: 'Test Team',
        tier: 'standard' as const,
        status: 'active' as const,
        namespacePoolId: 'orion-tenant-pool-001',
        createdAt: '2026-01-01T00:00:00Z',
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingTenant));
      mockRedis.set.mockResolvedValue('OK');

      const updateData: UpdateTenantRequest = {
        displayName: 'Updated Team Name',
      };

      const updated = await service.updateTenant('t005', updateData);

      expect(updated.displayName).toBe('Updated Team Name');
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('当租户不存在时抛出错误', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const updateData: UpdateTenantRequest = {
        name: 'new-name',
      };

      await expect(service.updateTenant('t999', updateData)).rejects.toThrow();
    });
  });

  describe('deleteTenant', () => {
    it('应该软删除租户', async () => {
      const existingTenant = {
        id: 't005',
        name: 'test-team',
        tier: 'standard' as const,
        status: 'active' as const,
        namespacePoolId: 'orion-tenant-pool-001',
        createdAt: '2026-01-01T00:00:00Z',
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingTenant));
      mockRedis.set.mockResolvedValue('OK');

      await service.deleteTenant('t005');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'tenant:info:t005',
        expect.stringContaining('"status":"deleted"')
      );
    });
  });

  describe('suspendTenant', () => {
    it('应该暂停租户', async () => {
      const existingTenant = {
        id: 't005',
        name: 'test-team',
        tier: 'standard' as const,
        status: 'active' as const,
        namespacePoolId: 'orion-tenant-pool-001',
        createdAt: '2026-01-01T00:00:00Z',
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingTenant));
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.suspendTenant('t005');

      expect(result.status).toBe('suspended');
    });
  });

  describe('activateTenant', () => {
    it('应该激活租户', async () => {
      const existingTenant = {
        id: 't005',
        name: 'test-team',
        tier: 'standard' as const,
        status: 'suspended' as const,
        namespacePoolId: 'orion-tenant-pool-001',
        createdAt: '2026-01-01T00:00:00Z',
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingTenant));
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.activateTenant('t005');

      expect(result.status).toBe('active');
    });
  });
});

describe('TenantRoutes', () => {
  let routes: TenantRoutes;

  beforeEach(() => {
    routes = new TenantRoutes(mockApp);
    jest.clearAllMocks();
  });

  it('应该注册所有租户管理路由', () => {
    routes.register();

    expect(mockApp.post).toHaveBeenCalledWith(
      '/api/v1/tenants',
      expect.objectContaining({ schema: expect.any(Object) }),
      expect.any(Function)
    );

    expect(mockApp.get).toHaveBeenCalledWith('/api/v1/tenants', expect.any(Function));
    expect(mockApp.get).toHaveBeenCalledWith('/api/v1/tenants/:id', expect.any(Function));

    expect(mockApp.put).toHaveBeenCalledWith(
      '/api/v1/tenants/:id',
      expect.objectContaining({ schema: expect.any(Object) }),
      expect.any(Function)
    );

    expect(mockApp.delete).toHaveBeenCalledWith('/api/v1/tenants/:id', expect.any(Function));
    expect(mockApp.post).toHaveBeenCalledWith('/api/v1/tenants/:id/suspend', expect.any(Function));
    expect(mockApp.post).toHaveBeenCalledWith('/api/v1/tenants/:id/activate', expect.any(Function));
    expect(mockApp.get).toHaveBeenCalledWith('/api/v1/tenants/:id/quota', expect.any(Function));
    expect(mockApp.post).toHaveBeenCalledWith(
      '/api/v1/tenants/:id/quota',
      expect.objectContaining({ schema: expect.any(Object) }),
      expect.any(Function)
    );
  });
});
