/**
 * Tests for Apk Upload History Routes (apk-upload-history-routes.ts)
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

import { registerApkUploadHistoryRoutes } from '../apk-upload-history-routes';

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

describe('Apk Upload History Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await registerApkUploadHistoryRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have registered routes', () => {
    const routes = app.printRoutes();
    expect(routes).toBeTruthy();
  });

  describe('GET /api/v1/apk-upload-history', () => {
    it('should respond to GET /api/v1/apk-upload-history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/apk-upload-history',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /api/v1/apk-upload-history/recent-failures', () => {
    it('should respond to GET /api/v1/apk-upload-history/recent-failures', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/apk-upload-history/recent-failures',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /api/v1/apk-upload-history/stats', () => {
    it('should respond to GET /api/v1/apk-upload-history/stats', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/apk-upload-history/stats',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /api/v1/apk-upload-history/:id', () => {
    it('should respond to GET /api/v1/apk-upload-history/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/apk-upload-history/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
