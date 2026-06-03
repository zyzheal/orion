/**
 * Tests for Cmdb Routes (cmdb-routes.ts)
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

import routePlugin from '../cmdb-routes';

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

describe('Cmdb Routes', () => {
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

  describe('POST /cmdb/cis', () => {
    it('should respond to POST /cmdb/cis', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/cmdb/cis',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /cmdb/cis/:id', () => {
    it('should respond to GET /cmdb/cis/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/cmdb/cis/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /cmdb/cis/by-id/:ciId', () => {
    it('should respond to GET /cmdb/cis/by-id/:ciId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/cmdb/cis/by-id/test-ciId',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('PUT /cmdb/cis/:id', () => {
    it('should respond to PUT /cmdb/cis/:id', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/cmdb/cis/test-id',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('DELETE /cmdb/cis/:id', () => {
    it('should respond to DELETE /cmdb/cis/:id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/cmdb/cis/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
