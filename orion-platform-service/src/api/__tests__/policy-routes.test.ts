/**
 * Tests for Policy bundle, test, and toggle endpoints
 */
import Fastify, { FastifyInstance } from 'fastify';
import policyRoutes from '../policy-routes';

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
      const response = await app.inject({ method: 'POST', url: '/v1/policies/bundles/sync' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('synced');
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
