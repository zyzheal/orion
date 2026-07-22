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
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

export interface CrossDomainRoutesOptions {
  database?: DatabasePool;
}

export default async function crossDomainRoutes(
  app: FastifyInstance,
  options: CrossDomainRoutesOptions
): Promise<void> {
  if (!options.database) {
    return;
  }

  // Initialize services
  const domainConnector = new DomainConnector(options.database);
  const orchestrator = new CrossDomainOrchestrator(options.database, domainConnector);
  const controller = new CrossDomainOrchestrationController(orchestrator);

  // POST /api/v1/orchestration - Create orchestration
  app.post('/orchestration', { onRequest: [authenticateUser, requirePermission({ resource: 'cross_domain', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // GET /api/v1/orchestration - List orchestrations
  app.get('/orchestration', { onRequest: [authenticateUser, requirePermission({ resource: 'cross_domain', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /api/v1/orchestration/:id - Get orchestration details
  app.get('/orchestration/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'cross_domain', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getById(request, reply);
  });

  // POST /api/v1/orchestration/:id/execute - Execute orchestration
  app.post('/orchestration/:id/execute', { onRequest: [authenticateUser, requirePermission({ resource: 'cross_domain', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.execute(request, reply);
  });

  // POST /api/v1/orchestration/:id/pause - Pause orchestration
  app.post('/orchestration/:id/pause', { onRequest: [authenticateUser, requirePermission({ resource: 'cross_domain', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.pause(request, reply);
  });

  // POST /api/v1/orchestration/:id/resume - Resume orchestration
  app.post('/orchestration/:id/resume', { onRequest: [authenticateUser, requirePermission({ resource: 'cross_domain', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.resume(request, reply);
  });

  // POST /api/v1/orchestration/:id/abort - Abort orchestration
  app.post('/orchestration/:id/abort', { onRequest: [authenticateUser, requirePermission({ resource: 'cross_domain', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.abort(request, reply);
  });
}
