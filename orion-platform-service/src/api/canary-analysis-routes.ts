/**
 * ML Canary Analysis API Routes
 *
 * Routes under /api/v1/canary-analysis
 * PostgreSQL Repository backed (replaces Map storage)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import {
  CanaryAnalysisRepository,
  CanaryMetricResultRepository,
  CanaryMLResultRepository,
  CanaryAnalysisConfigRepository,
  CanaryDecisionRepository,
  CanaryRetrainJobRepository,
} from '../repositories/CanaryAnalysisRepository';
import { CanaryAnalysisService } from '../services/canary-analysis/CanaryAnalysisService';
import { CanaryAnalysisController } from './controllers/CanaryAnalysisController';
import { EventBusService } from '../services/event-bus-service';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'canary-analysis-routes' });

interface CanaryAnalysisOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
}

export default async function canaryAnalysisRoutes(
  app: FastifyInstance,
  options: CanaryAnalysisOptions
): Promise<void> {
  if (!options.database) {
    logger.warn('[CanaryAnalysisRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const runRepository = new CanaryAnalysisRepository(options.database);
  const metricRepository = new CanaryMetricResultRepository(options.database);
  const mlRepository = new CanaryMLResultRepository(options.database);
  const configRepository = new CanaryAnalysisConfigRepository(options.database);
  const decisionRepository = new CanaryDecisionRepository(options.database);
  const retrainRepository = new CanaryRetrainJobRepository(options.database);

  const service = new CanaryAnalysisService(
    runRepository,
    metricRepository,
    mlRepository,
    configRepository,
    decisionRepository,
    retrainRepository,
  );
  const controller = new CanaryAnalysisController(service);

  // ==================== Runs ====================

  app.get('/runs', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listRuns(request, reply);
  });

  app.post('/runs', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createRun(request, reply);
  });

  app.get('/runs/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    if (params.id === 'metrics' || params.id === 'ml-results' || params.id === 'force-promote' || params.id === 'force-rollback') {
      return reply.callNotFound();
    }
    return controller.getRun(request, reply);
  });

  app.get('/runs/:id/metrics', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getMetrics(request, reply);
  });

  app.get('/runs/:id/ml-results', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getMLResults(request, reply);
  });

  // ==================== Configs ====================

  app.get('/configs', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listConfigs(request, reply);
  });

  app.post('/configs', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createConfig(request, reply);
  });

  app.get('/configs/:service/:env', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getConfigByServiceEnv(request, reply);
  });

  app.put('/configs/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateConfig(request, reply);
  });

  app.delete('/configs/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'delete' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteConfig(request, reply);
  });

  // ==================== Force Actions ====================

  app.post('/force-promote', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.forcePromote(request, reply);
  });

  app.post('/force-rollback', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.forceRollback(request, reply);
  });

  // ==================== Metric Discovery ====================

  app.get('/metrics/discover', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { serviceName?: string };
    try {
      const metrics = await service.discoverMetrics();
      return reply.send({ code: 200, message: 'OK', data: metrics });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Model Management ====================

  app.post('/models/retrain', { onRequest: [authenticateUser, requirePermission({ resource: 'canary', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { modelName?: string } | undefined;
    try {
      const result = await service.retrainModel(body?.modelName || 'default');
      return reply.send({ code: 200, message: 'OK', data: result });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
}
