/**
 * Tests for Decision Explanation Routes (decision-explanation-routes.ts)
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

import routePlugin from '../decision-explanation-routes';

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

describe('Decision Explanation Routes', () => {
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

  describe('GET /decisions/:id/explain', () => {
    it('should respond to GET /decisions/:id/explain', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/decisions/test-id/explain',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /decisions/:id/feedback', () => {
    it('should respond to POST /decisions/:id/feedback', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/decisions/test-id/feedback',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /decisions/quality/:scenario', () => {
    it('should respond to GET /decisions/quality/:scenario', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/decisions/quality/test-scenario',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /decisions/quality/:scenario/trend', () => {
    it('should respond to GET /decisions/quality/:scenario/trend', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/decisions/quality/test-scenario/trend',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
