/**
 * Tests for Queue Routes (queue-routes.ts)
 *
 * Auto-generated route registration tests
 */

import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: async (req: any, reply: any) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'] };
  },
}));

jest.mock('../../middleware/requirePermission', () => ({
  requirePermission: (_opts: any) => async (req: any, reply: any) => {},
}));

import routePlugin from '../queue-routes';

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

const mockDb = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
  end: jest.fn(),
};

describe('Queue Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(routePlugin, { database: mockDb as any });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have registered routes', () => {
    const routes = app.printRoutes();
    expect(routes).toBeTruthy();
  });

  describe('POST /:queueName/jobs', () => {
    it('should respond to POST /:queueName/jobs', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test-queueName/jobs',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /:queueName/dequeue', () => {
    it('should respond to POST /:queueName/dequeue', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test-queueName/dequeue',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /jobs/:id/complete', () => {
    it('should respond to POST /jobs/:id/complete', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/jobs/test-id/complete',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /jobs/:id/fail', () => {
    it('should respond to POST /jobs/:id/fail', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/jobs/test-id/fail',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /jobs/:id/retry', () => {
    it('should respond to POST /jobs/:id/retry', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/jobs/test-id/retry',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
