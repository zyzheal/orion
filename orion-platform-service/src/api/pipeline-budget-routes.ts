/**
 * Pipeline Budget Management API Routes
 *
 * Routes under /api/v1/pipelines/:pipelineId/budget
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PipelineBudgetService } from '../services/pipeline/PipelineBudgetService';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRepository } from '../services/pipeline/PipelineRepository';
import { PipelineBudgetController } from './controllers/PipelineBudgetController';

interface PipelineBudgetRoutesOptions {
  database?: DatabasePool;
}

export default async function pipelineBudgetRoutes(
  app: FastifyInstance,
  options: PipelineBudgetRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[PipelineBudgetRoutes] No database pool available, routes will not be functional');
    return;
  }

  const pipelineRepository = new PipelineRepository(options.database);
  const pipelineService = new PipelineService(pipelineRepository);
  const budgetService = new PipelineBudgetService(options.database);
  const controller = new PipelineBudgetController(budgetService, pipelineService);

  // GET /v1/pipelines/:pipelineId/budget - Get budget config
  app.get('/:pipelineId/budget', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBudget(request, reply);
  });

  // PUT /v1/pipelines/:pipelineId/budget - Update budget config
  app.put('/:pipelineId/budget', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateBudget(request, reply);
  });

  // GET /v1/pipelines/:pipelineId/budget/estimate - Estimate budget
  app.get('/:pipelineId/budget/estimate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.estimateBudget(request, reply);
  });

  // GET /v1/pipelines/:pipelineId/runs/:runId/budget-usage - Get budget usage
  app.get('/:pipelineId/runs/:runId/budget-usage', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBudgetUsage(request, reply);
  });
}
