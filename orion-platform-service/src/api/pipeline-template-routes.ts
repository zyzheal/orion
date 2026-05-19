/**
 * Pipeline Template Management API Routes
 *
 * Routes under /api/v1/pipeline-templates
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { RedisCache } from '../services/redis-cache';
import { PipelineTemplateService } from '../services/pipeline/PipelineTemplateService';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRepository } from '../services/pipeline/PipelineRepository';
import { PipelineTemplateController } from './controllers/PipelineTemplateController';
import { CacheService } from '../services/cache/CacheService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface PipelineTemplateRoutesOptions {
  database?: DatabasePool;
  redis?: RedisCache;
}

export default async function pipelineTemplateRoutes(
  app: FastifyInstance,
  options: PipelineTemplateRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[PipelineTemplateRoutes] No database pool available, routes will not be functional');
    return;
  }

  const pipelineRepository = new PipelineRepository(options.database);
  const cache = new CacheService(options.redis || null, 60);
  const pipelineService = new PipelineService(pipelineRepository, cache);
  const templateService = new PipelineTemplateService(options.database);
  const controller = new PipelineTemplateController(templateService, pipelineService);

  // GET /v1/pipeline-templates - List templates
  app.get(
    '/',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listTemplates(request, reply);
  });

  // GET /v1/pipeline-templates/:templateId - Get template detail
  app.get(
    '/:templateId',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTemplate(request, reply);
  });

  // POST /v1/pipeline-templates - Create template
  app.post(
    '/',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createTemplate(request, reply);
  });

  // PUT /v1/pipeline-templates/:templateId - Update template
  app.put(
    '/:templateId',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateTemplate(request, reply);
  });

  // DELETE /v1/pipeline-templates/:templateId - Delete template
  app.delete(
    '/:templateId',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteTemplate(request, reply);
  });

  // POST /v1/pipeline-templates/:templateId/instantiate - Instantiate template
  app.post(
    '/:templateId/instantiate',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.instantiateTemplate(request, reply);
  });
}
