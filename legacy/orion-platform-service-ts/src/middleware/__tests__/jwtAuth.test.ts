/**
 * @file Tests for unified JWT authentication middleware
 * Verifies: fail-closed behavior when dependencies fail
 */

import { jwtAuth, initJwtAuth } from '../jwtAuth';
import jwt from 'jsonwebtoken';

// Ensure JWT_SECRET is set
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';

// Mock jwtKeyManager
jest.mock('../../services/auth/JwtKeyManager', () => ({
  jwtKeyManager: {
    getCurrentSecret: jest.fn(),
    verifyWithAnyKey: jest.fn(),
  },
}));

import { jwtKeyManager } from '../../services/auth/JwtKeyManager';
const mockGetCurrentSecret = (jwtKeyManager as any).getCurrentSecret;
const mockVerifyWithAnyKey = (jwtKeyManager as any).verifyWithAnyKey;

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

const mockRequest = (headers: Record<string, string | undefined>, user?: any) =>
  ({ headers, user, log: { warn: jest.fn(), error: jest.fn() } }) as any;

const createMockReply = () => {
  const sendMock = jest.fn();
  const codeMock = jest.fn(() => ({ send: sendMock }));
  const reply = { code: codeMock, send: sendMock };
  return { reply };
};

describe('jwtAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initJwtAuth(mockTokenBlacklist as any, mockDbPool as any);
    mockGetCurrentSecret.mockReturnValue('test-jwt-secret-for-testing');
    // verifyWithAnyKey 接收一个 (secret) => decoded 工厂，用当前 mock secret 实际验签
    mockVerifyWithAnyKey.mockImplementation((token: string, verifyFn: (secret: string) => any) => {
      return verifyFn('test-jwt-secret-for-testing');
    });
  });

  test('returns 503 when token blacklist check fails', async () => {
    mockIsRevoked.mockRejectedValueOnce(new Error('Redis connection failed'));

    const token = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
    const req = mockRequest({ authorization: `Bearer ${token}` });
    const { reply } = createMockReply();

    await jwtAuth(req, reply);

    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        code: '20150',
      })
    );
  });

  test('returns 503 when user status DB check fails', async () => {
    mockIsRevoked.mockResolvedValueOnce(false);
    mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));

    const token = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
    const req = mockRequest({ authorization: `Bearer ${token}` });
    const { reply } = createMockReply();

    await jwtAuth(req, reply);

    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        code: '20150',
      })
    );
  });

  test('allows request when token is valid and all checks pass', async () => {
    mockIsRevoked.mockResolvedValueOnce(false);
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'active' }] });

    const token = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, 'test-jwt-secret-for-testing', { algorithm: 'HS256' });
    const req = mockRequest({ authorization: `Bearer ${token}` });
    const { reply } = createMockReply();

    await jwtAuth(req, reply);

    expect(req.user).toEqual(
      expect.objectContaining({
        userId: '1',
        username: 'user',
        roles: ['user'],
      })
    );
    expect(reply.code).not.toHaveBeenCalled();
  });

  test('returns 401 for missing authorization header', async () => {
    const req = mockRequest({ authorization: undefined });
    const { reply } = createMockReply();

    await jwtAuth(req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'UNAUTHORIZED',
        code: '20103',
      })
    );
  });

  test('returns 401 for invalid token', async () => {
    const req = mockRequest({ authorization: 'Bearer invalid-token' });
    const { reply } = createMockReply();

    await jwtAuth(req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_TOKEN',
        code: '20102',
      })
    );
  });
});
