/**
 * Cross-Domain Orchestration API Routes
 *
 * Prefix: /api/v1/orchestration
 *
 * Provides endpoints for creating, executing, pausing, resuming,
 * and aborting cross-domain orchestration flows.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { CrossDomainOrchestrator } from '../services/cross-domain-orchestration/CrossDomainOrchestrator';
import { DomainConnector } from '../services/cross-domain-orchestration/DomainConnector';
import { CrossDomainOrchestrationController } from './controllers/CrossDomainOrchestrationController';

export interface CrossDomainRoutesOptions {
  database?: DatabasePool;
}

export default async function crossDomainRoutes(
  app: FastifyInstance,
  options: CrossDomainRoutesOptions
): Promise<void> {
  // Initialize services
  const domainConnector = new DomainConnector();
  const orchestrator = new CrossDomainOrchestrator({
    domainConnector,
  });
  const controller = new CrossDomainOrchestrationController(orchestrator);

  // POST /api/v1/orchestration - Create orchestration
  app.post('/v1/orchestration', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // GET /api/v1/orchestration - List orchestrations
  app.get('/v1/orchestration', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /api/v1/orchestration/:id - Get orchestration details
  app.get('/v1/orchestration/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getById(request, reply);
  });

  // POST /api/v1/orchestration/:id/execute - Execute orchestration
  app.post('/v1/orchestration/:id/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.execute(request, reply);
  });

  // POST /api/v1/orchestration/:id/pause - Pause orchestration
  app.post('/v1/orchestration/:id/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.pause(request, reply);
  });

  // POST /api/v1/orchestration/:id/resume - Resume orchestration
  app.post('/v1/orchestration/:id/resume', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.resume(request, reply);
  });

  // POST /api/v1/orchestration/:id/abort - Abort orchestration
  app.post('/v1/orchestration/:id/abort', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.abort(request, reply);
  });
}
