/**
 * @file Tests for JWT authentication middleware
 * Verifies: alg:none rejection, HS256 acceptance
 */

import { authenticateUser } from '../authMiddleware';
import jwt from 'jsonwebtoken';

// Ensure JWT_SECRET is set before importing authMiddleware (which reads it at module load)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';

const mockRequest = (headers: Record<string, string | undefined>) =>
  ({ headers, user: undefined }) as any;
const mockReply = () => {
  const reply: any = { code: (status: number) => reply, send: jest.fn(() => reply) };
  return reply;
};

describe('authenticateUser', () => {
  test('rejects alg:none token', async () => {
    const secret = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
    const forgedToken = jwt.sign({ userId: '1', username: 'admin', roles: ['admin'] }, secret, { algorithm: 'none' });
    const req = mockRequest({ authorization: `Bearer ${forgedToken}` });
    const reply = mockReply();

    await authenticateUser(req, reply);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'INVALID_TOKEN' })
    );
  });

  test('accepts valid HS256 token', async () => {
    const secret = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
    const validToken = jwt.sign({ userId: '1', username: 'user', roles: ['user'] }, secret, { algorithm: 'HS256' });
    const req = mockRequest({ authorization: `Bearer ${validToken}` });
    const reply = mockReply();

    await authenticateUser(req, reply);

    expect((req as any).user).toEqual({
      userId: '1',
      username: 'user',
      roles: ['user'],
    });
  });
});
