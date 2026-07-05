/**
 * SLA Management API Routes (ITSM Phase B)
 *
 * Prefix: /api/v1/sla
 *
 * Endpoints:
 *   Definitions:
 *     GET/POST   /definitions          - List/create SLA definitions
 *     GET/PUT/DELETE /definitions/:id   - CRUD single definition
 *   Tracking:
 *     GET/POST   /tracking             - List/create tracking records
 *     GET/PATCH  /tracking/:id         - Get/update tracking
 *     POST       /tracking/:id/mark-met      - Mark as met
 *     POST       /tracking/:id/breach        - Mark as breached
 *     POST       /tracking/:id/pause         - Pause tracking
 *     POST       /tracking/:id/resume        - Resume tracking
 *   Breach Events:
 *     GET        /breaches             - List breach events
 *     GET        /tracking/:id/breaches - Get breaches for a tracking record
 *   Breach Detection:
 *     POST       /detect-breaches      - Scan and detect SLA breaches
 *   Statistics:
 *     GET        /stats                - SLA statistics and compliance
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SLAService } from '../services/sla/SLAService';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { DatabasePool } from '../services/database';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';

const logger = createLogger('sla-routes');

interface SLARoutesOptions {
  database?: DatabasePool;
}

export default async function slaRoutes(
  app: FastifyInstance,
  options: SLARoutesOptions = {},
): Promise<void> {
  const db = options.database;
  if (!db) {
    logger.warn('[SLARoutes] No database pool provided, SLA routes will not be functional');
    return;
  }

  const slaService = new SLAService(db);

  // Extract tenantId from request (set by tenant isolation middleware)
  function getTenantId(request: FastifyRequest): string {
    const tenantCtx = (request as any).tenantContext;
    const tenantId = tenantCtx?.getCurrentTenant?.()?.tenantId ?? (request as any).tenantId ?? 'default';
    return String(tenantId);
  }

  function getUserId(request: FastifyRequest): string {
    const user = (request as any).user;
    return user?.id ?? user?.sub ?? 'anonymous';
  }

  // ==================== SLA Definitions ====================

  // GET /definitions - List SLA definitions
  app.get('/definitions', {
    onRequest: [requirePermission({ resource: 'sla', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;

      const result = await slaService.listDefinitions(tenantId, {
        type: query.type,
        status: query.status,
        category: query.category,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });

      return success(reply, request, result.definitions, { total: result.total });
    } catch (err: any) {
      logger.error({ err }, 'Failed to list SLA definitions');
      return internalError(reply, request, err.message);
    }
  });

  // POST /definitions - Create SLA definition
  app.post('/definitions', {
    onRequest: [requirePermission({ resource: 'sla', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const body = request.body as Record<string, unknown>;

      if (!body.name || !body.targetValue) {
        return badRequest(reply, request, undefined, 'name and targetValue are required');
      }

      const entity = await slaService.createDefinition({
        name: body.name as string,
        description: body.description as string | undefined,
        type: body.type as string | undefined,
        targetValue: body.targetValue as number,
        targetUnit: body.targetUnit as string | undefined,
        businessHoursOnly: body.businessHoursOnly as boolean | undefined,
        priority: body.priority as string | undefined,
        category: body.category as string | undefined,
        escalationRules: body.escalationRules as Record<string, unknown> | undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
        status: body.status as string | undefined,
        createdBy: userId,
      }, tenantId);

      return created(reply, request, entity);
    } catch (err: any) {
      if (err.code === 'VALIDATION_ERROR') {
        return badRequest(reply, request, undefined, err.message);
      }
      logger.error({ err }, 'Failed to create SLA definition');
      return internalError(reply, request, err.message);
    }
  });

  // GET /definitions/:id - Get SLA definition by ID
  app.get('/definitions/:id', {
    onRequest: [requirePermission({ resource: 'sla', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };

      const entity = await slaService.getDefinition(id, tenantId);
      return success(reply, request, entity);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      logger.error({ err, definitionId: (request.params as any).id }, 'Failed to get SLA definition');
      return internalError(reply, request, err.message);
    }
  });

  // PUT /definitions/:id - Update SLA definition
  app.put('/definitions/:id', {
    onRequest: [requirePermission({ resource: 'sla', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const entity = await slaService.updateDefinition(id, {
        name: body.name as string | undefined,
        description: body.description as string | undefined,
        type: body.type as string | undefined,
        targetValue: body.targetValue as number | undefined,
        targetUnit: body.targetUnit as string | undefined,
        businessHoursOnly: body.businessHoursOnly as boolean | undefined,
        priority: body.priority as string | undefined,
        category: body.category as string | undefined,
        escalationRules: body.escalationRules as Record<string, unknown> | undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
        status: body.status as string | undefined,
      }, tenantId);

      return success(reply, request, entity);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      if (err.code === 'VALIDATION_ERROR') {
        return badRequest(reply, request, undefined, err.message);
      }
      logger.error({ err, definitionId: (request.params as any).id }, 'Failed to update SLA definition');
      return internalError(reply, request, err.message);
    }
  });

  // DELETE /definitions/:id - Delete SLA definition
  app.delete('/definitions/:id', {
    onRequest: [requirePermission({ resource: 'sla', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };

      await slaService.deleteDefinition(id, tenantId);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      logger.error({ err, definitionId: (request.params as any).id }, 'Failed to delete SLA definition');
      return internalError(reply, request, err.message);
    }
  });

  // ==================== SLA Tracking ====================

  // GET /tracking - List tracking records
  app.get('/tracking', {
    onRequest: [requirePermission({ resource: 'sla', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;

      const result = await slaService.listTracking(tenantId, {
        status: query.status,
        entityType: query.entity_type,
        entityId: query.entity_id,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });

      return success(reply, request, result.trackings, { total: result.total });
    } catch (err: any) {
      logger.error({ err }, 'Failed to list SLA tracking records');
      return internalError(reply, request, err.message);
    }
  });

  // POST /tracking - Start tracking
  app.post('/tracking', {
    onRequest: [requirePermission({ resource: 'sla', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const body = request.body as Record<string, unknown>;

      if (!body.slaDefinitionId || !body.entityType || !body.entityId || !body.targetTime) {
        return badRequest(reply, request, undefined, 'slaDefinitionId, entityType, entityId, and targetTime are required');
      }

      const entity = await slaService.startTracking({
        slaDefinitionId: body.slaDefinitionId as string,
        entityType: body.entityType as string,
        entityId: body.entityId as string,
        targetTime: new Date(body.targetTime as string),
        notes: body.notes as string | undefined,
      }, tenantId);

      return created(reply, request, entity);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      if (err.code === 'VALIDATION_ERROR') {
        return badRequest(reply, request, undefined, err.message);
      }
      if (err.code === 'STATE_CONFLICT') {
        return badRequest(reply, request, ErrorCodes.CLIENT_CONFLICT, err.message);
      }
      logger.error({ err }, 'Failed to start SLA tracking');
      return internalError(reply, request, err.message);
    }
  });

  // GET /tracking/:id - Get tracking record
  app.get('/tracking/:id', {
    onRequest: [requirePermission({ resource: 'sla', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };

      const entity = await slaService.getTracking(id, tenantId);
      return success(reply, request, entity);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      logger.error({ err, trackingId: (request.params as any).id }, 'Failed to get SLA tracking');
      return internalError(reply, request, err.message);
    }
  });

  // PATCH /tracking/:id - Update tracking status
  app.patch('/tracking/:id', {
    onRequest: [requirePermission({ resource: 'sla', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };
      const body = request.body as { status: string };

      if (!body.status) {
        return badRequest(reply, request, undefined, 'status is required');
      }

      let entity;
      switch (body.status) {
        case 'met':
          entity = await slaService.markMet(id, tenantId);
          break;
        case 'breached':
          entity = await slaService.markBreached(id, tenantId);
          break;
        case 'paused':
          entity = await slaService.pauseTracking(id, tenantId);
          break;
        case 'tracking':
          entity = await slaService.resumeTracking(id, tenantId);
          break;
        default:
          return badRequest(reply, request, undefined, `Invalid status: ${body.status}`);
      }

      return success(reply, request, entity);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      if (err.code === 'STATE_CONFLICT') {
        return badRequest(reply, request, ErrorCodes.CLIENT_CONFLICT, err.message);
      }
      logger.error({ err, trackingId: (request.params as any).id }, 'Failed to update SLA tracking');
      return internalError(reply, request, err.message);
    }
  });

  // POST /tracking/:id/mark-met - Mark tracking as met
  app.post('/tracking/:id/mark-met', {
    onRequest: [requirePermission({ resource: 'sla', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };

      const entity = await slaService.markMet(id, tenantId);
      return success(reply, request, entity);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      if (err.code === 'STATE_CONFLICT') {
        return badRequest(reply, request, ErrorCodes.CLIENT_CONFLICT, err.message);
      }
      logger.error({ err, trackingId: (request.params as any).id }, 'Failed to mark SLA met');
      return internalError(reply, request, err.message);
    }
  });

  // POST /tracking/:id/breach - Mark tracking as breached
  app.post('/tracking/:id/breach', {
    onRequest: [requirePermission({ resource: 'sla', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown> | undefined;

      const entity = await slaService.markBreached(id, tenantId, body as Record<string, unknown> | undefined);
      return success(reply, request, entity);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      if (err.code === 'STATE_CONFLICT') {
        return badRequest(reply, request, ErrorCodes.CLIENT_CONFLICT, err.message);
      }
      logger.error({ err, trackingId: (request.params as any).id }, 'Failed to mark SLA breached');
      return internalError(reply, request, err.message);
    }
  });

  // POST /tracking/:id/pause - Pause tracking
  app.post('/tracking/:id/pause', {
    onRequest: [requirePermission({ resource: 'sla', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };
      const body = request.body as { reason?: string } | undefined;

      const entity = await slaService.pauseTracking(id, tenantId, body?.reason);
      return success(reply, request, entity);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      if (err.code === 'STATE_CONFLICT') {
        return badRequest(reply, request, ErrorCodes.CLIENT_CONFLICT, err.message);
      }
      logger.error({ err, trackingId: (request.params as any).id }, 'Failed to pause SLA tracking');
      return internalError(reply, request, err.message);
    }
  });

  // POST /tracking/:id/resume - Resume tracking
  app.post('/tracking/:id/resume', {
    onRequest: [requirePermission({ resource: 'sla', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };

      const entity = await slaService.resumeTracking(id, tenantId);
      return success(reply, request, entity);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      if (err.code === 'STATE_CONFLICT') {
        return badRequest(reply, request, ErrorCodes.CLIENT_CONFLICT, err.message);
      }
      logger.error({ err, trackingId: (request.params as any).id }, 'Failed to resume SLA tracking');
      return internalError(reply, request, err.message);
    }
  });

  // GET /tracking/:id/breaches - Get breach events for a tracking record
  app.get('/tracking/:id/breaches', {
    onRequest: [requirePermission({ resource: 'sla', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const events = await slaService.getBreachEvents(id);
      return success(reply, request, events, { total: events.length });
    } catch (err: any) {
      logger.error({ err, trackingId: (request.params as any).id }, 'Failed to get breach events');
      return internalError(reply, request, err.message);
    }
  });

  // ==================== Breach Events ====================

  // GET /breaches - List all breach events
  app.get('/breaches', {
    onRequest: [requirePermission({ resource: 'sla', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;

      const result = await slaService.listBreachEvents(tenantId, {
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });

      return success(reply, request, result.events, { total: result.total });
    } catch (err: any) {
      logger.error({ err }, 'Failed to list breach events');
      return internalError(reply, request, err.message);
    }
  });

  // ==================== Breach Detection ====================

  // POST /detect-breaches - Scan and detect SLA breaches
  app.post('/detect-breaches', {
    onRequest: [requirePermission({ resource: 'sla', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);

      const result = await slaService.detectBreaches(tenantId);
      return success(reply, request, result);
    } catch (err: any) {
      logger.error({ err }, 'Failed to detect SLA breaches');
      return internalError(reply, request, err.message);
    }
  });

  // ==================== Statistics ====================

  // GET /stats - SLA statistics and compliance
  app.get('/stats', {
    onRequest: [requirePermission({ resource: 'sla', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);

      const stats = await slaService.getStats(tenantId);
      return success(reply, request, stats);
    } catch (err: any) {
      logger.error({ err }, 'Failed to get SLA stats');
      return internalError(reply, request, err.message);
    }
  });
}
