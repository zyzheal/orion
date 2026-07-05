/**
 * @file Tests for JWT authentication middleware
 * Verifies: alg:none rejection, HS256 acceptance, fail-closed behavior
 */

import { authenticateUser, initAuthMiddleware } from '../authMiddleware';
import jwt from 'jsonwebtoken';

// Ensure JWT_SECRET is set before importing authMiddleware (which reads it at module load)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';

// Mock TokenBlacklistService
const mockIsRevoked = jest.fn();
const mockBlacklistService = { isRevoked: mockIsRevoked };

const mockRequest = (headers: Record<string, string | undefined>, user?: any) =>
  ({ headers, user, log: { warn: jest.fn(), error: jest.fn() } }) as any;

const createMockReply = () => {
  const sendMock = jest.fn();
  const reply: any = {
    code: jest.fn(() => ({ send: sendMock })),
    send: sendMock,
  };
  return { reply };
};

describe('authenticateUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initAuthMiddleware(mockBlacklistService as any);
  });

  test('rejects alg:none token', async () => {
    const secret = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
    const forgedToken = jwt.sign({ userId: '1', username: 'admin', roles: ['admin'] }, secret, { algorithm: 'none' });
    const req = mockRequest({ authorization: `Bearer ${forgedToken}` });
    const { reply } = createMockReply();

    await authenticateUser(req, reply);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'INVALID_TOKEN' })
    );
  });

  test('accepts valid HS256 token', async () => {
    const secret = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
    const validToken = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, secret, { algorithm: 'HS256' });
    const req = mockRequest({ authorization: `Bearer ${validToken}` });
    const { reply } = createMockReply();

    await authenticateUser(req, reply);

    expect((req as any).user).toEqual({
      userId: '1',
      username: 'user',
      roles: ['user'],
    });
  });

  test('returns 503 when token blacklist check fails (fail-closed)', async () => {
    mockIsRevoked.mockRejectedValueOnce(new Error('Redis connection failed'));

    const secret = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
    const validToken = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, secret, { algorithm: 'HS256' });
    const req = mockRequest({ authorization: `Bearer ${validToken}` });
    const { reply } = createMockReply();

    await authenticateUser(req, reply);

    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Token validation service temporarily unavailable',
      })
    );
  });
});
