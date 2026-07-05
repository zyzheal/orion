/**
 * @file Tests for UnifiedAuthMiddleware
 * Verifies: unified auth factory, backward-compatible wrappers, all permission types
 */

import {
  unifiedAuth,
  unifiedJwtAuth,
  unifiedRoleGuard,
  unifiedPermissionAuth,
  unifiedCapabilityCheck,
  unifiedTenantGuard,
  setUnifiedAuthzEngine,
  setUnifiedCapabilityService,
} from '../UnifiedAuthMiddleware';
import { jwtAuth, initJwtAuth, optionalJwtAuth } from '../jwtAuth';
import jwt from 'jsonwebtoken';

// Ensure JWT_SECRET is set
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';

// Mock jwtKeyManager
jest.mock('../../services/auth/JwtKeyManager', () => ({
  jwtKeyManager: {
    getCurrentSecret: jest.fn(),
  },
}));

import { jwtKeyManager } from '../../services/auth/JwtKeyManager';
const mockGetCurrentSecret = (jwtKeyManager as any).getCurrentSecret;

// Mock TokenBlacklistService
const mockIsRevoked = jest.fn();
const mockTokenBlacklist = {
  isRevoked: mockIsRevoked,
};

// Mock DatabasePool
const mockQuery = jest.fn();
const mockDbPool = {
  query: mockQuery,
};

const mockRequest = (headers: Record<string, string | undefined>, user?: any, params: Record<string, string> = {}) =>
  ({ headers, user, params, log: { warn: jest.fn(), error: jest.fn() } }) as any;

const createMockReply = () => {
  const sendMock = jest.fn();
  const codeMock = jest.fn(() => ({ send: sendMock }));
  const reply = { code: codeMock, send: sendMock };
  return { reply };
};

// Mock CapabilityService
const mockCheckPermission = jest.fn();
const mockCapabilityService = {
  checkPermission: mockCheckPermission,
};

// Mock AuthorizationEngine
const mockEvaluate = jest.fn();
const mockAuthzEngine = {
  evaluate: mockEvaluate,
};

describe('UnifiedAuthMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSecret.mockReturnValue('test-jwt-secret-for-testing');
    mockIsRevoked.mockResolvedValueOnce(false);
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'active' }] });

    // Initialize underlying services
    initJwtAuth(mockTokenBlacklist as any, mockDbPool as any);
    setUnifiedAuthzEngine(mockAuthzEngine as any);
    setUnifiedCapabilityService(mockCapabilityService as any);
  });

  describe('unifiedJwtAuth (backward compatible)', () => {
    test('allows valid JWT token', async () => {
      const token = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const { reply } = createMockReply();

      await unifiedJwtAuth(req, reply);

      expect(req.user).toEqual(
        expect.objectContaining({
          userId: '1',
          username: 'user',
          roles: ['user'],
        })
      );
      expect(reply.code).not.toHaveBeenCalled();
    });

    test('rejects missing authorization header', async () => {
      const req = mockRequest({ authorization: undefined });
      const { reply } = createMockReply();

      await unifiedJwtAuth(req, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'UNAUTHORIZED',
          code: '20103',
        })
      );
    });
  });

  describe('unifiedRoleGuard (backward compatible)', () => {
    test('allows user with required role', async () => {
      const token = jwt.sign({ userId: '1', username: 'admin', roles: ['admin'] }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
      const req = mockRequest({ authorization: `Bearer ${token}` }, { roles: ['admin'] });
      const { reply } = createMockReply();

      await unifiedRoleGuard(['admin', 'platform_admin'])(req, reply);

      expect(req.user).toBeDefined();
      expect(reply.code).not.toHaveBeenCalled();
    });

    test('rejects user without required role', async () => {
      const token = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
      const req = mockRequest({ authorization: `Bearer ${token}` }, { roles: ['user'] });
      const { reply } = createMockReply();

      await unifiedRoleGuard(['admin'])(req, reply);

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'FORBIDDEN',
          code: 403,
        })
      );
    });
  });

  describe('unifiedPermissionAuth (backward compatible)', () => {
    test('allows when permission check passes', async () => {
      mockEvaluate.mockResolvedValueOnce({ allowed: true, reason: '' });

      const token = jwt.sign({ userId: '1', username: 'user', tenantId: '1' }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const { reply } = createMockReply();

      await unifiedPermissionAuth({ resource: 'pipeline', action: 'read' })(req, reply);

      expect(req.user).toBeDefined();
      expect(reply.code).not.toHaveBeenCalled();
    });

    test('rejects when permission check fails', async () => {
      mockEvaluate.mockResolvedValueOnce({ allowed: false, reason: 'No access', source: 'abac' });

      const token = jwt.sign({ userId: '1', username: 'user', tenantId: '1' }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const { reply } = createMockReply();

      await unifiedPermissionAuth({ resource: 'pipeline', action: 'read' })(req, reply);

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'FORBIDDEN',
          code: 403,
        })
      );
    });
  });

  describe('unifiedAuth factory', () => {
    test('supports requireCapability check', async () => {
      mockCheckPermission.mockResolvedValueOnce({ allowed: true, requiresApproval: false });

      const token = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const { reply } = createMockReply();

      await unifiedAuth({
        requireAuth: true,
        requireCapability: 'pipeline.read',
      })(req, reply);

      expect(req.user).toBeDefined();
      expect(reply.code).not.toHaveBeenCalled();
    });

    test('supports requireRole check', async () => {
      const token = jwt.sign({ userId: '1', username: 'admin', roles: ['admin'] }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const { reply } = createMockReply();

      await unifiedAuth({
        requireAuth: true,
        requireRole: ['admin'],
      })(req, reply);

      expect(req.user).toBeDefined();
      expect(reply.code).not.toHaveBeenCalled();
    });

    test('supports tenantIsolation check', async () => {
      const token = jwt.sign({ userId: '1', username: 'user', tenantId: '1' }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
      const req = mockRequest({ authorization: `Bearer ${token}` }, undefined, { tenantId: '1' });
      const { reply } = createMockReply();

      await unifiedAuth({
        requireAuth: true,
        tenantIsolation: true,
      })(req, reply);

      expect(req.user).toBeDefined();
      expect(reply.code).not.toHaveBeenCalled();
    });

    test('supports combined checks', async () => {
      mockCheckPermission.mockResolvedValueOnce({ allowed: true, requiresApproval: false });

      const token = jwt.sign({ userId: '1', username: 'admin', tenantId: '1', roles: ['admin'] }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
      const req = mockRequest({ authorization: `Bearer ${token}` }, undefined, { tenantId: '1' });
      const { reply } = createMockReply();

      await unifiedAuth({
        requireAuth: true,
        requireCapability: 'pipeline.read',
        requireRole: ['admin'],
        tenantIsolation: true,
      })(req, reply);

      expect(req.user).toBeDefined();
      expect(reply.code).not.toHaveBeenCalled();
    });

    test('returns 401 when auth fails', async () => {
      const req = mockRequest({ authorization: undefined });
      const { reply } = createMockReply();

      await unifiedAuth({ requireAuth: true })(req, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'UNAUTHORIZED',
        })
      );
    });

    test('returns 403 when capability check fails', async () => {
      mockCheckPermission.mockResolvedValueOnce({ allowed: false, reason: 'Insufficient capability' });

      const token = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const { reply } = createMockReply();

      await unifiedAuth({
        requireAuth: true,
        requireCapability: 'pipeline.write',
      })(req, reply);

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'FORBIDDEN',
        })
      );
    });

    test('optionalAuth allows anonymous through', async () => {
      const req = mockRequest({ authorization: undefined });
      const { reply } = createMockReply();

      await unifiedAuth({ optionalAuth: true })(req, reply);

      expect(reply.code).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('returns 500 when AuthorizationEngine not initialized', async () => {
      setUnifiedAuthzEngine(null as any);

      const token = jwt.sign({ userId: '1', username: 'user', tenantId: '1' }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const { reply } = createMockReply();

      await unifiedAuth({
        requireAuth: true,
        requirePermission: { resource: 'pipeline', action: 'read' },
      })(req, reply);

      expect(reply.code).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INTERNAL_ERROR',
        })
      );
    });
  });
});

describe('UnifiedAuthMiddleware — CapabilityService not initialized', () => {
  test('returns 500 when CapabilityService not initialized', async () => {
    const mockGetCurrentSecret2 = (jwtKeyManager as any).getCurrentSecret;
    mockGetCurrentSecret2.mockReturnValue('test-jwt-secret-for-testing');
    const mockIsRevoked2 = jest.fn();
    mockIsRevoked2.mockResolvedValueOnce(false);

    // Initialize JWT only, NOT capability service
    initJwtAuth({ isRevoked: mockIsRevoked2 } as any, { query: jest.fn() } as any);
    setUnifiedAuthzEngine(null as any);

    const token = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
    const req = mockRequest({ authorization: `Bearer ${token}` });
    const { reply } = createMockReply();

    await unifiedAuth({
      requireAuth: true,
      requireCapability: 'pipeline.read',
    })(req, reply);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INTERNAL_ERROR',
      })
    );
  });
});
