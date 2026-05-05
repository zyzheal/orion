/**
 * Community API Routes
 *
 * Routes under /v1/community
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CommunityController } from './controllers/CommunityController';

const controller = new CommunityController();

export default async function communityRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/community/contributions - Create contribution
  app.post('/contributions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createContribution(request, reply);
  });

  // GET /v1/community/contributions - List contributions
  app.get('/contributions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listContributions(request, reply);
  });

  // GET /v1/community/contributions/:id - Get contribution details
  app.get('/contributions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getContribution(request, reply);
  });

  // GET /v1/community/contributors/:userId - Get contributor info
  app.get('/contributors/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getContributor(request, reply);
  });

  // POST /v1/community/plugins - Submit plugin
  app.post('/plugins', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.submitPlugin(request, reply);
  });

  // POST /v1/community/plugins/:id/review - Review plugin
  app.post('/plugins/:id/review', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.reviewPlugin(request, reply);
  });
}
