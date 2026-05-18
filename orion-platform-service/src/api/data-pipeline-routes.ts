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
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

const controller = new DataPipelineController();

export default async function dataPipelineRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/data-pipelines - Create pipeline
  app.post('/', { onRequest: [authenticateUser, requirePermission({ resource: 'data_pipeline', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createPipeline(request, reply);
  });

  // GET /v1/data-pipelines - List pipelines
  app.get('/', { onRequest: [authenticateUser, requirePermission({ resource: 'data_pipeline', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listPipelines(request, reply);
  });

  // POST /v1/data-pipelines/:id/execute - Execute pipeline
  app.post('/:id/execute', { onRequest: [authenticateUser, requirePermission({ resource: 'data_pipeline', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executePipeline(request, reply);
  });

  // GET /v1/data-pipelines/:id/executions - Get execution history
  app.get('/:id/executions', { onRequest: [authenticateUser, requirePermission({ resource: 'data_pipeline', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getExecutions(request, reply);
  });

  // GET /v1/data-pipelines/:id/lineage - Get data lineage
  app.get('/:id/lineage', { onRequest: [authenticateUser, requirePermission({ resource: 'data_pipeline', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getLineage(request, reply);
  });

  // GET /v1/data-pipelines/:id/schedule - Get schedule
  app.get('/:id/schedule', { onRequest: [authenticateUser, requirePermission({ resource: 'data_pipeline', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSchedule(request, reply);
  });

  // POST /v1/data-pipelines/:id/schedule - Set schedule
  app.post('/:id/schedule', { onRequest: [authenticateUser, requirePermission({ resource: 'data_pipeline', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.setSchedule(request, reply);
  });

  // GET /v1/data-pipelines/lineage/graph - Get lineage graph
  app.get('/lineage/graph', { onRequest: [authenticateUser, requirePermission({ resource: 'data_pipeline', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getLineageGraph(request, reply);
  });

  // GET /v1/data-pipelines/executions - Get all executions
  app.get('/executions', { onRequest: [authenticateUser, requirePermission({ resource: 'data_pipeline', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAllExecutions(request, reply);
  });
}
