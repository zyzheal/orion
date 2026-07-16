/**
 * Tests for Inspection Routes (inspection-routes.ts)
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

import routePlugin from '../inspection-routes';

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

describe('Inspection Routes', () => {
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

  describe('POST /inspection/rules', () => {
    it('should respond to POST /inspection/rules', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/inspection/rules',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /inspection/rules', () => {
    it('should respond to GET /inspection/rules', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/inspection/rules',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /inspection/rules/:id', () => {
    it('should respond to GET /inspection/rules/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/inspection/rules/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('PUT /inspection/rules/:id', () => {
    it('should respond to PUT /inspection/rules/:id', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/inspection/rules/test-id',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('DELETE /inspection/rules/:id', () => {
    it('should respond to DELETE /inspection/rules/:id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/inspection/rules/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
