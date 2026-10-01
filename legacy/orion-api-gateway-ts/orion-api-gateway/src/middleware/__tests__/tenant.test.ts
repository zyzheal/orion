/**
 * 多租户解析中间件单元测试
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TenantMiddleware, TenantContext, TenantTier, DEFAULT_QUOTAS } from '../tenant';

// Mock Redis module
jest.mock('../../utils/redis', () => ({
  redisClient: {
    getClient: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
  },
}));

import { redisClient } from '../../utils/redis';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
};

// Mock Fastify 应用
const mockApp = {
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
} as unknown as FastifyInstance;

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    middleware = new TenantMiddleware(mockApp);

    mockRequest = {
      headers: {},
      raw: {
        url: '/api/v1/workflows',
      },
    } as Partial<FastifyRequest>;

    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn(),
      header: jest.fn(),
    } as Partial<FastifyReply>;

    jest.clearAllMocks();
  });

  describe('extractTenantId', () => {
    it('应该从 X-Tenant-ID Header 提取租户 ID', () => {
      mockRequest.headers = { 'x-tenant-id': 't001' };

      // 使用反射访问私有方法
      const extractMethod = (middleware as any).extractTenantId.bind(middleware);
      const result = extractMethod(mockRequest);

      expect(result).toBe('t001');
    });

    it('应该从 JWT Claim 提取租户 ID', () => {
      mockRequest.headers = {};
      (mockRequest as any).authContext = {
        user: { tenant_id: 't002' },
      };

      const extractMethod = (middleware as any).extractTenantId.bind(middleware);
      const result = extractMethod(mockRequest);

      expect(result).toBe('t002');
    });

    it('应该从子域名提取租户 ID', () => {
      mockRequest.headers = { host: 'team-alpha.orion.com' };
      (mockRequest as any).authContext = null;

      const extractMethod = (middleware as any).extractTenantId.bind(middleware);
      const result = extractMethod(mockRequest);

      expect(result).toBe('team-alpha');
    });

    it('当没有租户 ID 时返回 null', () => {
      mockRequest.headers = { host: 'api.orion.com' };
      (mockRequest as any).authContext = null;

      const extractMethod = (middleware as any).extractTenantId.bind(middleware);
      const result = extractMethod(mockRequest);

      expect(result).toBeNull();
    });
  });

  describe('getNamespacePoolId', () => {
    it('应该正确计算 Namespace Pool ID（租户 1-10）', () => {
      const getPoolMethod = (middleware as any).getNamespacePoolId.bind(middleware);

      expect(getPoolMethod('t001')).toBe('orion-tenant-pool-001');
      expect(getPoolMethod('t010')).toBe('orion-tenant-pool-001');
    });

    it('应该正确计算 Namespace Pool ID（租户 11-20）', () => {
      const getPoolMethod = (middleware as any).getNamespacePoolId.bind(middleware);

      expect(getPoolMethod('t011')).toBe('orion-tenant-pool-002');
      expect(getPoolMethod('t020')).toBe('orion-tenant-pool-002');
    });

    it('应该正确计算 Namespace Pool ID（租户 991-1000）', () => {
      const getPoolMethod = (middleware as any).getNamespacePoolId.bind(middleware);

      expect(getPoolMethod('t991')).toBe('orion-tenant-pool-100');
      expect(getPoolMethod('t1000')).toBe('orion-tenant-pool-100');
    });

    it('对于非标准格式的租户 ID 返回默认 Pool', () => {
      const getPoolMethod = (middleware as any).getNamespacePoolId.bind(middleware);

      expect(getPoolMethod('team-alpha')).toBe('orion-tenant-pool-001');
    });
  });

  describe('handler - 公开路径', () => {
    it('应该跳过公开路径的租户解析', async () => {
      (mockRequest as any).raw = { url: '/healthz' };

      await middleware.handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('应该跳过认证路径的租户解析', async () => {
      (mockRequest as any).raw = { url: '/api/v1/auth/login' };

      await middleware.handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });
  });

  describe('handler - 租户 ID 验证', () => {
    it('当缺少租户 ID 时返回 400 错误', async () => {
      mockRequest.headers = {};
      (mockRequest as any).authContext = null;

      await middleware.handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'TENANT_ID_MISSING',
        })
      );
    });

    it('当租户 ID 格式无效时返回 400 错误', async () => {
      mockRequest.headers = { 'x-tenant-id': 'invalid@tenant' };

      await middleware.handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_TENANT_ID',
        })
      );
    });
  });

  describe('checkTenantStatus', () => {
    it('当租户状态为 deleted 时抛出错误', () => {
      const context: TenantContext = {
        tenantId: 't001',
        namespacePoolId: 'orion-tenant-pool-001',
        tier: 'standard',
        quota: DEFAULT_QUOTAS.standard,
        status: 'deleted',
      };

      const checkMethod = (middleware as any).checkTenantStatus.bind(middleware);

      expect(() => checkMethod(context)).toThrow('租户已被删除');
    });

    it('当租户状态为 suspended 时抛出错误', () => {
      const context: TenantContext = {
        tenantId: 't001',
        namespacePoolId: 'orion-tenant-pool-001',
        tier: 'standard',
        quota: DEFAULT_QUOTAS.standard,
        status: 'suspended',
      };

      const checkMethod = (middleware as any).checkTenantStatus.bind(middleware);

      expect(() => checkMethod(context)).toThrow('租户已被暂停');
    });

    it('当租户已过期时抛出错误', () => {
      const context: TenantContext = {
        tenantId: 't001',
        namespacePoolId: 'orion-tenant-pool-001',
        tier: 'standard',
        quota: DEFAULT_QUOTAS.standard,
        status: 'active',
        expiresAt: new Date('2020-01-01'),
      };

      const checkMethod = (middleware as any).checkTenantStatus.bind(middleware);

      expect(() => checkMethod(context)).toThrow('租户已过期');
    });

    it('当租户状态正常时不抛出错误', () => {
      const context: TenantContext = {
        tenantId: 't001',
        namespacePoolId: 'orion-tenant-pool-001',
        tier: 'standard',
        quota: DEFAULT_QUOTAS.standard,
        status: 'active',
      };

      const checkMethod = (middleware as any).checkTenantStatus.bind(middleware);

      expect(() => checkMethod(context)).not.toThrow();
    });
  });

  describe('clearCache', () => {
    it('清除单个租户缓存', () => {
      middleware.updateCache('t001', {
        tenantId: 't001',
        namespacePoolId: 'orion-tenant-pool-001',
        tier: 'standard',
        quota: DEFAULT_QUOTAS.standard,
        status: 'active',
      });

      middleware.clearCache('t001');

      const context = middleware.getTenantContext({} as FastifyRequest);
      expect(context).toBeUndefined();
    });

    it('清除所有租户缓存', () => {
      middleware.updateCache('t001', {
        tenantId: 't001',
        namespacePoolId: 'orion-tenant-pool-001',
        tier: 'standard',
        quota: DEFAULT_QUOTAS.standard,
        status: 'active',
      });

      middleware.updateCache('t002', {
        tenantId: 't002',
        namespacePoolId: 'orion-tenant-pool-001',
        tier: 'standard',
        quota: DEFAULT_QUOTAS.standard,
        status: 'active',
      });

      middleware.clearCache();

      const context = middleware.getTenantContext({} as FastifyRequest);
      expect(context).toBeUndefined();
    });
  });

  describe('辅助函数', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getTenantId, getTenantContext, isTenantTier, hasQuota } = require('../tenant');

    beforeEach(() => {
      jest.resetModules();
    });

    it('getTenantId 应该返回租户 ID', () => {
      const mockRequestWithContext = {
        tenantContext: {
          tenantId: 't001',
          namespacePoolId: 'orion-tenant-pool-001',
          tier: 'standard' as TenantTier,
          quota: DEFAULT_QUOTAS.standard,
          status: 'active',
        } as TenantContext,
      };

      expect(getTenantId(mockRequestWithContext as unknown as FastifyRequest)).toBe('t001');
    });

    it('isTenantTier 应该正确判断租户等级', () => {
      const createRequest = (tier: TenantTier) => ({
        tenantContext: {
          tenantId: 't001',
          namespacePoolId: 'orion-tenant-pool-001',
          tier,
          quota: DEFAULT_QUOTAS[tier],
          status: 'active',
        } as TenantContext,
      });

      expect(isTenantTier(createRequest('premium'), 'standard')).toBe(true);
      expect(isTenantTier(createRequest('standard'), 'premium')).toBe(false);
      expect(isTenantTier(createRequest('standard'), 'standard')).toBe(true);
    });

    it('hasQuota 应该正确检查配额', () => {
      const mockRequestWithContext = {
        tenantContext: {
          tenantId: 't001',
          namespacePoolId: 'orion-tenant-pool-001',
          tier: 'standard' as TenantTier,
          quota: DEFAULT_QUOTAS.standard,
          status: 'active',
        } as TenantContext,
      };

      expect(hasQuota(mockRequestWithContext as unknown as FastifyRequest, 'concurrentRunners', 5)).toBe(true);
      expect(hasQuota(mockRequestWithContext as unknown as FastifyRequest, 'concurrentRunners', 10)).toBe(false);
    });
  });
});

describe('TenantMiddleware - 集成测试', () => {
  let middleware: TenantMiddleware;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    middleware = new TenantMiddleware(mockApp);

    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn(),
      header: jest.fn(),
    } as Partial<FastifyReply>;
  });

  it('完整的租户解析流程', async () => {
    const mockRequest: Partial<FastifyRequest> = {
      headers: { 'x-tenant-id': 't005' },
      raw: { url: '/api/v1/workflows' } as any,
    };

    // Mock Redis 返回租户信息
    (redisClient.getClient as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue(JSON.stringify({
        tenantId: 't005',
        tenantName: 'Test Team',
        namespacePoolId: 'orion-tenant-pool-001',
        tier: 'standard',
        quota: DEFAULT_QUOTAS.standard,
        status: 'active',
      })),
    });

    await middleware.handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

    // 验证租户上下文已设置
    const context = middleware.getTenantContext(mockRequest as FastifyRequest);
    expect(context).toBeDefined();
    expect(context?.tenantId).toBe('t005');
    expect(context?.namespacePoolId).toBe('orion-tenant-pool-001');
  });
});
