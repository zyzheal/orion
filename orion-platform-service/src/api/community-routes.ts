/**
 * Community API Routes
 *
 * Routes under /v1/community
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CommunityController } from './controllers/CommunityController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';

export default async function communityRoutes(
  app: FastifyInstance,
  options: { database?: DatabasePool } = {},
): Promise<void> {
  const controller = new CommunityController(options.database);

  // POST /v1/community/contributions - Create contribution
  app.post('/contributions', { onRequest: [authenticateUser, requirePermission({ resource: 'community', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createContribution(request, reply);
  });

  // GET /v1/community/contributions - List contributions
  app.get('/contributions', { onRequest: [authenticateUser, requirePermission({ resource: 'community', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listContributions(request, reply);
  });

  // GET /v1/community/contributions/:id - Get contribution details
  app.get('/contributions/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'community', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getContribution(request, reply);
  });

  // GET /v1/community/contributors/:userId - Get contributor info
  app.get('/contributors/:userId', { onRequest: [authenticateUser, requirePermission({ resource: 'community', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getContributor(request, reply);
  });

  // POST /v1/community/plugins - Submit plugin
  app.post('/plugins', { onRequest: [authenticateUser, requirePermission({ resource: 'community', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.submitPlugin(request, reply);
  });

  // POST /v1/community/plugins/:id/review - Review plugin
  app.post('/plugins/:id/review', { onRequest: [authenticateUser, requirePermission({ resource: 'community', action: 'manage' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.reviewPlugin(request, reply);
  });
}
