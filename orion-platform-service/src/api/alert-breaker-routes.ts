/**
 * Alert Breaker API Routes
 *
 * Circuit breaker rules for alert suppression and evaluation.
 *
 * Prefix: /api/v1/alert-breakers
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { DatabasePool } from '../services/database';
import { AlertBreakerRuleRepository, AlertBreakerStateRepository } from '../services/alert-breaker/AlertBreakerRepository';
import { AlertBreakerService } from '../services/alert-breaker/AlertBreakerService';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'alert-breaker-routes' });

interface AlertBreakerRoutesOptions {
  database: DatabasePool;
}

export default async function alertBreakerRoutes(
  app: FastifyInstance,
  options: AlertBreakerRoutesOptions,
): Promise<void> {
  const ruleRepo = new AlertBreakerRuleRepository(options.database);
  const stateRepo = new AlertBreakerStateRepository(options.database);
  const service = new AlertBreakerService(ruleRepo, stateRepo);

  // ── POST /rules — Create breaker rule ───────────────────────────────────
  app.post('/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'alert-breaker', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'name is required');
      }
      const rule = await service.createRule(body);
      return created(reply, request, rule);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create alert breaker rule');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /rules — List rules ─────────────────────────────────────────────
  app.get('/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'alert-breaker', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const rules = await service.listRules({
        ruleType: query.ruleType,
      });
      return success(reply, request, rules);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list alert breaker rules');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /rules/:id — Get rule ───────────────────────────────────────────
  app.get('/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'alert-breaker', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const rule = await service.getRule(id);
      return success(reply, request, rule);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, ruleId: (request.params as any).id }, 'Failed to get alert breaker rule');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /rules/:id — Update rule ────────────────────────────────────────
  app.put('/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'alert-breaker', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const rule = await service.updateRule(id, body);
      return success(reply, request, rule);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, ruleId: (request.params as any).id }, 'Failed to update alert breaker rule');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /rules/:id — Delete rule ─────────────────────────────────────
  app.delete('/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'alert-breaker', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteRule(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, ruleId: (request.params as any).id }, 'Failed to delete alert breaker rule');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /evaluate — Evaluate alert against rules ───────────────────────
  app.post('/evaluate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'alert-breaker', action: 'evaluate' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.alert) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'alert is required');
      }
      const result = await service.evaluateAlert(body.alert);
      return success(reply, request, result);
    } catch (err: any) {
      logger.error({ err }, 'Failed to evaluate alert against breaker rules');
      return internalError(reply, request, err.message);
    }
  });
}
