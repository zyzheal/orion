import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { CacheStrategyService } from '../services/CacheStrategyService';
import type { CacheStrategyCreateInput, CacheStrategyUpdateInput, CacheType } from '../models/CacheStrategy';

export async function cacheStrategyRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  const cacheService = new CacheStrategyService(opts.database);

  // ==================== Cache Strategy CRUD ====================

  // List cache strategies
  fastify.get('/cache-strategies', async (request) => {
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    return cacheService.list({
      tenantId,
      type: query.type as CacheType | undefined,
      enabled: query.enabled !== undefined ? query.enabled === 'true' : undefined,
      page: parseInt(query.page, 10) || 1,
      limit: parseInt(query.limit, 10) || 20,
    });
  });

  // Get cache strategy by ID
  fastify.get('/cache-strategies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    const strategy = await cacheService.getById(tenantId, id);
    if (!strategy) return reply.code(404).send({ error: 'Cache strategy not found' });
    return strategy;
  });

  // Create cache strategy
  fastify.post('/cache-strategies', async (request, reply) => {
    const body = request.body as CacheStrategyCreateInput;
    body.tenantId = body.tenantId || 'default';
    const strategy = await cacheService.create(body);
    return reply.code(201).send(strategy);
  });

  // Update cache strategy
  fastify.put('/cache-strategies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    const body = request.body as CacheStrategyUpdateInput;
    const strategy = await cacheService.update(tenantId, id, body);
    if (!strategy) return reply.code(404).send({ error: 'Cache strategy not found' });
    return strategy;
  });

  // Delete cache strategy
  fastify.delete('/cache-strategies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    const deleted = await cacheService.delete(tenantId, id);
    if (!deleted) return reply.code(404).send({ error: 'Cache strategy not found' });
    return reply.code(204).send();
  });

  // ==================== Cache Recommendations ====================

  // Get recommended cache for a type
  fastify.get('/cache-recommendations/:type', async (request, reply) => {
    const { type } = request.params as { type: CacheType };
    try {
      return await cacheService.getRecommendedCache(type);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // Get all recommendations
  fastify.get('/cache-recommendations', async () => {
    return cacheService.getAllRecommendations();
  });

  // Create recommended cache strategy
  fastify.post('/cache-strategies/recommended', async (request, reply) => {
    const body = request.body as {
      type: CacheType;
      name: string;
      tenantId?: string;
      createdBy?: string;
    };
    const tenantId = body.tenantId || 'default';

    try {
      const strategy = await cacheService.createRecommendedCache(
        tenantId,
        body.type,
        body.name,
        body.createdBy
      );
      return reply.code(201).send(strategy);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // ==================== Cache Statistics ====================

  // Get cache stats for a strategy
  fastify.get('/cache-strategies/:id/stats', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    const strategy = await cacheService.getById(tenantId, id);
    if (!strategy) return reply.code(404).send({ error: 'Cache strategy not found' });
    return cacheService.getCacheStats(tenantId, id);
  });

  // Get all cache stats for tenant
  fastify.get('/cache-stats', async (request) => {
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    return cacheService.getAllCacheStats(tenantId);
  });

  // ==================== Cache Operations ====================

  // Warm cache
  fastify.post('/cache-strategies/:id/warm', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    const result = await cacheService.warmCache(tenantId, id);
    if (!result.success) return reply.code(400).send(result);
    return result;
  });

  // Record cache hit
  fastify.post('/cache-strategies/:id/hit', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    await cacheService.recordHit(tenantId, id);
    return { success: true };
  });

  // Record cache miss
  fastify.post('/cache-strategies/:id/miss', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    await cacheService.recordMiss(tenantId, id);
    return { success: true };
  });

  // Generate cache key
  fastify.post('/cache-strategies/:id/generate-key', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    const body = request.body as { context: Record<string, string> };

    const strategy = await cacheService.getById(tenantId, id);
    if (!strategy) return reply.code(404).send({ error: 'Cache strategy not found' });

    const key = cacheService.generateCacheKey(strategy.keyTemplate, body.context || {});
    return { key };
  });
}