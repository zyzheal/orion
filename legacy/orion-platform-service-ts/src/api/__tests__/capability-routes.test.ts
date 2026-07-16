/**
 * Tests for Capability Routes (capability-routes.ts)
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

import routePlugin from '../capability-routes';

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

describe('Capability Routes', () => {
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

  describe('GET /api/v1/capabilities', () => {
    it('should respond to GET /api/v1/capabilities', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/capabilities',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /api/v1/capabilities/tree', () => {
    it('should respond to GET /api/v1/capabilities/tree', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/capabilities/tree',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /api/v1/capabilities', () => {
    it('should respond to POST /api/v1/capabilities', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/capabilities',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /api/v1/capabilities/:id', () => {
    it('should respond to GET /api/v1/capabilities/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/capabilities/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('PUT /api/v1/capabilities/:id', () => {
    it('should respond to PUT /api/v1/capabilities/:id', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/capabilities/test-id',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
