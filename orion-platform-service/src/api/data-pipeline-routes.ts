/**
 * Data Pipeline API Routes
 *
 * Provides endpoints for data pipeline creation, execution, scheduling,
 * and data lineage tracking.
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

  // GET /v1/data-pipelines/:id/executions - Get execution history
  app.get('/:id/executions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getExecutions(request, reply);
  });

  // GET /v1/data-pipelines/:id/lineage - Get data lineage
  app.get('/:id/lineage', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getLineage(request, reply);
  });

  // GET /v1/data-pipelines/:id/schedule - Get schedule
  app.get('/:id/schedule', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSchedule(request, reply);
  });

  // POST /v1/data-pipelines/:id/schedule - Set schedule
  app.post('/:id/schedule', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.setSchedule(request, reply);
  });

  // GET /v1/data-pipelines/lineage/graph - Get lineage graph
  app.get('/lineage/graph', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getLineageGraph(request, reply);
  });

  // GET /v1/data-pipelines/executions - Get all executions
  app.get('/executions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAllExecutions(request, reply);
  });
}
