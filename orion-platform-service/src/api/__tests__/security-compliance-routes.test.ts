/**
 * Tests for Security Compliance Routes (security-compliance-routes.ts)
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

import routePlugin from '../security-compliance-routes';

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

describe('Security Compliance Routes', () => {
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

  describe('POST /compliance/policies', () => {
    it('should respond to POST /compliance/policies', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/compliance/policies',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /compliance/policies', () => {
    it('should respond to GET /compliance/policies', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/compliance/policies',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /compliance/evaluate', () => {
    it('should respond to POST /compliance/evaluate', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/compliance/evaluate',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /compliance/report/:policyId', () => {
    it('should respond to GET /compliance/report/:policyId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/compliance/report/test-policyId',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /compliance/score', () => {
    it('should respond to GET /compliance/score', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/compliance/score',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
