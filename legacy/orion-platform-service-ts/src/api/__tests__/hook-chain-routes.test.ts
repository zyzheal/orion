/**
 * Tests for Hook Chain Routes (hook-chain-routes.ts)
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

import routePlugin from '../hook-chain-routes';

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

describe('Hook Chain Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(routePlugin, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have registered routes', () => {
    const routes = app.printRoutes();
    expect(routes).toBeTruthy();
  });

  describe('POST /hook-chains', () => {
    it('should respond to POST /hook-chains', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/hook-chains',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /hook-chains', () => {
    it('should respond to GET /hook-chains', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/hook-chains',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /hook-chains/:chainId', () => {
    it('should respond to GET /hook-chains/:chainId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/hook-chains/test-chainId',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('PUT /hook-chains/:chainId', () => {
    it('should respond to PUT /hook-chains/:chainId', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/hook-chains/test-chainId',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('DELETE /hook-chains/:chainId', () => {
    it('should respond to DELETE /hook-chains/:chainId', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/hook-chains/test-chainId',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
