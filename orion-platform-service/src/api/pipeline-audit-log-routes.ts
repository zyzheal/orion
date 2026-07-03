/**
 * PipelineAuditLog API Routes
 *
 * Routes under /api/v1/audit-logs
 * Pipeline execution audit trail for forensic analysis.
 *
 * Endpoints:
 *   POST   /audit-logs                    — Record single event (internal)
 *   POST   /audit-logs/batch              — Batch record events (internal)
 *   GET    /audit-logs                    — Query audit logs with filters
 *   GET    /runs/:runId/audit-trail       — Get full audit trail for a run
 *   POST   /audit-logs/cleanup            — Cleanup expired logs (admin)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError, noContent } from '../utils/replyHelper';
import { getCurrentTenantId } from '../db/tenant-context-storage';
import { DatabasePool } from '../services/database';
import { PipelineAuditLogService } from '../services/pipeline/PipelineAuditLogService';
import { PipelineAuditLogRepository } from '../repositories/PipelineAuditLogRepository';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'pipeline-audit-log-routes' });

interface PipelineAuditLogRoutesOptions {
  database: DatabasePool;
}

export default async function pipelineAuditLogRoutes(
  app: FastifyInstance,
  options: PipelineAuditLogRoutesOptions,
): Promise<void> {
  const service = new PipelineAuditLogService({ db: options.database });
  const tenantId = getCurrentTenantId();

  // POST /audit-logs — Record single event (internal service use)
  // NOTE: These write endpoints are intended for internal pipeline engine calls.
  // In production, protect with service account auth or mTLS to prevent log spoofing.
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit-log', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.runId || !body.action || !body.actor || !body.outcome) {
        return badRequest(reply, request, undefined, 'runId, action, actor, outcome are required');
      }
      const log = await service.record({
        tenantId: body.tenantId || tenantId,
        runId: body.runId,
        stageId: body.stageId,
        taskId: body.taskId,
        action: body.action,
        actor: body.actor,
        outcome: body.outcome,
        durationMs: body.durationMs,
        inputSummary: body.inputSummary,
        outputSummary: body.outputSummary,
        errorMessage: body.errorMessage,
        metadata: body.metadata,
      });
      return created(reply, request, log);
    } catch (err: any) {
      logger.error({ err }, 'Failed to record audit log');
      return internalError(reply, request, err.message);
    }
  });

  // POST /audit-logs/batch — Batch record (internal service use)
  app.post('/batch', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit-log', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { logs: any[] };
      if (!body || !Array.isArray(body.logs)) {
        return badRequest(reply, request, undefined, 'logs array is required');
      }
      const logs = await service.recordBatch(body.logs.map((l: any) => ({
        ...l,
        tenantId: l.tenantId || tenantId,
      })));
      return created(reply, request, logs);
    } catch (err: any) {
      logger.error({ err }, 'Failed to batch record audit logs');
      return internalError(reply, request, err.message);
    }
  });

  // GET /audit-logs — Query with filters
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit-log', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const result = await service.query({
        tenantId: query.tenantId || tenantId,
        runId: query.runId,
        stageId: query.stageId,
        taskId: query.taskId,
        action: query.action,
        actor: query.actor,
        outcome: query.outcome,
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });
      return success(reply, request, result);
    } catch (err: any) {
      logger.error({ err }, 'Failed to query audit logs');
      return internalError(reply, request, err.message);
    }
  });

  // GET /runs/:runId/audit-trail — Full audit trail for a run
  app.get('/runs/:runId/audit-trail', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit-log', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { runId } = request.params as { runId: string };
      const query = request.query as any;
      const trail = await service.getRunAuditTrail(
        tenantId,
        runId,
        query.limit ? parseInt(query.limit, 10) : 100,
      );
      return success(reply, request, trail);
    } catch (err: any) {
      logger.error({ err }, 'Failed to get audit trail');
      return internalError(reply, request, err.message);
    }
  });

  // POST /audit-logs/cleanup — Cleanup expired (admin only)
  app.post('/cleanup', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit-log', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const retentionDays = body.retentionDays || 90;
      const deleted = await service.cleanupExpired(retentionDays);
      return success(reply, request, { deleted });
    } catch (err: any) {
      logger.error({ err }, 'Failed to cleanup audit logs');
      return internalError(reply, request, err.message);
    }
  });
}
