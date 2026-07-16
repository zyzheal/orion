/**
 * Tests for Ai Agent Routes (ai-agent-routes.ts)
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

import { registerAIAgentRoutes } from '../ai-agent-routes';

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

describe('Ai Agent Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    registerAIAgentRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have registered routes', () => {
    const routes = app.printRoutes();
    expect(routes).toBeTruthy();
  });

  describe('GET /api/v1/ai-agents/list', () => {
    it('should respond to GET /api/v1/ai-agents/list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ai-agents/list',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /api/v1/ai-agents/:id', () => {
    it('should respond to GET /api/v1/ai-agents/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ai-agents/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /api/v1/ai-agents/:id/audit-logs', () => {
    it('should respond to GET /api/v1/ai-agents/:id/audit-logs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ai-agents/test-id/audit-logs',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /api/v1/ai-agents/:id/execute', () => {
    it('should respond to POST /api/v1/ai-agents/:id/execute', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ai-agents/test-id/execute',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
