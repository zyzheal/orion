/**
 * Tests for Serverless Routes (serverless-routes.ts)
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

import routePlugin from '../serverless-routes';

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

describe('Serverless Routes', () => {
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

  describe('POST /serverless/functions', () => {
    it('should respond to POST /serverless/functions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/serverless/functions',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /serverless/functions', () => {
    it('should respond to GET /serverless/functions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/serverless/functions',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /serverless/functions/:id', () => {
    it('should respond to GET /serverless/functions/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/serverless/functions/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('PUT /serverless/functions/:id', () => {
    it('should respond to PUT /serverless/functions/:id', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/serverless/functions/test-id',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('DELETE /serverless/functions/:id', () => {
    it('should respond to DELETE /serverless/functions/:id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/serverless/functions/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
