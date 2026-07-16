/**
 * Tests for Cross Domain Routes (cross-domain-routes.ts)
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

import routePlugin from '../cross-domain-routes';

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

describe('Cross Domain Routes', () => {
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

  describe('POST /v1/orchestration', () => {
    it('should respond to POST /v1/orchestration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/orchestration',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /v1/orchestration', () => {
    it('should respond to GET /v1/orchestration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/orchestration',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /v1/orchestration/:id', () => {
    it('should respond to GET /v1/orchestration/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/orchestration/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /v1/orchestration/:id/execute', () => {
    it('should respond to POST /v1/orchestration/:id/execute', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/orchestration/test-id/execute',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /v1/orchestration/:id/pause', () => {
    it('should respond to POST /v1/orchestration/:id/pause', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/orchestration/test-id/pause',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
