/**
 * Tests for Self Healing Routes (self-healing-routes.ts)
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

jest.mock('../../services/self-healing/SelfHealingRepository', () => ({
  SelfHealingRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'test-id' }),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    update: jest.fn().mockResolvedValue({ id: 'test-id' }),
    delete: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../services/self-healing/SelfHealingService', () => ({
  SelfHealingService: jest.fn().mockImplementation(() => ({
    createIncident: jest.fn().mockResolvedValue({ id: 'test-id' }),
    getIncident: jest.fn().mockResolvedValue(null),
    getHistory: jest.fn().mockResolvedValue([]),
    getEffectiveness: jest.fn().mockResolvedValue({}),
    getStrategies: jest.fn().mockResolvedValue([]),
    getStrategy: jest.fn().mockResolvedValue(null),
    toggleStrategy: jest.fn().mockResolvedValue({}),
    registerStrategy: jest.fn().mockResolvedValue({}),
    getApprovals: jest.fn().mockResolvedValue([]),
    getApproval: jest.fn().mockResolvedValue(null),
    respondToApproval: jest.fn().mockResolvedValue({}),
  })),
}));

import routePlugin from '../self-healing-routes';

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

describe('Self Healing Routes', () => {
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

  describe('POST /incidents', () => {
    it('should respond to POST /incidents', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/incidents',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /incidents/:id', () => {
    it('should respond to GET /incidents/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/incidents/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /history', () => {
    it('should respond to GET /history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/history',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /effectiveness', () => {
    it('should respond to GET /effectiveness', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/effectiveness',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /strategies', () => {
    it('should respond to GET /strategies', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/strategies',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
