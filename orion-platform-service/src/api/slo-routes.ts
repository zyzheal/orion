/**
 * SLO/SLI Tracking API Routes
 *
 * Routes under /api/v1/slo
 * Manages SLO definitions, SLI measurements, and error budgets.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { SLODefinitionRepository } from '../repositories/SLODefinitionRepository';
import { SLIMeasurementRepository } from '../repositories/SLIMeasurementRepository';
import { ErrorBudgetRepository } from '../repositories/ErrorBudgetRepository';
import { SLOTrackingService } from '../services/observability/SLOTrackingService';
import { handleError } from '../errors';
import pino from 'pino';

const logger = pino({ name: 'slo-routes' });

interface SLORoutesOptions {
  database: DatabasePool;
}

export default async function sloRoutes(
  app: FastifyInstance,
  options: SLORoutesOptions,
): Promise<void> {
  const { database } = options;

  const sloRepo = new SLODefinitionRepository(database);
  const sliRepo = new SLIMeasurementRepository(database);
  const budgetRepo = new ErrorBudgetRepository(database);
  const sloService = new SLOTrackingService(sloRepo, sliRepo, budgetRepo);

  // ==================== SLO Definitions ====================

  // POST /api/v1/slo/definitions - Create SLO definition
  app.post('/definitions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'slo', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const slo = await sloService.createSLO({
        name: body.name,
        description: body.description,
        sloType: body.sloType,
        targetValue: body.targetValue,
        targetUnit: body.targetUnit,
        promqlQuery: body.promqlQuery,
        windowDays: body.windowDays,
        alertThreshold: body.alertThreshold,
        enabled: body.enabled,
      });
      return reply.status(201).send({ success: true, data: slo });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to create SLO definition');
      handleError(reply, error);
    }
  });

  // GET /api/v1/slo/definitions - List SLO definitions
  app.get('/definitions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'slo', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const slos = await sloService.listSLOs({
        sloType: query.sloType,
        enabled: query.enabled === 'true' ? true : undefined,
      });
      return reply.status(200).send({ success: true, data: slos, total: slos.length });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to list SLO definitions');
      handleError(reply, error);
    }
  });

  // GET /api/v1/slo/definitions/:id - Get SLO detail
  app.get('/definitions/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'slo', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const slo = await sloService.getSLO(id);
      const currentSLI = await sloService.getCurrentSLI(id);
      const errorBudget = await sloService.getLatestErrorBudget(id);
      return reply.status(200).send({
        success: true,
        data: { ...slo, currentSLI, errorBudget },
      });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to get SLO definition');
      handleError(reply, error);
    }
  });

  // PUT /api/v1/slo/definitions/:id - Update SLO definition
  app.put('/definitions/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'slo', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const slo = await sloService.updateSLO(id, body);
      return reply.status(200).send({ success: true, data: slo });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to update SLO definition');
      handleError(reply, error);
    }
  });

  // DELETE /api/v1/slo/definitions/:id - Delete SLO definition
  app.delete('/definitions/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'slo', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      await sloService.deleteSLO(id);
      return reply.status(200).send({ success: true, message: 'SLO definition deleted' });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to delete SLO definition');
      handleError(reply, error);
    }
  });

  // ==================== SLI Measurements ====================

  // POST /api/v1/slo/:id/measurements - Record SLI measurement
  app.post('/:id/measurements', {
    onRequest: [authenticateUser, requirePermission({ resource: 'slo', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const measurement = await sloService.recordSLI(id, body.sliValue);
      return reply.status(201).send({ success: true, data: measurement });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to record SLI measurement');
      handleError(reply, error);
    }
  });

  // GET /api/v1/slo/:id/measurements - Get SLI history
  app.get('/:id/measurements', {
    onRequest: [authenticateUser, requirePermission({ resource: 'slo', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const query = request.query as any;
      const limit = parseInt(query.limit, 10) || 100;
      const measurements = await sloService.getSLIHistory(id, limit);
      return reply.status(200).send({ success: true, data: measurements, total: measurements.length });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to get SLI history');
      handleError(reply, error);
    }
  });

  // ==================== Error Budget ====================

  // GET /api/v1/slo/:id/error-budget - Calculate and get error budget
  app.get('/:id/error-budget', {
    onRequest: [authenticateUser, requirePermission({ resource: 'slo', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const budget = await sloService.calculateErrorBudget(id);
      return reply.status(200).send({ success: true, data: budget });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to calculate error budget');
      handleError(reply, error);
    }
  });

  // GET /api/v1/slo/:id/error-budget/history - Get error budget history
  app.get('/:id/error-budget/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'slo', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const query = request.query as any;
      const limit = parseInt(query.limit, 10) || 30;
      const history = await sloService.getErrorBudgetHistory(id, limit);
      return reply.status(200).send({ success: true, data: history, total: history.length });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to get error budget history');
      handleError(reply, error);
    }
  });

  // ==================== Dashboard ====================

  // GET /api/v1/slo/dashboard - SLO dashboard
  app.get('/dashboard', {
    onRequest: [authenticateUser, requirePermission({ resource: 'slo', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dashboard = await sloService.getDashboard();
      return reply.status(200).send({ success: true, data: dashboard, total: dashboard.length });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to get SLO dashboard');
      handleError(reply, error);
    }
  });
}
