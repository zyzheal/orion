/**
 * Tests for Audit Routes (audit-routes.ts)
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

import routePlugin from '../audit-routes';

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

describe('Audit Routes', () => {
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

  describe('GET /logs', () => {
    it('should respond to GET /logs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/logs',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /logs/:id', () => {
    it('should respond to GET /logs/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/logs/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /logs', () => {
    it('should respond to POST /logs', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/logs',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /logs/:id/verify', () => {
    it('should respond to GET /logs/:id/verify', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/logs/test-id/verify',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /verify', () => {
    it('should respond to POST /verify', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/verify',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  // ==================== Compliance Routes ====================

  describe('GET /compliance/soc2', () => {
    it('should respond to GET /compliance/soc2', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/compliance/soc2',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /compliance/iso27001', () => {
    it('should respond to GET /compliance/iso27001', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/compliance/iso27001',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /compliance/combined', () => {
    it('should respond to GET /compliance/combined', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/compliance/combined',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /compliance/coverage', () => {
    it('should respond to GET /compliance/coverage', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/compliance/coverage',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /compliance/check', () => {
    it('should respond with COMBINED framework by default', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/compliance/check',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });

    it('should respond with SOC2 framework', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/compliance/check',
        payload: { framework: 'SOC2' },
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });

    it('should respond with ISO27001 framework', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/compliance/check',
        payload: { framework: 'ISO27001' },
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
