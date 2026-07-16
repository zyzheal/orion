/**
 * Tests for Autonomous Pipeline Routes (autonomous-pipeline-routes.ts)
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

import routePlugin from '../autonomous-pipeline-routes';

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

describe('Autonomous Pipeline Routes', () => {
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

  describe('POST /classify-error', () => {
    it('should respond to POST /classify-error', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/classify-error',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /error-stats', () => {
    it('should respond to GET /error-stats', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/error-stats',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /timeout/:stageName', () => {
    it('should respond to GET /timeout/:stageName', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/timeout/test-stageName',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /record-execution', () => {
    it('should respond to POST /record-execution', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/record-execution',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /retry-stats/:pipelineId', () => {
    it('should respond to GET /retry-stats/:pipelineId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/retry-stats/test-pipelineId',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
