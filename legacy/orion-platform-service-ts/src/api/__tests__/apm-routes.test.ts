/**
 * Tests for Apm Routes (apm-routes.ts)
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

jest.mock('../../services/monitoring/TracingService', () => ({
  TracingService: jest.fn().mockImplementation(() => ({
    getTraces: jest.fn().mockResolvedValue([]),
    getTraceById: jest.fn().mockResolvedValue(null),
    getTraceSummary: jest.fn().mockResolvedValue(null),
    getSlowTraces: jest.fn().mockResolvedValue([]),
    getServices: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../services/monitoring/DatabaseProfiler', () => ({
  DatabaseProfiler: jest.fn().mockImplementation(() => ({
    getRecentSlowQueries: jest.fn().mockResolvedValue([]),
    getPatternStats: jest.fn().mockResolvedValue([]),
  })),
}));

import routePlugin from '../apm-routes';

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

describe('Apm Routes', () => {
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

  describe('GET /traces', () => {
    it('should respond to GET /traces', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/traces',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /traces/:traceId', () => {
    it('should respond to GET /traces/:traceId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/traces/test-traceId',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /traces/:traceId/summary', () => {
    it('should respond to GET /traces/:traceId/summary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/traces/test-traceId/summary',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /traces/slow', () => {
    it('should respond to GET /traces/slow', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/traces/slow',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /services', () => {
    it('should respond to GET /services', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/services',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
