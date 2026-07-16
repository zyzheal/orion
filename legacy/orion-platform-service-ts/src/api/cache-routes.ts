/**
 * Cache Management API Routes
 *
 * F014: Cache management endpoints for monitoring and operations.
 *
 * Prefix: /v1/cache
 *
 * Endpoints:
 * - GET    /v1/cache/stats              - Cache statistics (L1 + L2)
 * - POST   /v1/cache/warmup             - Warm up cache with entries
 * - POST   /v1/cache/invalidate          - Invalidate cache entries
 * - POST   /v1/cache/invalidate-pattern  - Invalidate by pattern
 * - GET    /v1/cache/health              - Cache health check
 * - POST   /v1/cache/cleanup            - Clean up expired entries
 * - GET    /v1/cache/:key               - Get a specific cache entry (debug)
 * - DELETE /v1/cache/:key               - Delete a specific cache entry
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { CacheStrategyService } from '../services/cache/CacheStrategyService';
import { ValidationError, NotFoundError, ServiceUnavailableError, handleError } from '../errors';

interface CacheRoutesOptions {
  cacheService?: CacheStrategyService;
}

export default async function cacheRoutes(
  app: FastifyInstance,
  options: CacheRoutesOptions,
): Promise<void> {
  const cache = options.cacheService;

  // ─── Stats ──────────────────────────────────────────────────────────────

  app.get(
    '/stats',
    { preHandler: [authenticateUser, requirePermission({ resource: 'cache', action: 'read' })] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      if (!cache) {
        return handleError(reply, new ServiceUnavailableError('Cache service not initialized'));
      }

      const stats = cache.getStats();

      return reply.send({ success: true, data: stats });
    },
  );

  // ─── Warmup ─────────────────────────────────────────────────────────────

  app.post(
    '/warmup',
    { preHandler: [authenticateUser, requirePermission({ resource: 'cache', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!cache) {
        return handleError(reply, new ServiceUnavailableError('Cache service not initialized'));
      }

      const body = request.body as any;
      if (!body.entries || !Array.isArray(body.entries)) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      await cache.warmup(body.entries);

      return reply.send({
        success: true,
        data: { warmed: body.entries.length },
        message: 'Cache warmed up',
      });
    },
  );

  // ─── Warmup with Loader ─────────────────────────────────────────────────

  app.post(
    '/warmup-with-loader',
    { preHandler: [authenticateUser, requirePermission({ resource: 'cache', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!cache) {
        return handleError(reply, new ServiceUnavailableError('Cache service not initialized'));
      }

      const body = request.body as any;
      if (!body.keys || !Array.isArray(body.keys)) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      // Loader function is passed as a URL to call for each key
      // For API simplicity, this endpoint expects the caller to provide values
      // A more advanced version would accept a loader URL
      if (!body.values || typeof body.values !== 'object') {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      const entries = body.keys.map((key: string) => ({
        key,
        value: body.values[key],
        ttlMs: body.ttlMs,
      }));

      await cache.warmup(entries);

      return reply.send({
        success: true,
        data: { warmed: body.keys.length },
        message: 'Cache warmed up with loader',
      });
    },
  );

  // ─── Invalidate ─────────────────────────────────────────────────────────

  app.post(
    '/invalidate',
    { preHandler: [authenticateUser, requirePermission({ resource: 'cache', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!cache) {
        return handleError(reply, new ServiceUnavailableError('Cache service not initialized'));
      }

      const body = request.body as any;
      if (!body.keys || !Array.isArray(body.keys)) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      await cache.invalidateKeys(body.keys);

      return reply.send({
        success: true,
        data: { invalidated: body.keys.length },
        message: 'Cache entries invalidated',
      });
    },
  );

  // ─── Invalidate by Pattern ──────────────────────────────────────────────

  app.post(
    '/invalidate-pattern',
    { preHandler: [authenticateUser, requirePermission({ resource: 'cache', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!cache) {
        return handleError(reply, new ServiceUnavailableError('Cache service not initialized'));
      }

      const body = request.body as any;
      if (!body.pattern) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      await cache.invalidateByPattern(body.pattern);

      return reply.send({
        success: true,
        message: `Invalidated entries matching ${body.pattern}`,
      });
    },
  );

  // ─── Health ─────────────────────────────────────────────────────────────

  app.get(
    '/health',
    { preHandler: [authenticateUser, requirePermission({ resource: 'cache', action: 'read' })] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      if (!cache) {
        return handleError(reply, new ServiceUnavailableError('Cache service not initialized'));
      }

      const l1 = cache.getL1Cache();
      const stats = l1.getStats();
      const l2 = cache.getL2Cache();

      return reply.send({
        success: true,
        data: {
          l1: {
            status: 'healthy',
            size: stats.size,
            maxSize: stats.maxSize,
            utilization: stats.size / stats.maxSize,
            hitRate: stats.hits + stats.misses > 0 ? stats.hits / (stats.hits + stats.misses) : 0,
          },
          l2: {
            status: l2 ? 'healthy' : 'not_configured',
          },
          overall: l2 ? 'healthy' : 'degraded_l2_missing',
        },
      });
    },
  );

  // ─── Cleanup Expired ────────────────────────────────────────────────────

  app.post(
    '/cleanup',
    { preHandler: [authenticateUser, requirePermission({ resource: 'cache', action: 'write' })] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      if (!cache) {
        return handleError(reply, new ServiceUnavailableError('Cache service not initialized'));
      }

      const l1 = cache.getL1Cache();
      const cleaned = l1.cleanupExpired();

      return reply.send({
        success: true,
        data: { cleaned },
        message: `Cleaned up ${cleaned} expired entries`,
      });
    },
  );

  // ─── Get Specific Key (Debug) ───────────────────────────────────────────

  app.get(
    '/:key',
    { preHandler: [authenticateUser, requirePermission({ resource: 'cache', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!cache) {
        return handleError(reply, new ServiceUnavailableError('Cache service not initialized'));
      }

      const { key } = request.params as { key: string };
      const value = await cache.get(key);

      if (value === undefined) {
        return handleError(reply, new NotFoundError('CACHE_MISS'))
      }

      return reply.send({ success: true, data: { key, value } });
    },
  );

  // ─── Delete Specific Key ────────────────────────────────────────────────

  app.delete(
    '/:key',
    { preHandler: [authenticateUser, requirePermission({ resource: 'cache', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!cache) {
        return handleError(reply, new ServiceUnavailableError('Cache service not initialized'));
      }

      const { key } = request.params as { key: string };
      await cache.delete(key);

      return reply.send({ success: true, message: `Key "${key}" deleted from cache` });
    },
  );
}
