/**
 * Notification Policy API Routes
 *
 * Notification policy CRUD and workflow management.
 *
 * Prefix: /api/v1/notification-policies
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { DatabasePool } from '../services/database';
import { NotificationPolicyRepository, NotificationWorkflowRepository } from '../services/notification-policy/NotificationPolicyRepository';
import { NotificationPolicyService } from '../services/notification-policy/NotificationPolicyService';
import pino from 'pino';

const logger = pino({ name: 'notification-policy-routes' });

interface NotificationPolicyRoutesOptions {
  database: DatabasePool;
}

export default async function notificationPolicyRoutes(
  app: FastifyInstance,
  options: NotificationPolicyRoutesOptions,
): Promise<void> {
  const policyRepo = new NotificationPolicyRepository(options.database);
  const workflowRepo = new NotificationWorkflowRepository(options.database);
  const service = new NotificationPolicyService(policyRepo, workflowRepo);

  // ==================== Notification Policies ====================

  // ── POST / — Create policy ──────────────────────────────────────────────
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'notification-policy', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name) {
        return badRequest(reply, request, undefined, 'name is required');
      }
      const policy = await service.createPolicy(body);
      return created(reply, request, policy);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create notification policy');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET / — List policies ───────────────────────────────────────────────
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'notification-policy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const policies = await service.listPolicies();
      return success(reply, request, policies);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list notification policies');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id — Get policy ───────────────────────────────────────────────
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'notification-policy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const policy = await service.getPolicy(id);
      return success(reply, request, policy);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, policyId: (request.params as any).id }, 'Failed to get notification policy');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /:id — Update policy ────────────────────────────────────────────
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'notification-policy', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const policy = await service.updatePolicy(id, body);
      return success(reply, request, policy);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, policyId: (request.params as any).id }, 'Failed to update notification policy');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /:id — Delete policy ─────────────────────────────────────────
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'notification-policy', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deletePolicy(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, policyId: (request.params as any).id }, 'Failed to delete notification policy');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /evaluate — Evaluate policies against event ────────────────────
  app.post('/evaluate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'notification-policy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.event) {
        return badRequest(reply, request, undefined, 'event is required');
      }
      const matched = await service.evaluatePolicies(body.event);
      return success(reply, request, matched);
    } catch (err: any) {
      logger.error({ err }, 'Failed to evaluate notification policies');
      return internalError(reply, request, err.message);
    }
  });

  // ==================== Notification Workflows ====================

  // ── POST /workflows — Create workflow ───────────────────────────────────
  app.post('/workflows', {
    onRequest: [authenticateUser, requirePermission({ resource: 'notification-policy', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.policyId) {
        return badRequest(reply, request, undefined, 'name and policyId are required');
      }
      const workflow = await service.createWorkflow(body);
      return created(reply, request, workflow);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err }, 'Failed to create notification workflow');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /workflows — List workflows ─────────────────────────────────────
  app.get('/workflows', {
    onRequest: [authenticateUser, requirePermission({ resource: 'notification-policy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const workflows = await service.listWorkflows(query.policyId);
      return success(reply, request, workflows);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list notification workflows');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /workflows/:id — Get workflow ───────────────────────────────────
  app.get('/workflows/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'notification-policy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const workflow = await service.getWorkflow(id);
      return success(reply, request, workflow);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, workflowId: (request.params as any).id }, 'Failed to get notification workflow');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /workflows/:id — Update workflow ────────────────────────────────
  app.put('/workflows/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'notification-policy', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const workflow = await service.updateWorkflow(id, body);
      return success(reply, request, workflow);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, workflowId: (request.params as any).id }, 'Failed to update notification workflow');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /workflows/:id — Delete workflow ─────────────────────────────
  app.delete('/workflows/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'notification-policy', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteWorkflow(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, workflowId: (request.params as any).id }, 'Failed to delete notification workflow');
      return internalError(reply, request, err.message);
    }
  });
}
