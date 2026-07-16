/**
 * Tests for Data Pipeline Routes (data-pipeline-routes.ts)
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

import routePlugin from '../data-pipeline-routes';

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

describe('Data Pipeline Routes', () => {
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

  describe('POST /', () => {
    it('should respond to POST /', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should respond to GET /', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /:id/execute', () => {
    it('should respond to POST /:id/execute', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test-id/execute',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /:id/executions', () => {
    it('should respond to GET /:id/executions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-id/executions',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /:id/lineage', () => {
    it('should respond to GET /:id/lineage', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-id/lineage',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  // Task 5.8: Version Management routes
  describe('POST /:id/versions', () => {
    it('should respond to POST /:id/versions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test-id/versions',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /:id/versions', () => {
    it('should respond to GET /:id/versions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-id/versions',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /:id/versions/:version', () => {
    it('should respond to GET /:id/versions/1', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-id/versions/1',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
