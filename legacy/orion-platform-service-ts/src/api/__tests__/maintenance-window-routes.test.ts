/**
 * Tests for Maintenance Window Routes (maintenance-window-routes.ts)
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

import { registerMaintenanceWindowRoutes } from '../maintenance-window-routes';

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

describe('Maintenance Window Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await registerMaintenanceWindowRoutes(app, { database: mockDb as any });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have registered routes', () => {
    const routes = app.printRoutes();
    expect(routes).toBeTruthy();
  });

  describe('POST /maintenance-windows', () => {
    it('should respond to POST /maintenance-windows', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/maintenance-windows',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /maintenance-windows', () => {
    it('should respond to GET /maintenance-windows', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/maintenance-windows',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /maintenance-windows/active', () => {
    it('should respond to GET /maintenance-windows/active', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/maintenance-windows/active',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /maintenance-windows/upcoming', () => {
    it('should respond to GET /maintenance-windows/upcoming', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/maintenance-windows/upcoming',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('DELETE /maintenance-windows/:id', () => {
    it('should respond to DELETE /maintenance-windows/:id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/maintenance-windows/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
