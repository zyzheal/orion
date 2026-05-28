/**
 * Chaos Engineering API Routes
 *
 * Provides endpoints for chaos experiment management, fault injection,
 * and resilience scoring backed by PostgreSQL.
 *
 * Routes:
 *   POST   /api/v1/chaos/experiments          - Create experiment
 *   GET    /api/v1/chaos/experiments          - List experiments
 *   GET    /api/v1/chaos/experiments/:id      - Get experiment detail
 *   POST   /api/v1/chaos/experiments/:id/start - Start experiment
 *   POST   /api/v1/chaos/experiments/:id/inject - Inject fault
 *   POST   /api/v1/chaos/experiments/:id/stop  - Stop experiment
 *   GET    /api/v1/chaos/experiments/:id/status - Get experiment status
 *   GET    /api/v1/chaos/experiments/:id/recovery - Get recovery status
 *   GET    /api/v1/chaos/faults               - List fault types
 *   POST   /api/v1/chaos/faults/:type/config-template - Get fault config template
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import {
  ChaosExperimentService,
  ChaosExperimentRepository,
  ResilienceScoringService,
  FaultInjector,
} from '../services/chaos-engineering';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import pino from 'pino';

const logger = pino({ name: 'chaos-enhanced-routes' });

interface ChaosRoutesOptions {
  database?: DatabasePool;
}

export default async function chaosEnhancedRoutes(
  app: FastifyInstance,
  options: ChaosRoutesOptions
): Promise<void> {
  if (!options.database) {
    logger.warn('[ChaosRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const experimentService = new ChaosExperimentService(options.database);
  const resilienceScoringService = new ResilienceScoringService(options.database);
  const faultInjector = new FaultInjector();

  // ==================== Experiment Management ====================

  // POST /api/v1/chaos/experiments - Create experiment
  app.post('/experiments', { onRequest: [authenticateUser, requirePermission({ resource: 'chaos', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const experiment = await experimentService.createExperiment(request.body as any);
      return reply.status(201).send({ success: true, data: experiment });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CREATE_ERROR';
      return reply.status(400).send({ error: 'CREATE_ERROR', message });
    }
  });

  // GET /api/v1/chaos/experiments - List experiments
  app.get('/experiments', { onRequest: [authenticateUser, requirePermission({ resource: 'chaos', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const experiments = await experimentService.listExperiments(request.query as any);
      return reply.status(200).send({ success: true, data: experiments });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LIST_ERROR';
      return reply.status(500).send({ error: 'LIST_ERROR', message });
    }
  });

  // GET /api/v1/chaos/experiments/:id - Get experiment detail
  app.get('/experiments/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chaos', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const experiment = await experimentService.getExperiment(id);
      if (!experiment) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Experiment not found' });
      }
      return reply.status(200).send({ success: true, data: experiment });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GET_ERROR';
      return reply.status(500).send({ error: 'GET_ERROR', message });
    }
  });

  // POST /api/v1/chaos/experiments/:id/run - Run experiment
  app.post('/experiments/:id/run', { onRequest: [authenticateUser, requirePermission({ resource: 'chaos', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await experimentService.runExperiment(id, request.body as any);
      return reply.status(200).send({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'START_ERROR';
      return reply.status(400).send({ error: 'START_ERROR', message });
    }
  });

  // POST /api/v1/chaos/experiments/:id/inject - Inject fault
  app.post('/experiments/:id/inject', { onRequest: [authenticateUser, requirePermission({ resource: 'chaos', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const fault = request.body as any;
      const result = await faultInjector.inject(fault);
      return reply.status(200).send({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'INJECT_ERROR';
      return reply.status(400).send({ error: 'INJECT_ERROR', message });
    }
  });

  // POST /api/v1/chaos/experiments/:id/stop - Stop experiment
  app.post('/experiments/:id/stop', { onRequest: [authenticateUser, requirePermission({ resource: 'chaos', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await experimentService.rollbackRun(id);
      return reply.status(200).send({ success: true, data: { experimentId: id, stopped: true } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'STOP_ERROR';
      return reply.status(400).send({ error: 'STOP_ERROR', message });
    }
  });

  // GET /api/v1/chaos/experiments/:id/status - Get experiment status
  app.get('/experiments/:id/status', { onRequest: [authenticateUser, requirePermission({ resource: 'chaos', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const experiment = await experimentService.getExperiment(id);
      return reply.status(200).send({ success: true, data: { status: experiment.status, id: experiment.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'STATUS_ERROR';
      return reply.status(500).send({ error: 'STATUS_ERROR', message });
    }
  });

  // GET /api/v1/chaos/experiments/:id/recovery - Get recovery status
  app.get('/experiments/:id/recovery', { onRequest: [authenticateUser, requirePermission({ resource: 'chaos', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const experiment = await experimentService.getExperiment(id);
      return reply.status(200).send({ success: true, data: { experimentId: id, status: experiment.status, recovery: 'not_available' } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'RECOVERY_ERROR';
      return reply.status(500).send({ error: 'RECOVERY_ERROR', message });
    }
  });

  // ==================== Fault Library ====================

  // GET /api/v1/chaos/faults - List fault types
  app.get('/faults', { onRequest: [authenticateUser, requirePermission({ resource: 'chaos', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const faults = ['network_latency', 'service_down', 'cpu_stress', 'memory_stress', 'disk_full'];
    return reply.status(200).send({ success: true, data: faults });
  });

  // POST /api/v1/chaos/faults/:type/config-template - Get fault config template
  app.post('/faults/:type/config-template', { onRequest: [authenticateUser, requirePermission({ resource: 'chaos', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { type } = request.params as { type: string };
      const templates: Record<string, any> = {
        network_latency: { latency_ms: 100, jitter_ms: 10 },
        service_down: { graceful_shutdown: true },
        cpu_stress: { stress_percent: 80 },
        memory_stress: { memory_mb: 512 },
        disk_full: { fill_percent: 90 },
      };
      const template = templates[type] || { error: 'Unknown fault type' };
      return reply.status(200).send({ success: true, data: template });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TEMPLATE_ERROR';
      return reply.status(400).send({ error: 'TEMPLATE_ERROR', message });
    }
  });
}
