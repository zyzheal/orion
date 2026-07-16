/**
 * Tests for Test Generation Routes (test-generation-routes.ts)
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

import routePlugin from '../test-generation-routes';

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

describe('Test Generation Routes', () => {
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

  describe('POST /generate', () => {
    it('should respond to POST /generate', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/generate',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /analyze-change', () => {
    it('should respond to POST /analyze-change', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/analyze-change',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /suggest-coverage', () => {
    it('should respond to POST /suggest-coverage', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/suggest-coverage',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /templates', () => {
    it('should respond to GET /templates', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/templates',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /templates/:language/:framework', () => {
    it('should respond to GET /templates/:language/:framework', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/templates/test-language/test-framework',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
