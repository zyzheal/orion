/**
 * Canary Traffic API Routes - Phase 3
 *
 * Routes under /api/v1/canary/deployments
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { CanaryTrafficService } from '../services/canary-traffic/CanaryTrafficService';
import { TrafficSplitter } from '../services/canary-traffic/TrafficSplitter';
import { CanaryTrafficController } from './controllers/CanaryTrafficController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface CanaryTrafficOptions {
  database?: DatabasePool;
}

export default async function canaryTrafficRoutes(
  app: FastifyInstance,
  options: CanaryTrafficOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[CanaryTrafficRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const service = new CanaryTrafficService(options.database);
  const splitter = new TrafficSplitter(service);
  const controller = new CanaryTrafficController(service, splitter);

  // ==================== Canary Deployments ====================

  // POST /api/v1/canary/deployments - Create a canary deployment
  app.post('/', { onRequest: [authenticateUser, requirePermission({ resource: 'canary_traffic', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createCanaryDeployment(request, reply);
  });

  // GET /api/v1/canary/deployments - List canary deployments
  app.get('/', { onRequest: [authenticateUser, requirePermission({ resource: 'canary_traffic', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listCanaryDeployments(request, reply);
  });

  // GET /api/v1/canary/deployments/:id - Get canary deployment details
  app.get('/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'canary_traffic', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Avoid matching special paths
    const params = request.params as any;
    if (params.id === 'traffic' || params.id === 'promote' || params.id === 'rollback') {
      return reply.callNotFound();
    }
    return controller.getCanaryDeployment(request, reply);
  });

  // PUT /api/v1/canary/deployments/:id/traffic - Configure traffic split
  app.put('/:id/traffic', { onRequest: [authenticateUser, requirePermission({ resource: 'canary_traffic', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.configureTrafficSplit(request, reply);
  });

  // POST /api/v1/canary/deployments/:id/promote - Promote canary
  app.post('/:id/promote', { onRequest: [authenticateUser, requirePermission({ resource: 'canary_traffic', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.promoteCanary(request, reply);
  });

  // POST /api/v1/canary/deployments/:id/rollback - Rollback canary
  app.post('/:id/rollback', { onRequest: [authenticateUser, requirePermission({ resource: 'canary_traffic', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.rollbackCanary(request, reply);
  });
}
