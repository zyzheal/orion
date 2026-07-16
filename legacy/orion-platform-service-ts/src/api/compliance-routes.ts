/**
 * Compliance Management API Routes
 *
 * Compliance report generation, listing, and schedule management.
 *
 * Prefix: /api/v1/compliance
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { DatabasePool } from '../services/database';
import { ComplianceService } from '../services/compliance/ComplianceService';
import { createLogger } from '../utils/logger';

const logger = createLogger('compliance-routes');

interface ComplianceRoutesOptions {
  database: DatabasePool;
}

export default async function complianceRoutes(
  app: FastifyInstance,
  options: ComplianceRoutesOptions,
): Promise<void> {
  const service = new ComplianceService(options.database);

  // ==================== Compliance Reports ====================

  // ── POST /reports — Create compliance report ────────────────────────────
  app.post('/reports', {
    onRequest: [authenticateUser, requirePermission({ resource: 'compliance', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.framework) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'name and framework are required');
      }
      const report = await service.createReport({
        name: body.name,
        description: body.description,
        framework: body.framework,
        triggeredBy: body.triggeredBy ?? 'api',
        scheduleId: body.scheduleId,
      });
      return created(reply, request, report);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create compliance report');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /reports — List compliance reports ───────────────────────────────
  app.get('/reports', {
    onRequest: [authenticateUser, requirePermission({ resource: 'compliance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const reports = await service.listReports({ framework: query.framework });
      return success(reply, request, reports);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list compliance reports');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /reports/:id — Get report details ───────────────────────────────
  app.get('/reports/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'compliance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const report = await service.getReport(id);
      return success(reply, request, report);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, reportId: (request.params as any).id }, 'Failed to get compliance report');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /reports/:id — Update report ────────────────────────────────────
  app.put('/reports/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'compliance', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const report = await service.updateReport(id, body);
      return success(reply, request, report);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, reportId: (request.params as any).id }, 'Failed to update compliance report');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /reports/:id — Delete report ─────────────────────────────────
  app.delete('/reports/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'compliance', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteReport(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, reportId: (request.params as any).id }, 'Failed to delete compliance report');
      return internalError(reply, request, err.message);
    }
  });

  // ==================== Compliance Schedules ====================

  // ── POST /schedules — Create schedule ───────────────────────────────────
  app.post('/schedules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'compliance', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.framework || !body.cronExpression) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'name, framework, and cronExpression are required');
      }
      const schedule = await service.createSchedule({
        name: body.name,
        framework: body.framework,
        cronExpression: body.cronExpression,
        enabled: body.enabled,
      });
      return created(reply, request, schedule);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create compliance schedule');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /schedules — List schedules ─────────────────────────────────────
  app.get('/schedules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'compliance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schedules = await service.listSchedules();
      return success(reply, request, schedules);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list compliance schedules');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /schedules/:id — Delete schedule ─────────────────────────────
  app.delete('/schedules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'compliance', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteSchedule(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, scheduleId: (request.params as any).id }, 'Failed to delete compliance schedule');
      return internalError(reply, request, err.message);
    }
  });
}
