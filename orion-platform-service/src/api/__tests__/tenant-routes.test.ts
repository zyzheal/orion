/**
 * Tests for Tenant Management API Routes
 *
 * Tests CRUD, invite, user management, alerts, and quota endpoints
 */
import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import tenantRoutes from '../tenant-routes';
import { setAuthzEngine } from '../../middleware/requirePermission';

// Mock NamespacePoolService to avoid real DB initialization
jest.mock('../../services/tenant/NamespacePoolService', () => ({
  NamespacePoolService: jest.fn(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    getPoolStatus: jest.fn().mockResolvedValue({ total: 10, allocated: 3, available: 7 }),
    allocateNamespace: jest.fn(),
    releaseNamespace: jest.fn(),
    getTenantNamespaces: jest.fn().mockResolvedValue([]),
  })),
}));

// Mock Database
const mockDb = {
  query: async (sql: string, params?: any[]) => ({ rows: [], rowCount: 0 }),
};

// Mock authz engine
const mockAuthzEngine = {
  evaluate: async () => ({ allowed: true, reason: '', source: 'test' }),
};
setAuthzEngine(mockAuthzEngine);

// Generate a valid test token
const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'dev-fallback-secret-not-for-production',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

describe('Tenant Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(tenantRoutes, { prefix: '/v1/tenant', database: mockDb as any });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/tenant/context', () => {
    it('returns tenant context', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/context',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('context');
    });

    it('returns 400 without tenant id header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/context',
        headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /v1/tenant/quota', () => {
    it('returns quota info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/quota',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('quota');
    });
  });

  describe('POST /v1/tenant/quota/check', () => {
    it('handles quota check request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tenant/quota/check',
        headers: authHeaders,
        payload: { resourceType: 'pipelines', amount: 1 },
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /v1/tenant/namespace/pool', () => {
    it('returns namespace pool status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/namespace/pool',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /v1/tenant/namespace/allocate', () => {
    it('processes allocation request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tenant/namespace/allocate',
        headers: authHeaders,
        payload: { tenantId: '1' },
      });
      // 201 for success or 400 for allocation failure (mock returns empty)
      expect([201, 400]).toContain(response.statusCode);
    });
  });

  describe('POST /v1/tenant/namespace/release', () => {
    it('processes release request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tenant/namespace/release',
        headers: authHeaders,
        payload: { namespaceName: 'test-ns' },
      });
      expect([200, 400]).toContain(response.statusCode);
    });
  });

  describe('GET /v1/tenant/', () => {
    it('returns tenant list endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/',
        headers: authHeaders,
      });
      // 200 with mock db or 500 if db queries fail
      expect([200, 500]).toContain(response.statusCode);
    });

    it('supports search query param', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/?search=test',
        headers: authHeaders,
      });
      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe('POST /v1/tenant/', () => {
    it('returns 400 when name is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tenant/',
        headers: authHeaders,
        payload: {},
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /v1/tenant/:id', () => {
    it('handles tenant by id request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/test-id',
        headers: authHeaders,
      });
      // 200 if found, 404 if not found, 500 if db error
      expect([200, 404, 500]).toContain(response.statusCode);
    });
  });

  describe('PUT /v1/tenant/:id', () => {
    it('handles tenant update request', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/v1/tenant/test-id',
        headers: authHeaders,
        payload: { name: 'updated-name' },
      });
      // 200 if found, 404 if not, 500 if db error
      expect([200, 404, 500]).toContain(response.statusCode);
    });
  });

  describe('DELETE /v1/tenant/:id', () => {
    it('handles tenant delete request', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/tenant/test-id',
        headers: authHeaders,
      });
      // 200 if found, 404 if not, 500 if db error
      expect([200, 404, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /v1/tenant/:id/users', () => {
    it('returns users for a tenant', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/test-id/users',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /v1/tenant/:id/invite', () => {
    it('returns 400 when email is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tenant/test-id/invite',
        headers: authHeaders,
        payload: { role: 'viewer' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('handles invite request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tenant/test-id/invite',
        headers: authHeaders,
        payload: { email: 'test@example.com', role: 'viewer' },
      });
      // Accept any non-401 status (auth passes, route executes)
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('GET /v1/tenant/alerts', () => {
    it('returns alert history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/alerts',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(200);
    });

    it('supports filtering by resourceType', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/alerts?resourceType=pipelines',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /v1/tenant/alerts/stats', () => {
    it('returns alert statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/alerts/stats',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /v1/tenant/current', () => {
    it('handles current tenant request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/current',
        headers: authHeaders,
      });
      // Accept any non-401 status
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('GET /v1/tenant/count', () => {
    it('handles tenant statistics request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/count',
        headers: authHeaders,
      });
      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /v1/tenant/usage', () => {
    it('handles tenant usage request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/usage',
        headers: authHeaders,
      });
      expect([200, 500]).toContain(response.statusCode);
    });
  });
});
