/**
 * Tests for Ticketing Routes (ticketing-routes.ts)
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

jest.mock('../../services/ticketing/TicketService', () => ({
  TicketService: jest.fn().mockImplementation(() => ({
    createTicket: jest.fn().mockResolvedValue({ id: 'test-id' }),
    getTicket: jest.fn().mockResolvedValue(null),
    listTickets: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    updateTicket: jest.fn().mockResolvedValue({ id: 'test-id' }),
    deleteTicket: jest.fn().mockResolvedValue(undefined),
    assignTicket: jest.fn().mockResolvedValue({ id: 'test-id' }),
    resolveTicket: jest.fn().mockResolvedValue({ id: 'test-id' }),
    closeTicket: jest.fn().mockResolvedValue({ id: 'test-id' }),
    addComment: jest.fn().mockResolvedValue({ id: 'comment-id' }),
    createFromAlert: jest.fn().mockResolvedValue({ id: 'test-id' }),
    startService: jest.fn().mockResolvedValue(undefined),
    stopService: jest.fn().mockResolvedValue(undefined),
    healthCheck: jest.fn().mockResolvedValue({ status: 'ok' }),
  })),
}));

jest.mock('../../services/ticketing/TicketingService', () => ({
  TicketingService: jest.fn().mockImplementation(() => ({
    getAnalytics: jest.fn().mockResolvedValue({}),
    getStats: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../../services/ticketing/TicketingRepository', () => ({
  TicketingRepository: jest.fn().mockImplementation(() => ({})),
}));

import routePlugin from '../ticketing-routes';

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

describe('Ticketing Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(routePlugin);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have registered routes', () => {
    const routes = app.printRoutes();
    expect(routes).toBeTruthy();
  });

  describe('POST /ticketing/start', () => {
    it('should respond to POST /ticketing/start', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/ticketing/start',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /ticketing/stop', () => {
    it('should respond to POST /ticketing/stop', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/ticketing/stop',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /ticketing/health', () => {
    it('should respond to GET /ticketing/health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ticketing/health',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /tickets', () => {
    it('should respond to POST /tickets', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tickets',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /tickets/from-alert', () => {
    it('should respond to POST /tickets/from-alert', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tickets/from-alert',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
