import Fastify, { FastifyInstance } from 'fastify';

// Set required env var before importing middleware
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';

const { authenticateUser } = require('../../middleware/authMiddleware');

describe('Auth Middleware', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.addHook('onRequest', authenticateUser);
    app.get('/protected', async () => ({ success: true }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 when no Authorization header is present', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 when Authorization header has invalid format', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: 'InvalidFormat token' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 when JWT token is expired', async () => {
    // This is a pre-expired JWT (iat/exp = 1000000000, which is Sep 2001)
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwidXNlcm5hbWUiOiJ0ZXN0Iiwicm9sZSI6InVzZXIiLCJpYXQiOjEwMDAwMDAwMDAsImV4cCI6MTAwMDAwMDAwMH0.invalid';

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    expect(response.statusCode).toBe(401);
  });
});
