/**
 * AuditMiddleware 单元测试
 */

import { auditGuard, setAuditService, getAuditService } from '../auditMiddleware';
import { AuditService } from '../AuditService';
import { AuditRepository } from '../AuditRepository';

// Mock AuditService
const mockAuditService = {
  createAuditLog: jest.fn(),
} as unknown as AuditService;

describe('auditMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuditService(null);
  });

  afterEach(() => {
    setAuditService(null);
  });

  describe('setAuditService / getAuditService', () => {
    it('应该设置和获取 AuditService', () => {
      setAuditService(mockAuditService);
      expect(getAuditService()).toBe(mockAuditService);
    });

    it('初始状态应为 null', () => {
      expect(getAuditService()).toBeNull();
    });

    it('应该能替换已设置的 AuditService', () => {
      const anotherService = { createAuditLog: jest.fn() } as unknown as AuditService;
      setAuditService(mockAuditService);
      setAuditService(anotherService);
      expect(getAuditService()).toBe(anotherService);
    });
  });

  describe('auditGuard', () => {
    it('应该创建带有 resourceType 的审计中间件', () => {
      const guard = auditGuard({ resourceType: 'pipeline' });
      expect(typeof guard).toBe('function');
    });

    it('应该跳过未启用审计的请求', async () => {
      setAuditService(mockAuditService);
      const guard = auditGuard({ resourceType: 'pipeline', enabled: false });

      const mockRequest = { method: 'POST', url: '/pipelines', ip: '127.0.0.1', params: {}, body: { name: 'test' }, headers: {} } as any;
      const mockReply = { statusCode: 201 } as any;

      await guard(mockRequest, mockReply);

      expect(mockAuditService.createAuditLog).not.toHaveBeenCalled();
    });

    it('应该跳过 GET 请求', async () => {
      setAuditService(mockAuditService);
      const guard = auditGuard({ resourceType: 'pipeline' });

      const mockRequest = { method: 'GET', url: '/pipelines/1', ip: '127.0.0.1', params: { id: '1' }, body: undefined, headers: {} } as any;
      const mockReply = { statusCode: 200 } as any;

      await guard(mockRequest, mockReply);

      expect(mockAuditService.createAuditLog).not.toHaveBeenCalled();
    });

    it('应该记录 POST 请求（CREATE）', async () => {
      setAuditService(mockAuditService);
      const guard = auditGuard({ resourceType: 'pipeline' });

      const mockRequest = {
        method: 'POST',
        url: '/pipelines',
        ip: '127.0.0.1',
        params: {},
        body: { name: 'new-pipeline' },
        headers: { 'user-agent': 'test-agent' },
        user: { userId: 'user-1', tenantId: 'tenant-1' },
      } as any;
      const mockReply = { statusCode: 201 } as any;

      await guard(mockRequest, mockReply);

      // setImmediate 异步写入，需要等待
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-1',
          user_id: 'user-1',
          action: 'CREATE',
          resource_type: 'pipeline',
          resource_id: undefined,
          request_method: 'POST',
          request_path: '/pipelines',
          response_code: 201,
          ip_address: '127.0.0.1',
          user_agent: 'test-agent',
        })
      );
    });

    it('应该记录 DELETE 请求', async () => {
      setAuditService(mockAuditService);
      const guard = auditGuard({ resourceType: 'pipeline' });

      const mockRequest = {
        method: 'DELETE',
        url: '/pipelines/123',
        ip: '10.0.0.1',
        params: { id: '123' },
        body: undefined,
        headers: { 'user-agent': 'test-agent' },
        user: { userId: 'user-2', tenantId: 'tenant-1' },
      } as any;
      const mockReply = { statusCode: 204 } as any;

      await guard(mockRequest, mockReply);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          resource_type: 'pipeline',
          resource_id: '123',
        })
      );
    });

    it('应该记录 PUT 请求（UPDATE）', async () => {
      setAuditService(mockAuditService);
      const guard = auditGuard({ resourceType: 'config' });

      const mockRequest = {
        method: 'PUT',
        url: '/config/456',
        ip: '127.0.0.1',
        params: { id: '456' },
        body: { key: 'updated-value' },
        headers: {},
        user: { userId: 'user-3', tenantId: 'tenant-1' },
      } as any;
      const mockReply = { statusCode: 200 } as any;

      await guard(mockRequest, mockReply);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          resource_type: 'config',
          resource_id: '456',
        })
      );
    });

    it('AuditService 未初始化时应跳过并警告', async () => {
      setAuditService(null);
      const guard = auditGuard({ resourceType: 'pipeline' });

      const mockRequest = {
        method: 'POST',
        url: '/pipelines',
        ip: '127.0.0.1',
        params: {},
        body: undefined,
        headers: {},
        user: { userId: 'user-1', tenantId: 'tenant-1' },
      } as any;
      const mockReply = { statusCode: 201 } as any;

      // 不应抛出异常
      await expect(guard(mockRequest, mockReply)).resolves.toBeUndefined();
    });

    it('审计日志写入失败不应影响主请求', async () => {
      const failingService = {
        createAuditLog: jest.fn().mockRejectedValue(new Error('DB error')),
      } as unknown as AuditService;
      setAuditService(failingService);
      const guard = auditGuard({ resourceType: 'pipeline' });

      const mockRequest = {
        method: 'POST',
        url: '/pipelines',
        ip: '127.0.0.1',
        params: {},
        body: undefined,
        headers: {},
        user: { userId: 'user-1', tenantId: 'tenant-1' },
      } as any;
      const mockReply = { statusCode: 201 } as any;

      // 主请求不应被审计错误影响
      await expect(guard(mockRequest, mockReply)).resolves.toBeUndefined();
    });

    it('应该使用 default 租户 ID 当用户无 tenantId', async () => {
      setAuditService(mockAuditService);
      const guard = auditGuard({ resourceType: 'pipeline' });

      const mockRequest = {
        method: 'POST',
        url: '/pipelines',
        ip: '127.0.0.1',
        params: {},
        body: undefined,
        headers: {},
        user: { userId: 'user-1' }, // 无 tenantId
      } as any;
      const mockReply = { statusCode: 201 } as any;

      await guard(mockRequest, mockReply);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'default',
        })
      );
    });

    it('应该使用自定义 skipMethods', async () => {
      setAuditService(mockAuditService);
      const guard = auditGuard({ resourceType: 'pipeline', skipMethods: ['GET', 'POST'] });

      const mockRequest = {
        method: 'POST',
        url: '/pipelines',
        ip: '127.0.0.1',
        params: {},
        body: undefined,
        headers: {},
        user: { userId: 'user-1', tenantId: 'tenant-1' },
      } as any;
      const mockReply = { statusCode: 201 } as any;

      await guard(mockRequest, mockReply);

      expect(mockAuditService.createAuditLog).not.toHaveBeenCalled();
    });
  });
});