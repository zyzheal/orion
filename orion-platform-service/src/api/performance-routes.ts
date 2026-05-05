/**
 * Performance API Routes
 *
 * Routes under /v1/performance
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PerformanceController } from './controllers/PerformanceController';

const controller = new PerformanceController();

export default async function performanceRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/performance/baselines - Create baseline
  app.post('/baselines', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createBaseline(request, reply);
  });

  // GET /v1/performance/baselines - List baselines
  app.get('/baselines', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listBaselines(request, reply);
  });

  // POST /v1/performance/evaluate - Evaluate performance
  app.post('/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.evaluatePerformance(request, reply);
  });

  // GET /v1/performance/profile/:serviceName - Profile service
  app.get('/profile/:serviceName', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.profileService(request, reply);
  });

  // GET /v1/performance/bottlenecks - Get bottlenecks
  app.get('/bottlenecks', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBottlenecks(request, reply);
  });

  // GET /v1/performance/suggestions - Get suggestions
  app.get('/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSuggestions(request, reply);
  });
}
