/**
 * Cache Routes Tests
 *
 * F014: Cache management API routes
 */

import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals';
import cacheRoutes from '../cache-routes';
import { CacheStrategyService } from '../../services/cache/CacheStrategyService';
import { authenticateUser } from '../../middleware/authMiddleware';
import { requirePermission } from '../../middleware/requirePermission';

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

// Mock auth middleware using Jest's mocking
jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: async (req: any, reply: any) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'] };
  },
}));

jest.mock('../../middleware/requirePermission', () => ({
  requirePermission: (_opts: any) => async (req: any, reply: any) => {
    // Always allow in tests
  },
}));

describe('Cache Routes', () => {
  let app: FastifyInstance;
  let cacheService: CacheStrategyService;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    cacheService = new CacheStrategyService(null); // No Redis for tests
    await app.register(cacheRoutes, { cacheService });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Clear L1 cache before each test
    cacheService.getL1Cache().clear();
  });

  describe('GET /cache/stats', () => {
    it('should return cache statistics', async () => {
      cacheService.getL1Cache().set('test', 'value');
      cacheService.getL1Cache().get('test'); // hit
      cacheService.getL1Cache().get('miss'); // miss

      const response = await app.inject({
        method: 'GET',
        url: '/stats',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.l1).toBeDefined();
      expect(body.data.l1.hits).toBe(1);
      expect(body.data.l1.misses).toBe(1);
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/stats',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /cache/warmup', () => {
    it('should warm up cache entries', async () => {
      const entries = [
        { key: 'warm1', value: 1 },
        { key: 'warm2', value: 2 },
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/warmup',
        headers: authHeaders,
        payload: { entries },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.warmed).toBe(2);

      // Verify entries are cached
      expect(cacheService.getL1Cache().get('warm1')).toBe(1);
      expect(cacheService.getL1Cache().get('warm2')).toBe(2);
    });

    it('should reject invalid entries', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/warmup',
        headers: authHeaders,
        payload: { entries: 'not-an-array' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /cache/invalidate', () => {
    it('should invalidate cache keys', async () => {
      cacheService.getL1Cache().set('key1', 'value1');
      cacheService.getL1Cache().set('key2', 'value2');

      const response = await app.inject({
        method: 'POST',
        url: '/invalidate',
        headers: authHeaders,
        payload: { keys: ['key1', 'key2'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.invalidated).toBe(2);

      expect(cacheService.getL1Cache().get('key1')).toBeUndefined();
      expect(cacheService.getL1Cache().get('key2')).toBeUndefined();
    });
  });

  describe('GET /cache/health', () => {
    it('should return cache health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.l1).toBeDefined();
      expect(body.data.l1.status).toBe('healthy');
      expect(body.data.l2.status).toBe('not_configured');
    });
  });

  describe('POST /cache/cleanup', () => {
    it('should clean up expired entries', async () => {
      cacheService.getL1Cache().set('expired', 'value', 1); // 1ms TTL

      // Wait for expiry
      await new Promise((r) => setTimeout(r, 10));

      const response = await app.inject({
        method: 'POST',
        url: '/cleanup',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.cleaned).toBe(1);
    });
  });

  describe('GET /cache/:key', () => {
    it('should get a cached value', async () => {
      cacheService.getL1Cache().set('mykey', 'myvalue');

      const response = await app.inject({
        method: 'GET',
        url: '/mykey',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.value).toBe('myvalue');
    });

    it('should return 404 for missing key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nonexistent',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('CACHE_MISS');
    });
  });

  describe('DELETE /cache/:key', () => {
    it('should delete a cached value', async () => {
      cacheService.getL1Cache().set('delkey', 'value');

      const response = await app.inject({
        method: 'DELETE',
        url: '/delkey',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toContain('deleted');

      expect(cacheService.getL1Cache().get('delkey')).toBeUndefined();
    });
  });
});
