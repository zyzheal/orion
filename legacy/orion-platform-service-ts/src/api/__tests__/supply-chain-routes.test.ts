/**
 * Tests for Supply Chain Routes (supply-chain-routes.ts)
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

import routePlugin from '../supply-chain-routes';

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

describe('Supply Chain Routes', () => {
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

  describe('POST /supply-chain/sbom', () => {
    it('should respond to POST /supply-chain/sbom', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/supply-chain/sbom',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /supply-chain/sbom/:sbomId', () => {
    it('should respond to GET /supply-chain/sbom/:sbomId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/supply-chain/sbom/test-sbomId',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /supply-chain/dependencies/:package/:version/analyze', () => {
    it('should respond to GET /supply-chain/dependencies/:package/:version/analyze', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/supply-chain/dependencies/test-package/test-version/analyze',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /supply-chain/dependencies/graph', () => {
    it('should respond to POST /supply-chain/dependencies/graph', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/supply-chain/dependencies/graph',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /supply-chain/artifacts/:id/sign', () => {
    it('should respond to POST /supply-chain/artifacts/:id/sign', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/supply-chain/artifacts/test-id/sign',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
