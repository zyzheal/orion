import { authenticateUser } from '../authMiddleware';
import jwt from 'jsonwebtoken';

const mockRequest = (headers: Record<string, string | undefined>) =>
  ({ headers, user: undefined }) as any;
const mockReply = () => {
  const reply: any = { code: (status: number) => reply, send: jest.fn(() => reply) };
  return reply;
};

describe('authenticateUser', () => {
  test('rejects alg:none token', async () => {
    // Sign with the SAME secret the middleware uses, but with algorithm 'none'
    // This properly tests the alg:none vulnerability
    const secret = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
    const forgedToken = jwt.sign({ userId: '1', username: 'admin', roles: ['admin'] }, secret, { algorithm: 'none' });
    const req = mockRequest({ authorization: `Bearer ${forgedToken}` });
    const reply = mockReply();

    await authenticateUser(req, reply);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/INVALID_TOKEN|UNAUTHORIZED/) })
    );
  });

  test('accepts valid HS256 token', async () => {
    const secret = process.env.JWT_SECRET || 'test-secret';
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
