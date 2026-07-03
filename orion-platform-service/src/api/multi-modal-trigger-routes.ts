/**
 * Multi-Modal Trigger API Routes
 *
 * Routes under /api/v1/triggers
 * Phase 3: Webhook, chat, schedule, event, and manual trigger management.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { MultiModalTriggerController } from './controllers/MultiModalTriggerController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'multi-modal-trigger-routes' });

interface MultiModalTriggerRoutesOptions {
  database?: DatabasePool;
}

export default async function multiModalTriggerRoutes(
  app: FastifyInstance,
  options: MultiModalTriggerRoutesOptions,
): Promise<void> {
  if (!options.database) {
    logger.warn('[MultiModalTriggerRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const controller = new MultiModalTriggerController(options.database);

  // ==================== Triggers ====================

  // POST /api/v1/triggers - Register a trigger
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'multi-modal', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerTrigger(request, reply);
  });

  // GET /api/v1/triggers - List triggers
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'multi-modal', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listTriggers(request, reply);
  });

  // ==================== Trigger Evaluation ====================

  // POST /api/v1/triggers/:id/evaluate - Evaluate trigger
  app.post('/:id/evaluate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'multi-modal', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.evaluateTrigger(request, reply);
  });

  // ==================== Pipeline Execution ====================

  // POST /api/v1/triggers/:id/execute - Execute pipeline from trigger
  app.post('/:id/execute', {
    onRequest: [authenticateUser, requirePermission({ resource: 'multi-modal', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executePipeline(request, reply);
  });

  // ==================== Webhook ====================

  // POST /api/v1/triggers/webhook - Register webhook
  app.post('/webhook', {
    onRequest: [authenticateUser, requirePermission({ resource: 'multi-modal', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerWebhook(request, reply);
  });

  // POST /api/v1/triggers/webhook/process - Process webhook event
  app.post('/webhook/process', {
    onRequest: [authenticateUser, requirePermission({ resource: 'multi-modal', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.processWebhookEvent(request, reply);
  });

  // GET /api/v1/triggers/webhook/history - Get webhook history
  app.get('/webhook/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'multi-modal', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getWebhookHistory(request, reply);
  });

  // ==================== Chat ====================

  // POST /api/v1/triggers/chat - Execute from chat
  app.post('/chat', {
    onRequest: [authenticateUser, requirePermission({ resource: 'multi-modal', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeFromChat(request, reply);
  });

  // ==================== Stats ====================

  // GET /api/v1/triggers/stats - Get trigger statistics
  app.get('/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'multi-modal', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTriggerStats(request, reply);
  });
}
