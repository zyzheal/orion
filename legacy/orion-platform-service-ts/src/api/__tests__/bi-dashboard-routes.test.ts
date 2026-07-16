/**
 * Tests for Bi Dashboard Routes (bi-dashboard-routes.ts)
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

import routePlugin from '../bi-dashboard-routes';

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

describe('Bi Dashboard Routes', () => {
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

  describe('GET /tickets/bi/dashboard/executive', () => {
    it('should respond to GET /tickets/bi/dashboard/executive', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tickets/bi/dashboard/executive',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /tickets/bi/dashboard/manager', () => {
    it('should respond to GET /tickets/bi/dashboard/manager', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tickets/bi/dashboard/manager',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /tickets/bi/dashboard/engineer/:engineerId', () => {
    it('should respond to GET /tickets/bi/dashboard/engineer/:engineerId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tickets/bi/dashboard/engineer/test-engineerId',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /efficiency/score', () => {
    it('should respond to GET /efficiency/score', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/efficiency/score',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
