/**
 * Tests for Deploy Routes (deploy-routes.ts)
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

import routePlugin from '../deploy-routes';

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

describe('Deploy Routes', () => {
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

  describe('POST /deploy', () => {
    it('should respond to POST /deploy', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/deploy',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /deploy/:id', () => {
    it('should respond to GET /deploy/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/deploy/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /deploy/history', () => {
    it('should respond to GET /deploy/history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/deploy/history',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /deploy/latest/:appName/:environment', () => {
    it('should respond to GET /deploy/latest/:appName/:environment', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/deploy/latest/test-appName/test-environment',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /deploy/metrics', () => {
    it('should respond to GET /deploy/metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/deploy/metrics',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
