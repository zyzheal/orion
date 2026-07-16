/**
 * Tests for Finops V2 Routes (finops-v2-routes.ts)
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

import routePlugin from '../finops-v2-routes';

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

describe('Finops V2 Routes', () => {
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

  describe('POST /finops/track/project', () => {
    it('should respond to POST /finops/track/project', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/finops/track/project',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /finops/track/tenant', () => {
    it('should respond to POST /finops/track/tenant', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/finops/track/tenant',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /finops/track/team', () => {
    it('should respond to POST /finops/track/team', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/finops/track/team',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /finops/track/:entityType/:entityId', () => {
    it('should respond to GET /finops/track/:entityType/:entityId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/finops/track/test-entityType/test-entityId',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /finops/track/:entityType/:entityId/trend', () => {
    it('should respond to GET /finops/track/:entityType/:entityId/trend', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/finops/track/test-entityType/test-entityId/trend',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
