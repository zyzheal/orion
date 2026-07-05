/**
 * Tests for Policy bundle, test, and toggle endpoints
 */
import Fastify, { FastifyInstance } from 'fastify';
import policyRoutes from '../policy-routes';

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: async (req: any, _reply: any) => {
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'], tenantId: '1' };
  },
}));
jest.mock('../../middleware/requirePermission', () => ({
  requirePermission: () => async (_req: any, _reply: any) => {},
}));

// Mock services to avoid database dependency
jest.mock('../../services/policy/PolicyService', () => ({
  PolicyService: jest.fn().mockImplementation(() => ({
    listBundles: jest.fn().mockResolvedValue([]),
    syncBundles: jest.fn().mockResolvedValue([]),
    testPolicy: jest.fn().mockImplementation((rego: string, testCases: unknown[]) => ({
      passed: true,
      totalTests: Array.isArray(testCases) ? testCases.length : 0,
      results: Array.isArray(testCases)
        ? testCases.map((tc: any) => ({ input: tc, result: 'pass' }))
        : [],
    })),
    toggle: jest.fn().mockResolvedValue({ id: 'policy-1', enabled: true }),
    listPolicies: jest.fn().mockResolvedValue([]),
    createPolicy: jest.fn().mockResolvedValue({ id: 'policy-1', name: 'test' }),
    getPolicy: jest.fn().mockResolvedValue(null),
    updatePolicy: jest.fn().mockResolvedValue({ id: 'policy-1' }),
    deletePolicy: jest.fn().mockResolvedValue(true),
    evaluatePolicy: jest.fn().mockResolvedValue({ allowed: true }),
    getEvaluationHistory: jest.fn().mockResolvedValue([]),
    getBundle: jest.fn().mockResolvedValue(null),
    getPoliciesByGate: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../services/policy/PolicyEvaluationService', () => ({
  PolicyEvaluationService: jest.fn().mockImplementation(() => ({
    evaluate: jest.fn().mockResolvedValue({ allowed: true, violations: [] }),
    listEvaluations: jest.fn().mockResolvedValue([]),
    evaluateGate: jest.fn().mockResolvedValue({ passed: true }),
    listViolations: jest.fn().mockResolvedValue([]),
    getViolation: jest.fn().mockResolvedValue(null),
    waiveViolation: jest.fn().mockResolvedValue({ id: 'v-1', status: 'waived' }),
    resolveViolation: jest.fn().mockResolvedValue({ id: 'v-1', status: 'resolved' }),
    listOverrides: jest.fn().mockResolvedValue([]),
    createOverride: jest.fn().mockResolvedValue({ id: 'o-1' }),
  })),
}));

jest.mock('../../services/policy/ExemptionService', () => ({
  ExemptionService: jest.fn().mockImplementation(() => ({
    submitExemption: jest.fn().mockResolvedValue({ id: 'ex-1', status: 'pending' }),
    getExemptions: jest.fn().mockResolvedValue({ exemptions: [], total: 0 }),
    getExemptionById: jest.fn().mockResolvedValue(null),
    reviewExemption: jest.fn().mockResolvedValue({ id: 'ex-1', status: 'approved' }),
    revokeExemption: jest.fn().mockResolvedValue({ id: 'ex-1', status: 'revoked' }),
  })),
}));

jest.mock('../../services/policy/PolicyOverrideService', () => ({
  PolicyOverrideService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../controllers/PolicyController', () => ({
  PolicyController: jest.fn().mockImplementation(() => ({
    listPolicies: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'OK', data: [] });
    }),
    createPolicy: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.status(201).send({ code: 201, message: 'Created', data: { id: 'policy-1' } });
    }),
    getPolicy: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.status(404).send({ code: 404, message: 'Policy not found' });
    }),
    updatePolicy: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'OK', data: { id: 'policy-1' } });
    }),
    deletePolicy: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'Deleted' });
    }),
    evaluatePolicy: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'OK', data: { allowed: true } });
    }),
    getEvaluationHistory: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'OK', data: [] });
    }),
  })),
}));

jest.mock('../controllers/PolicyEvaluationController', () => ({
  PolicyEvaluationController: jest.fn().mockImplementation(() => ({
    evaluate: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'OK', data: { allowed: true } });
    }),
    listEvaluations: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'OK', data: [] });
    }),
    evaluateGate: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'OK', data: { passed: true } });
    }),
    listViolations: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'OK', data: [] });
    }),
    getViolation: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.status(404).send({ code: 404, message: 'Violation not found' });
    }),
    waiveViolation: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'OK', data: { status: 'waived' } });
    }),
    resolveViolation: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'OK', data: { status: 'resolved' } });
    }),
    listOverrides: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.send({ code: 200, message: 'OK', data: [] });
    }),
    createOverride: jest.fn().mockImplementation((_req: any, reply: any) => {
      return reply.status(201).send({ code: 201, message: 'Created', data: { id: 'o-1' } });
    }),
  })),
}));

describe('Policy Bundle & Test Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    // Policy routes need a database -- without it the routes early-return
    // So we test with a mock database
    const mockDb = { query: async () => ({ rows: [], rowCount: 0 }) } as any;
    await app.register(policyRoutes, { prefix: '/v1/policies', database: mockDb });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/policies/bundles', () => {
    it('returns policy bundles', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/policies/bundles' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('POST /v1/policies/bundles/sync', () => {
    it('syncs policy bundles', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/policies/bundles/sync', payload: {} });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('POST /v1/policies/test', () => {
    it('tests a policy against sample inputs', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/policies/test',
        payload: {
          rego: 'package test\ndefault allow = true',
          testCases: [{ input: { user: 'admin' } }],
        },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('totalTests');
      expect(body.data).toHaveProperty('results');
    });

    it('returns 400 when rego is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/policies/test',
        payload: { testCases: [] },
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
