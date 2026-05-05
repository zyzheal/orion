/**
 * Data Pipeline API Routes
 *
 * Routes under /v1/data-pipelines
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DataPipelineController } from './controllers/DataPipelineController';

const controller = new DataPipelineController();

export default async function dataPipelineRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/data-pipelines - Create pipeline
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createPipeline(request, reply);
  });

  // GET /v1/data-pipelines - List pipelines
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listPipelines(request, reply);
  });

  // POST /v1/data-pipelines/:id/execute - Execute pipeline
  app.post('/:id/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executePipeline(request, reply);
  });

  // POST /v1/data-pipelines/:id/schedule - Schedule pipeline
  app.post('/:id/schedule', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.schedulePipeline(request, reply);
  });

  // GET /v1/data-pipelines/:id/status - Get pipeline status
  app.get('/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPipelineStatus(request, reply);
  });

  // GET /v1/data-pipelines/:id/lineage - Get data lineage
  app.get('/:id/lineage', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDataLineage(request, reply);
  });
}
