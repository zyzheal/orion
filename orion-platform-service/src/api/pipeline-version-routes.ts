/**
 * Pipeline Version Management API Routes
 *
 * Routes under /api/v1/pipelines/:pipelineId/versions
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { RedisCache } from '../services/redis-cache';
import { PipelineVersionService } from '../services/pipeline/PipelineVersionService';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRepository } from '../services/pipeline/PipelineRepository';
import { PipelineVersionController } from './controllers/PipelineVersionController';
import { CacheService } from '../services/cache/CacheService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'pipeline-version-routes' });

interface PipelineVersionRoutesOptions {
  database?: DatabasePool;
  redis?: RedisCache;
}

export default async function pipelineVersionRoutes(
  app: FastifyInstance,
  options: PipelineVersionRoutesOptions
): Promise<void> {
  if (!options.database) {
    logger.warn('[PipelineVersionRoutes] No database pool available, routes will not be functional');
    // Still register routes but they will fail at service level
    return;
  }

  const pipelineRepository = new PipelineRepository(options.database);
  const cache = new CacheService(options.redis || null, 60);
  const pipelineService = new PipelineService(pipelineRepository, cache);
  const versionService = new PipelineVersionService(options.database);
  const controller = new PipelineVersionController(versionService, pipelineService);

  // NOTE: GET /:pipelineId/versions is already registered via pipeline-routes-registrar.ts
  // (as /v1/pipelines/:id/versions). Only register additional endpoints here.

  // GET /v1/pipelines/:pipelineId/versions/:versionId - Get version detail
  app.get(
    '/:pipelineId/versions/:versionId',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getVersion(request, reply);
  });

  // GET /v1/pipelines/:pipelineId/versions/:versionId/diff - Diff two versions
  app.get(
    '/:pipelineId/versions/:versionId/diff',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.diffVersions(request, reply);
  });

  // POST /v1/pipelines/:pipelineId/versions/:versionId/rollback - Rollback to version
  app.post(
    '/:pipelineId/versions/:versionId/rollback',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.rollback(request, reply);
  });

  // POST /v1/pipelines/:pipelineId/versions/:versionId/tag - Add tag
  app.post(
    '/:pipelineId/versions/:versionId/tag',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addTag(request, reply);
  });

  // DELETE /v1/pipelines/:pipelineId/versions/:versionId/tag/:tag - Remove tag
  app.delete(
    '/:pipelineId/versions/:versionId/tag/:tag',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.removeTag(request, reply);
  });

  // POST /v1/pipelines/:pipelineId/versions/:versionId/baseline - Set/unset baseline
  app.post(
    '/:pipelineId/versions/:versionId/baseline',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.setBaseline(request, reply);
  });
}
