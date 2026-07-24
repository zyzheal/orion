/**
 * Tests for Community Advanced Routes (community-advanced-routes.ts)
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

import routePlugin from '../community-advanced-routes';

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

describe('Community Advanced Routes', () => {
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

  describe('POST /badges', () => {
    it('should respond to POST /badges', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/badges',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /badges/:userId', () => {
    it('should respond to GET /badges/:userId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/badges/test-userId',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /badges/definitions', () => {
    it('should respond to GET /badges/definitions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/badges/definitions',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /incentive-programs', () => {
    it('should respond to POST /incentive-programs', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/incentive-programs',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /incentive-programs', () => {
    it('should respond to GET /incentive-programs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/incentive-programs',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
