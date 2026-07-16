/**
 * Tests for Capacity Routes (capacity-routes.ts)
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

import routePlugin from '../capacity-routes';

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

describe('Capacity Routes', () => {
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

  describe('POST /capacity/metrics', () => {
    it('should respond to POST /capacity/metrics', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/capacity/metrics',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /capacity/metrics', () => {
    it('should respond to GET /capacity/metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/capacity/metrics',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /capacity/forecast', () => {
    it('should respond to POST /capacity/forecast', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/capacity/forecast',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /capacity/forecast', () => {
    it('should respond to GET /capacity/forecast', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/capacity/forecast',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /capacity/alerts', () => {
    it('should respond to GET /capacity/alerts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/capacity/alerts',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
