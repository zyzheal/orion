/**
 * TenantMiddleware Tests
 *
 * Covers:
 * - createTenantMiddleware: skip paths, disabled, required tenant, JWT extraction, header extraction
 * - createTenantDatabaseHook: with/without RLS manager, db errors
 * - createTenantDatabaseCleanupHook: with/without RLS manager
 * - createTenantCleanupHook: clears tenant context
 * - requireTenantMatch: delegates to tenantContext
 */

import {
  createTenantMiddleware,
  createTenantDatabaseHook,
  createTenantDatabaseCleanupHook,
  createTenantCleanupHook,
  requireTenantMatch,
} from '../TenantMiddleware';
import { tenantContext } from '../TenantContext';

jest.mock('pino', () => {
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return jest.fn(() => mockLogger);
});

// Mock tenantContext
jest.mock('../TenantContext', () => {
  const actual = jest.requireActual('../TenantContext');
  return {
    ...actual,
    tenantContext: {
      isEnabled: jest.fn().mockReturnValue(true),
      getCurrentTenant: jest.fn(),
      setTenant: jest.fn(),
      clearTenant: jest.fn(),
      validateTenantAccess: jest.fn(),
      generateSessionSetSQL: jest.fn().mockReturnValue('SET app.current_tenant_id = 1'),
    },
  };
});

describe('TenantMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTenantMiddleware', () => {
    function createMockRequest(url: string, headers: Record<string, string> = {}, user?: any) {
      return { url, headers, user } as any;
    }

    function createMockReply() {
      const reply: any = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
      return reply;
    }

    it('should skip health check paths', async () => {
      const middleware = createTenantMiddleware();
      const request = createMockRequest('/healthz');
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(done).toHaveBeenCalled();
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('should skip readyz path', async () => {
      const middleware = createTenantMiddleware();
      const request = createMockRequest('/readyz');
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(done).toHaveBeenCalled();
    });

    it('should skip version path', async () => {
      const middleware = createTenantMiddleware();
      const request = createMockRequest('/version');
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(done).toHaveBeenCalled();
    });

    it('should skip custom paths', async () => {
      const middleware = createTenantMiddleware({ skipPaths: ['/api/v1/custom'] });
      const request = createMockRequest('/api/v1/custom/resource');
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(done).toHaveBeenCalled();
    });

    it('should pass through when middleware is disabled', async () => {
      const middleware = createTenantMiddleware({ enabled: false });
      const request = createMockRequest('/api/v1/test', {});
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(done).toHaveBeenCalled();
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('should return 401 when tenant is required but not provided', async () => {
      const middleware = createTenantMiddleware({ required: true });
      const request = createMockRequest('/api/v1/test', {});
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: 'MISSING_TENANT',
      }));
      expect(done).not.toHaveBeenCalled();
    });

    it('should extract tenant from JWT user object', async () => {
      const middleware = createTenantMiddleware();
      const request = createMockRequest('/api/v1/test', {}, {
        tenant_id: 5,
        userId: 'user-123',
        roles: ['admin'],
        permissions: ['read', 'write'],
      });
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(tenantContext.setTenant).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 5,
        userId: 'user-123',
        roles: ['admin'],
        permissions: ['read', 'write'],
      }));
      expect(request.tenant).toBeDefined();
      expect(done).toHaveBeenCalled();
    });

    it('should extract tenant from header', async () => {
      const middleware = createTenantMiddleware();
      const request = createMockRequest('/api/v1/test', { 'x-tenant-id': '10', 'x-user-id': 'user-456' });
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(tenantContext.setTenant).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 10,
        userId: 'user-456',
      }));
      expect(done).toHaveBeenCalled();
    });

    it('should use custom header name', async () => {
      const middleware = createTenantMiddleware({ headerName: 'x-org-id' });
      const request = createMockRequest('/api/v1/test', { 'x-org-id': '7' });
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(tenantContext.setTenant).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 7,
      }));
    });

    it('should not set tenant context when tenant is not required and not provided', async () => {
      const middleware = createTenantMiddleware({ required: false });
      const request = createMockRequest('/api/v1/test', {});
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(tenantContext.setTenant).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalled();
    });

    it('should ignore invalid tenant header values', async () => {
      const middleware = createTenantMiddleware({ required: false });
      const request = createMockRequest('/api/v1/test', { 'x-tenant-id': 'invalid' });
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(tenantContext.setTenant).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalled();
    });

    it('should prefer JWT tenant over header tenant', async () => {
      const middleware = createTenantMiddleware();
      const request = createMockRequest('/api/v1/test', { 'x-tenant-id': '99' }, {
        tenant_id: 5,
      });
      const reply = createMockReply();
      const done = jest.fn();

      await middleware(request, reply, done);

      expect(tenantContext.setTenant).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 5,
      }));
    });
  });

  describe('createTenantDatabaseHook', () => {
    it('should set session variable using RLS manager', async () => {
      const mockRls = { setTenantSessionVariable: jest.fn().mockResolvedValue({ success: true }) };
      const mockDb = { query: jest.fn() };
      (tenantContext.isEnabled as jest.Mock).mockReturnValue(true);
      (tenantContext.getCurrentTenant as jest.Mock).mockReturnValue({ tenantId: 1 });

      const hook = createTenantDatabaseHook(mockDb, mockRls as any);
      await hook({} as any, {} as any);

      expect(mockRls.setTenantSessionVariable).toHaveBeenCalledWith(1);
    });

    it('should fallback to direct SQL when no RLS manager', async () => {
      const mockDb = { query: jest.fn().mockResolvedValue({ rows: [] }) };
      (tenantContext.isEnabled as jest.Mock).mockReturnValue(true);
      (tenantContext.getCurrentTenant as jest.Mock).mockReturnValue({ tenantId: 1 });
      (tenantContext.generateSessionSetSQL as jest.Mock).mockReturnValue("SET app.current_tenant_id = '1'");

      const hook = createTenantDatabaseHook(mockDb);
      await hook({} as any, {} as any);

      expect(mockDb.query).toHaveBeenCalledWith("SET app.current_tenant_id = '1'");
    });

    it('should not set session when tenant context is disabled', async () => {
      const mockRls = { setTenantSessionVariable: jest.fn() };
      const mockDb = { query: jest.fn() };
      (tenantContext.isEnabled as jest.Mock).mockReturnValue(false);

      const hook = createTenantDatabaseHook(mockDb, mockRls as any);
      await hook({} as any, {} as any);

      expect(mockRls.setTenantSessionVariable).not.toHaveBeenCalled();
    });

    it('should not throw on database error', async () => {
      const mockDb = { query: jest.fn().mockRejectedValue(new Error('connection lost')) };
      (tenantContext.isEnabled as jest.Mock).mockReturnValue(true);
      (tenantContext.getCurrentTenant as jest.Mock).mockReturnValue({ tenantId: 1 });

      const hook = createTenantDatabaseHook(mockDb);
      await expect(hook({} as any, {} as any)).resolves.toBeUndefined();
    });
  });

  describe('createTenantDatabaseCleanupHook', () => {
    it('should clear session using RLS manager', async () => {
      const mockRls = { clearTenantSessionVariable: jest.fn().mockResolvedValue(undefined) };
      (tenantContext.isEnabled as jest.Mock).mockReturnValue(true);

      const hook = createTenantDatabaseCleanupHook(mockRls as any);
      await hook({} as any, {} as any);

      expect(mockRls.clearTenantSessionVariable).toHaveBeenCalled();
      expect(tenantContext.clearTenant).toHaveBeenCalled();
    });

    it('should clear tenant context even without RLS manager', async () => {
      (tenantContext.isEnabled as jest.Mock).mockReturnValue(true);

      const hook = createTenantDatabaseCleanupHook();
      await hook({} as any, {} as any);

      expect(tenantContext.clearTenant).toHaveBeenCalled();
    });

    it('should not clear when context is disabled', async () => {
      (tenantContext.isEnabled as jest.Mock).mockReturnValue(false);

      const hook = createTenantDatabaseCleanupHook();
      await hook({} as any, {} as any);

      expect(tenantContext.clearTenant).not.toHaveBeenCalled();
    });

    it('should not throw on cleanup error', async () => {
      const mockRls = { clearTenantSessionVariable: jest.fn().mockRejectedValue(new Error('fail')) };
      (tenantContext.isEnabled as jest.Mock).mockReturnValue(true);

      const hook = createTenantDatabaseCleanupHook(mockRls as any);
      await expect(hook({} as any, {} as any)).resolves.toBeUndefined();
    });
  });

  describe('createTenantCleanupHook', () => {
    it('should clear tenant context', async () => {
      const hook = createTenantCleanupHook();
      await hook({} as any, {} as any);

      expect(tenantContext.clearTenant).toHaveBeenCalled();
    });
  });

  describe('requireTenantMatch', () => {
    it('should delegate to tenantContext.validateTenantAccess', () => {
      (tenantContext.validateTenantAccess as jest.Mock).mockReturnValue(true);

      const result = requireTenantMatch(5);

      expect(tenantContext.validateTenantAccess).toHaveBeenCalledWith(5);
      expect(result).toBe(true);
    });

    it('should return false when validation fails', () => {
      (tenantContext.validateTenantAccess as jest.Mock).mockReturnValue(false);

      const result = requireTenantMatch(99);

      expect(result).toBe(false);
    });
  });
});
