/**
 * ML Canary Analysis API Routes
 *
 * Routes under /api/v1/canary-analysis
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CanaryAnalysisService } from '../services/canary-analysis/CanaryAnalysisService';
import { CanaryAnalysisController } from './controllers/CanaryAnalysisController';
import { EventBusService } from '../services/event-bus-service';

export default async function canaryAnalysisRoutes(
  app: FastifyInstance,
  options?: { eventBus?: EventBusService }
): Promise<void> {
  const service = new CanaryAnalysisService({ eventBus: options?.eventBus });
  const controller = new CanaryAnalysisController(service);

  // ==================== Runs ====================

  app.get('/runs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listRuns(request, reply);
  });

  app.post('/runs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createRun(request, reply);
  });

  app.get('/runs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    if (params.id === 'metrics' || params.id === 'ml-results' || params.id === 'force-promote' || params.id === 'force-rollback') {
      return reply.callNotFound();
    }
    return controller.getRun(request, reply);
  });

  app.get('/runs/:id/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getMetrics(request, reply);
  });

  app.get('/runs/:id/ml-results', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getMLResults(request, reply);
  });

  // ==================== Configs ====================

  app.get('/configs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listConfigs(request, reply);
  });

  app.post('/configs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createConfig(request, reply);
  });

  app.get('/configs/:service/:env', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getConfigByServiceEnv(request, reply);
  });

  app.put('/configs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateConfig(request, reply);
  });

  app.delete('/configs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteConfig(request, reply);
  });

  // ==================== Force Actions ====================

  app.post('/force-promote', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.forcePromote(request, reply);
  });

  app.post('/force-rollback', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.forceRollback(request, reply);
  });
}
