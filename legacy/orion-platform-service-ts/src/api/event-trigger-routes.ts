/**
 * Event Trigger API Routes
 *
 * Event-driven trigger rules for automated actions.
 *
 * Prefix: /api/v1/event-triggers
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { DatabasePool } from '../services/database';
import { EventTriggerRuleRepository, EventTriggerLogRepository } from '../services/event-trigger/EventTriggerRepository';
import { EventTriggerService } from '../services/event-trigger/EventTriggerService';
import { createLogger } from '../utils/logger';

const logger = createLogger('event-trigger-routes');

interface EventTriggerRoutesOptions {
  database: DatabasePool;
}

export default async function eventTriggerRoutes(
  app: FastifyInstance,
  options: EventTriggerRoutesOptions,
): Promise<void> {
  const ruleRepo = new EventTriggerRuleRepository(options.database);
  const logRepo = new EventTriggerLogRepository(options.database);
  const service = new EventTriggerService(ruleRepo, logRepo);

  // ── POST /rules — Create trigger rule ───────────────────────────────────
  app.post('/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'event-trigger', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.eventType) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'name and eventType are required');
      }
      const rule = await service.createRule(body);
      return created(reply, request, rule);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create event trigger rule');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /rules — List rules ─────────────────────────────────────────────
  app.get('/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'event-trigger', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const rules = await service.listRules({ eventType: query.eventType });
      return success(reply, request, rules);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list event trigger rules');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /rules/:id — Get rule ───────────────────────────────────────────
  app.get('/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'event-trigger', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const rule = await service.getRule(id);
      return success(reply, request, rule);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, ruleId: (request.params as any).id }, 'Failed to get event trigger rule');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /rules/:id — Update rule ────────────────────────────────────────
  app.put('/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'event-trigger', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const rule = await service.updateRule(id, body);
      return success(reply, request, rule);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, ruleId: (request.params as any).id }, 'Failed to update event trigger rule');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /rules/:id — Delete rule ─────────────────────────────────────
  app.delete('/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'event-trigger', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteRule(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, ruleId: (request.params as any).id }, 'Failed to delete event trigger rule');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /evaluate — Evaluate event against rules ───────────────────────
  app.post('/evaluate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'event-trigger', action: 'evaluate' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.event) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'event is required');
      }
      const result = await service.evaluateAndExecute(body.event);
      return success(reply, request, result);
    } catch (err: any) {
      logger.error({ err }, 'Failed to evaluate event against trigger rules');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /rules/:id/logs — Get execution logs for a rule ─────────────────
  app.get('/rules/:id/logs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'event-trigger', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const query = request.query as any;
      const logs = await service.getExecutionLogs(id, query.limit ? parseInt(query.limit, 10) : 20);
      return success(reply, request, logs);
    } catch (err: any) {
      logger.error({ err, ruleId: (request.params as any).id }, 'Failed to get execution logs');
      return internalError(reply, request, err.message);
    }
  });
}
