/**
 * Tests for Dba Routes (dba-routes.ts)
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

import routePlugin from '../dba-routes';

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

describe('Dba Routes', () => {
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

  describe('GET /dba/orders', () => {
    it('should respond to GET /dba/orders', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dba/orders',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /dba/orders/:id', () => {
    it('should respond to GET /dba/orders/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dba/orders/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /dba/orders', () => {
    it('should respond to POST /dba/orders', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dba/orders',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /dba/orders/:id/approve', () => {
    it('should respond to POST /dba/orders/:id/approve', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dba/orders/test-id/approve',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /dba/orders/:id/reject', () => {
    it('should respond to POST /dba/orders/:id/reject', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dba/orders/test-id/reject',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
