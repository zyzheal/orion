/**
 * Tests for Artifact Lifecycle Routes (artifact-lifecycle-routes.ts)
 *
 * Covers: lifecycle promotion, expiration policy, replication, ACL
 */

import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { describe, it, beforeAll, afterAll, expect, jest } from '@jest/globals';

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

import routePlugin from '../artifact-lifecycle-routes';

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

describe('Artifact Lifecycle Routes', () => {
  let app: Fastify;

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
    // Verify all major route groups exist
    expect(routes).toContain('promote');
    expect(routes).toContain('expire');
    expect(routes).toContain('replicate');
    expect(routes).toContain('replication-status');
    expect(routes).toContain('acl');
  });

  describe('POST /lifecycle/promote', () => {
    it('should respond to promote request', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'promo-1', artifact_id: 'art-1' }], rowCount: 1 });
      const response = await app.inject({
        method: 'POST',
        url: '/lifecycle/promote',
        headers: authHeaders,
        payload: { artifactId: 'art-1', toStage: 'test' },
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(300);
    });

    it('should return 400 when missing artifactId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/lifecycle/promote',
        headers: authHeaders,
        payload: { toStage: 'test' },
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /lifecycle/expire', () => {
    it('should respond to expire policy request', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'policy-1', artifact_id: 'art-1' }], rowCount: 1 });
      const response = await app.inject({
        method: 'POST',
        url: '/lifecycle/expire',
        headers: authHeaders,
        payload: { artifactId: 'art-1', maxAgeDays: 30 },
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(300);
    });
  });

  describe('POST /replicate', () => {
    it('should respond to replication request', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'rep-1', artifact_id: 'art-1' }], rowCount: 1 });
      const response = await app.inject({
        method: 'POST',
        url: '/replicate',
        headers: authHeaders,
        payload: { artifactId: 'art-1', sourceRegistry: 'reg-a', targetRegistry: 'reg-b' },
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(300);
    });
  });

  describe('GET /replication-status/:id', () => {
    it('should respond to replication status request', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'rep-1', status: 'running' }], rowCount: 1 });
      const response = await app.inject({
        method: 'GET',
        url: '/replication-status/rep-1',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(300);
    });
  });

  describe('POST /acl', () => {
    it('should respond to ACL create request', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'acl-1', artifact_id: 'art-1' }], rowCount: 1 });
      const response = await app.inject({
        method: 'POST',
        url: '/acl',
        headers: authHeaders,
        payload: { artifactId: 'art-1', subjectType: 'user', subjectId: 'user-1', permissions: ['read', 'write'] },
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(300);
    });
  });

  describe('GET /acl/:artifactId', () => {
    it('should respond to ACL list request', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'acl-1' }], rowCount: 1 });
      const response = await app.inject({
        method: 'GET',
        url: '/acl/art-1',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(300);
    });
  });

  describe('PUT /acl/:id', () => {
    it('should respond to ACL update request', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'acl-1', permissions: ['read'] }], rowCount: 1 });
      const response = await app.inject({
        method: 'PUT',
        url: '/acl/acl-1',
        headers: authHeaders,
        payload: { permissions: ['read', 'write'] },
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(300);
    });
  });
});
