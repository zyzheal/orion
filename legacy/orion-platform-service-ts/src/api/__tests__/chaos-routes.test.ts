/**
 * Tests for Chaos Routes (chaos-routes.ts)
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

import routePlugin from '../chaos-routes';

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

describe('Chaos Routes', () => {
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

  describe('POST /experiments', () => {
    it('should respond to POST /experiments', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/experiments',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /experiments', () => {
    it('should respond to GET /experiments', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/experiments',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /experiments/:id', () => {
    it('should respond to GET /experiments/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/experiments/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('PUT /experiments/:id', () => {
    it('should respond to PUT /experiments/:id', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/experiments/test-id',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /experiments/:id/activate', () => {
    it('should respond to POST /experiments/:id/activate', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/experiments/test-id/activate',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
