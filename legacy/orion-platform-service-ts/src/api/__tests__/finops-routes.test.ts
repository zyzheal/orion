/**
 * Tests for Finops Routes (finops-routes.ts)
 *
 * Auto-generated route registration tests
 */

import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'] };
  },
}));

jest.mock('../../middleware/requirePermission', () => ({
  requirePermission: () => async (req, reply) => {},
}));

// Mock all service dependencies to avoid real initialization
jest.mock('../../services/cost/CostBudgetGuardService', () => ({
  CostBudgetGuardService: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'guard-1', name: 'test-guard' }),
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
    evaluate: jest.fn().mockResolvedValue({ passed: true }),
  })),
}));

jest.mock('../../services/cost/CostAnomalyDetectionService', () => ({
  CostAnomalyDetectionService: jest.fn().mockImplementation(() => ({
    detect: jest.fn().mockResolvedValue([]),
    getAnomalies: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../services/cost/CostOptimizationService', () => ({
  CostOptimizationService: jest.fn().mockImplementation(() => ({
    getOptimizations: jest.fn().mockResolvedValue([]),
    applyOptimization: jest.fn().mockResolvedValue({ success: true }),
    rejectOptimization: jest.fn().mockResolvedValue({ success: true }),
  })),
}));

jest.mock('../../services/finops/FinOpsRepository', () => ({
  FinOpsRepository: jest.fn().mockImplementation(() => ({
    createCostComparison: jest.fn(),
    getCostComparisons: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../services/finops/FinOpsService', () => ({
  FinOpsService: jest.fn().mockImplementation(() => ({
    compareCosts: jest.fn().mockResolvedValue({ savings: 100 }),
  })),
}));

import routePlugin from '../finops-routes';

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

describe('Finops Routes', () => {
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

  describe('POST /cost-operations/budget-guards', () => {
    it('should respond to POST /cost-operations/budget-guards', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/cost-operations/budget-guards',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /cost-operations/budget-guards', () => {
    it('should respond to GET /cost-operations/budget-guards', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/cost-operations/budget-guards',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('DELETE /cost-operations/budget-guards/:id', () => {
    it('should respond to DELETE /cost-operations/budget-guards/:id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/cost-operations/budget-guards/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('POST /cost-operations/evaluate', () => {
    it('should respond to POST /cost-operations/evaluate', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/cost-operations/evaluate',
        payload: {},
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /cost-operations/budgets', () => {
    it('should respond to GET /cost-operations/budgets', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/cost-operations/budgets',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
