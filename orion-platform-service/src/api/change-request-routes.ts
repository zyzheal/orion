/**
 * Change Request RFC Approval Chain API Routes
 *
 * ITSM-style RFC lifecycle: create, submit for approval, multi-level approval,
 * execution step management.
 *
 * Prefix: /api/v1/change-requests
 *
 * Endpoints:
 *   CRUD:         GET/POST /, GET/PUT/DELETE /:id
 *   Approval:     POST /:id/submit, GET /:id/approvals, POST /:id/approvals/:approvalId/approve|reject
 *   Execution:    POST /:id/execution/start, GET /:id/execution, PUT /execution/:stepId
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ChangeRequestRepository } from '../services/change-request/ChangeRequestRepository';
import { ChangeApprovalRepository } from '../services/change-request/ChangeApprovalRepository';
import { ChangeExecutionRepository } from '../services/change-request/ChangeExecutionRepository';
import { ChangeRequestService } from '../services/change-request/ChangeRequestService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'change-request-routes' });

interface ChangeRequestRoutesOptions {
  database: DatabasePool;
}

export default async function changeRequestRoutes(
  app: FastifyInstance,
  options: ChangeRequestRoutesOptions,
): Promise<void> {
  const requestRepo = new ChangeRequestRepository(options.database);
  const approvalRepo = new ChangeApprovalRepository(options.database);
  const executionRepo = new ChangeExecutionRepository(options.database);
  const service = new ChangeRequestService(requestRepo, approvalRepo, executionRepo);

  // ==================== Change Request CRUD ====================

  // ── GET / — List change requests ────────────────────────────────────────
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const requests = await service.listRequests({
        status: query.status,
        changeType: query.changeType,
        riskLevel: query.riskLevel,
      });
      return success(reply, request, requests);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list change requests');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST / — Create change request ──────────────────────────────────────
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.title || !body.changeType) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'title and changeType are required');
      }
      const validTypes = ['standard', 'normal', 'emergency'];
      if (!validTypes.includes(body.changeType)) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, `changeType must be one of: ${validTypes.join(', ')}`);
      }
      const req = await service.createRequest({
        title: body.title,
        description: body.description,
        changeType: body.changeType,
        riskLevel: body.riskLevel,
        impactScope: body.impactScope,
        rollbackPlan: body.rollbackPlan,
        scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : undefined,
        scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : undefined,
        createdBy: body.createdBy,
      });
      return created(reply, request, req);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create change request');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id — Get change request detail ────────────────────────────────
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const req = await service.getRequest(id);
      return success(reply, request, req);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, requestId: (request.params as any).id }, 'Failed to get change request');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /:id — Update change request ────────────────────────────────────
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const req = await service.updateRequest(id, body);
      return success(reply, request, req);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      if (err.code === 'STATE_CONFLICT') return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      logger.error({ err, requestId: (request.params as any).id }, 'Failed to update change request');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /:id — Delete change request ─────────────────────────────────
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteRequest(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      if (err.code === 'STATE_CONFLICT') return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      logger.error({ err, requestId: (request.params as any).id }, 'Failed to delete change request');
      return internalError(reply, request, err.message);
    }
  });

  // ==================== Approval Chain ====================

  // ── POST /:id/submit — Submit for approval ──────────────────────────────
  app.post('/:id/submit', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const req = await service.submitForApproval(id);
      return success(reply, request, req);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      if (err.code === 'STATE_CONFLICT') return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      logger.error({ err, requestId: (request.params as any).id }, 'Failed to submit change request');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id/approvals — Get approval chain ─────────────────────────────
  app.get('/:id/approvals', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const approvals = await service.getApprovalChain(id);
      return success(reply, request, approvals);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, requestId: (request.params as any).id }, 'Failed to get approval chain');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/approvals/:approvalId/approve — Approve ──────────────────
  app.post('/:id/approvals/:approvalId/approve', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, approvalId } = request.params as { id: string; approvalId: string };
      const body = request.body as any;
      if (!body.approverId) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'approverId is required');
      }
      const approval = await service.approveRequest(id, approvalId, body.approverId, body.comment);
      return success(reply, request, approval);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      if (err.code === 'STATE_CONFLICT') return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      logger.error({ err }, 'Failed to approve change request');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/approvals/:approvalId/reject — Reject ────────────────────
  app.post('/:id/approvals/:approvalId/reject', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, approvalId } = request.params as { id: string; approvalId: string };
      const body = request.body as any;
      if (!body.approverId) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'approverId is required');
      }
      const approval = await service.rejectRequest(id, approvalId, body.approverId, body.comment);
      return success(reply, request, approval);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      if (err.code === 'STATE_CONFLICT') return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      logger.error({ err }, 'Failed to reject change request');
      return internalError(reply, request, err.message);
    }
  });

  // ==================== Execution Management ====================

  // ── POST /:id/execution/start — Start execution ────────────────────────
  app.post('/:id/execution/start', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      if (!body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'steps array is required and must not be empty');
      }
      for (const step of body.steps) {
        if (!step.stepName || !step.stepOrder) {
          return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'each step must have stepName and stepOrder');
        }
      }
      const steps = await service.startExecution(id, body.steps);
      return created(reply, request, steps);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      if (err.code === 'STATE_CONFLICT') return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      logger.error({ err, requestId: (request.params as any).id }, 'Failed to start execution');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id/execution — Get execution progress ────────────────────────
  app.get('/:id/execution', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const progress = await service.getExecutionProgress(id);
      return success(reply, request, progress);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, requestId: (request.params as any).id }, 'Failed to get execution progress');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /execution/:stepId — Update execution step ─────────────────────
  app.put('/execution/:stepId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-request', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { stepId } = request.params as { stepId: string };
      const body = request.body as any;
      if (!body.status) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'status is required');
      }
      const step = await service.updateExecutionStep(stepId, body);
      return success(reply, request, step);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      if (err.code === 'STATE_CONFLICT') return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      logger.error({ err, stepId: (request.params as any).stepId }, 'Failed to update execution step');
      return internalError(reply, request, err.message);
    }
  });
}
