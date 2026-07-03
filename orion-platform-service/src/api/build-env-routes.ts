/**
 * Build Environment API Routes
 *
 * Routes under /api/v1/build-env
 * Handles build CRUD, build images, build cache, and build logs.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { CacheMonitorService } from '../services/cache-monitor/CacheMonitorService';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, UnauthorizedError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

const logger = pino({ name: 'build-env-routes' });

interface BuildEnvRoutesOptions {
  database?: DatabasePool;
}

export default async function buildEnvRoutes(
  app: FastifyInstance,
  options: BuildEnvRoutesOptions
): Promise<void> {
  // ==================== Builds ====================

  // GET /api/v1/build-env/builds - List builds
  app.get('/builds', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const data = {
        builds: [],
        total: 0,
        page: parseInt(query.page, 10) || 1,
        limit: parseInt(query.limit, 10) || 20,
      };
      return reply.status(200).send({ success: true, data });
    } catch (error: any) {
      logger.error({ error }, 'Failed to list builds');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/build-env/builds/:id - Get build by ID
  app.get('/builds/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      // BuildService.getBuild(id) would be called here with database
      return reply.status(200).send({ success: true, data: { id } });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to get build');
      if (error.code === 'BUILD_NOT_FOUND') {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /api/v1/build-env/builds - Create build
  app.post('/builds', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      // BuildService.createBuild(body) would be called here with database
      return reply.status(201).send({ success: true, data: { id: `build_${Date.now()}`, ...body } });
    } catch (error: any) {
      logger.error({ error }, 'Failed to create build');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /api/v1/build-env/builds/:id - Update build
  app.put('/builds/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const body = request.body as any;
      // BuildService would be called here with database
      return reply.status(200).send({ success: true, data: { id, ...body } });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to update build');
      if (error.code === 'BUILD_NOT_FOUND') {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /api/v1/build-env/builds/:id - Delete build
  app.delete('/builds/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      // BuildService would be called here with database
      return reply.status(204).send();
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to delete build');
      if (error.code === 'BUILD_NOT_FOUND') {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Build Images ====================

  // GET /api/v1/build-env/build-images - List build images
  app.get('/build-images', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // BuilderImageService.list() would be called here
      return reply.status(200).send({ success: true, data: { images: [], total: 0 } });
    } catch (error: any) {
      logger.error({ error }, 'Failed to list build images');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/build-env/build-images/:id - Get build image by ID
  app.get('/build-images/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      // BuilderImageService.getById(id) would be called here
      return reply.status(200).send({ success: true, data: { id } });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to get build image');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /api/v1/build-env/build-images - Create build image
  app.post('/build-images', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      // BuilderImageService.create(body) would be called here
      return reply.status(201).send({ success: true, data: { id: `img_${Date.now()}`, ...body } });
    } catch (error: any) {
      logger.error({ error }, 'Failed to create build image');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /api/v1/build-env/build-images/:id - Update build image
  app.put('/build-images/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const body = request.body as any;
      // BuilderImageService.update(id, body) would be called here
      return reply.status(200).send({ success: true, data: { id, ...body } });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to update build image');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /api/v1/build-env/build-images/:id - Delete build image
  app.delete('/build-images/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      // BuilderImageService.delete(id) would be called here
      return reply.status(204).send();
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to delete build image');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Build Cache ====================

  // GET /api/v1/build-env/build-cache - List cache configs
  app.get('/build-cache', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // BuildCacheService would be called here
      return reply.status(200).send({ success: true, data: { configs: [], total: 0 } });
    } catch (error: any) {
      logger.error({ error }, 'Failed to list build cache configs');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/build-env/build-cache/:id - Get cache config by ID
  app.get('/build-cache/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      // BuildCacheService.getConfig(id) would be called here
      return reply.status(200).send({ success: true, data: { id } });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to get build cache config');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /api/v1/build-env/build-cache - Create cache config
  app.post('/build-cache', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      // BuildCacheService.createConfig(body) would be called here
      return reply.status(201).send({ success: true, data: { id: `cache_${Date.now()}`, ...body } });
    } catch (error: any) {
      logger.error({ error }, 'Failed to create build cache config');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /api/v1/build-env/build-cache/:id - Update cache config
  app.put('/build-cache/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const body = request.body as any;
      // BuildCacheService.updateConfig(id, body) would be called here
      return reply.status(200).send({ success: true, data: { id, ...body } });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to update build cache config');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /api/v1/build-env/build-cache/:id - Delete cache config
  app.delete('/build-cache/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      // BuildCacheService.deleteConfig(id) would be called here
      return reply.status(204).send();
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to delete build cache config');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Build Logs ====================

  // GET /api/v1/build-env/build-logs - List build logs
  app.get('/build-logs', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      // BuildLogService would be called here
      return reply.status(200).send({ success: true, data: { logs: [], total: 0 } });
    } catch (error: any) {
      logger.error({ error }, 'Failed to list build logs');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/build-env/build-logs/:id - Get build log by ID
  app.get('/build-logs/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      // BuildLogService.getLog(id) would be called here
      return reply.status(200).send({ success: true, data: { id } });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to get build log');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Cache Monitor ====================

  const cacheMonitorService = options.database ? new CacheMonitorService(options.database) : null;

  // GET /api/v1/build-env/cache-monitor/dashboard - Get cache monitoring dashboard
  app.get('/cache-monitor/dashboard', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!cacheMonitorService) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }
      const tenantId = (request as any).user?.tenantId;
      if (!tenantId) {
        return handleError(reply, new UnauthorizedError('UNAUTHORIZED'));
      }
      const dashboard = await cacheMonitorService.getDashboard(tenantId);
      return reply.status(200).send({ success: true, data: dashboard });
    } catch (error: any) {
      logger.error({ error }, 'Failed to get cache monitor dashboard');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/build-env/cache-monitor/metrics/:cacheId - Get cache metrics
  app.get('/cache-monitor/metrics/:cacheId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!cacheMonitorService) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }
      const { cacheId } = (request.params as any);
      const metrics = await cacheMonitorService.getCacheMetrics(cacheId);
      if (!metrics) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }
      return reply.status(200).send({ success: true, data: metrics });
    } catch (error: any) {
      logger.error({ error }, 'Failed to get cache metrics');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/build-env/cache-monitor/health/:cacheId - Assess cache health
  app.get('/cache-monitor/health/:cacheId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!cacheMonitorService) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }
      const { cacheId } = (request.params as any);
      const health = await cacheMonitorService.assessCacheHealth(cacheId);
      return reply.status(200).send({ success: true, data: health });
    } catch (error: any) {
      logger.error({ error }, 'Failed to assess cache health');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/build-env/cache-monitor/impact/:pipelineId - Analyze performance impact
  app.get('/cache-monitor/impact/:pipelineId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!cacheMonitorService) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }
      const tenantId = (request as any).user?.tenantId;
      if (!tenantId) {
        return handleError(reply, new UnauthorizedError('UNAUTHORIZED'));
      }
      const { pipelineId } = (request.params as any);
      const impact = await cacheMonitorService.analyzePerformanceImpact(options.database!, pipelineId, tenantId);
      return reply.status(200).send({ success: true, data: impact });
    } catch (error: any) {
      logger.error({ error }, 'Failed to analyze cache performance impact');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /api/v1/build-env/cache-monitor/event - Record cache event
  app.post('/cache-monitor/event', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!cacheMonitorService) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }
      const tenantId = (request as any).user?.tenantId;
      if (!tenantId) {
        return handleError(reply, new UnauthorizedError('UNAUTHORIZED'));
      }
      const { cacheId, eventType, latencySavedMs } = request.body as any;
      if (!cacheId || !eventType) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }
      await cacheMonitorService.recordCacheEvent(cacheId, tenantId, eventType, latencySavedMs);
      return reply.status(201).send({ success: true });
    } catch (error: any) {
      logger.error({ error }, 'Failed to record cache event');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });
}
