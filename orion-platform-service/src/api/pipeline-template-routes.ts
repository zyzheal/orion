/**
 * Pipeline Template Management API Routes
 *
 * Routes under /api/v1/pipeline-templates
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PipelineTemplateService } from '../services/pipeline/PipelineTemplateService';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRepository } from '../services/pipeline/PipelineRepository';
import { PipelineTemplateController } from './controllers/PipelineTemplateController';

interface PipelineTemplateRoutesOptions {
  database?: DatabasePool;
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
  const pipelineService = new PipelineService(pipelineRepository);
  const templateService = new PipelineTemplateService(options.database);
  const controller = new PipelineTemplateController(templateService, pipelineService);

  // GET /v1/pipeline-templates - List templates
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listTemplates(request, reply);
  });

  // GET /v1/pipeline-templates/:templateId - Get template detail
  app.get('/:templateId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTemplate(request, reply);
  });

  // POST /v1/pipeline-templates - Create template
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createTemplate(request, reply);
  });

  // PUT /v1/pipeline-templates/:templateId - Update template
  app.put('/:templateId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateTemplate(request, reply);
  });

  // DELETE /v1/pipeline-templates/:templateId - Delete template
  app.delete('/:templateId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteTemplate(request, reply);
  });

  // POST /v1/pipeline-templates/:templateId/instantiate - Instantiate template
  app.post('/:templateId/instantiate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.instantiateTemplate(request, reply);
  });
}
