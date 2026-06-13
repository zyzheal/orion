/**
 * Change Management API Routes (ITIL-aligned)
 *
 * Full change lifecycle, RFC management, CAB meetings, timeline, statistics.
 *
 * Prefix: /api/v1/changes
 *
 * Endpoints:
 *   CRUD:         GET/POST /requests, GET/PUT/DELETE /requests/:id
 *   Status:       PATCH /requests/:id/status
 *   Timeline:     GET/POST /requests/:id/timeline
 *   RFCs:         GET/POST /rfcs, GET/PUT /rfcs/:id
 *   CAB:          GET/POST /cab, GET/PUT /cab/:id
 *   Decisions:    POST /cab/:id/decisions
 *   Statistics:   GET /stats
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ChangeService, CreateChangeRequestInput, UpdateChangeRequestInput, CreateRFCInput, UpdateRFCInput, CreateCABMeetingInput, UpdateCABMeetingInput } from '../services/change/ChangeService';
import { requirePermission } from '../middleware/requirePermission';
import { handleError } from '../errors';
import pino from 'pino';

const logger = pino({ name: 'change-routes' });

interface ChangeRoutesOptions {
  database?: DatabasePool;
}

export default async function changeRoutes(
  app: FastifyInstance,
  options: ChangeRoutesOptions,
): Promise<void> {
  if (!options.database) {
    logger.warn('[ChangeRoutes] No database pool provided, change routes will not be functional');
    return;
  }

  const changeService = new ChangeService(options.database);
  changeService.init();

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

  // ==================== Change Requests ====================

  // GET /requests - List change requests
  app.get('/requests', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;

      const result = await changeService.listChangeRequests(tenantId, {
        status: query.status,
        type: query.type,
        priority: query.priority,
        riskLevel: query.riskLevel,
        assignedTo: query.assignedTo,
        requesterId: query.requesterId,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });

      return reply.send({
        success: true,
        data: result.data,
        total: result.total,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /requests - Create change request
  app.post('/requests', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const body = request.body as CreateChangeRequestInput;

      if (!body.title) {
        return reply.status(400).send({
          success: false,
          error: 'title is required',
        });
      }

      const changeRequest = await changeService.createChangeRequest(
        { ...body, createdBy: userId, requesterId: body.requesterId || userId },
        tenantId,
      );

      return reply.status(201).send({
        success: true,
        data: changeRequest,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /stats - Change management statistics
  app.get('/stats', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const stats = await changeService.getStats(tenantId);

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /requests/:id - Get change request
  app.get('/requests/:id', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = getTenantId(request);
      const changeRequest = await changeService.getChangeRequest(id, tenantId);

      return reply.send({
        success: true,
        data: changeRequest,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // PUT /requests/:id - Update change request
  app.put('/requests/:id', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = getTenantId(request);
      const body = request.body as UpdateChangeRequestInput;

      const changeRequest = await changeService.updateChangeRequest(id, body, tenantId);

      return reply.send({
        success: true,
        data: changeRequest,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // DELETE /requests/:id - Delete change request
  app.delete('/requests/:id', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = getTenantId(request);

      await changeService.deleteChangeRequest(id, tenantId);

      return reply.send({
        success: true,
        data: { deleted: true },
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // PATCH /requests/:id/status - Status transition
  app.patch('/requests/:id/status', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { status: string; reason?: string };
      const tenantId = getTenantId(request);
      const userId = getUserId(request);

      if (!body.status) {
        return reply.status(400).send({
          success: false,
          error: 'status is required',
        });
      }

      const changeRequest = await changeService.updateStatus(id, body.status, tenantId, userId, body.reason);

      return reply.send({
        success: true,
        data: changeRequest,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ==================== Timeline ====================

  // GET /requests/:id/timeline - Get timeline events
  app.get('/requests/:id/timeline', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;

      const timeline = await changeService.getTimeline(id, tenantId, {
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });

      return reply.send({
        success: true,
        data: timeline,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /requests/:id/timeline - Add timeline event
  app.post('/requests/:id/timeline', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { event_type: string; description: string; metadata?: Record<string, any> };
      const tenantId = getTenantId(request);
      const userId = getUserId(request);

      if (!body.event_type || !body.description) {
        return reply.status(400).send({
          success: false,
          error: 'event_type and description are required',
        });
      }

      const event = await changeService.addTimelineEvent(
        id,
        body.event_type,
        body.description,
        tenantId,
        userId,
        body.metadata,
      );

      return reply.status(201).send({
        success: true,
        data: event,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ==================== RFCs ====================

  // GET /rfcs - List RFCs
  app.get('/rfcs', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;

      const result = await changeService.listRFCs(
        tenantId,
        query.limit ? parseInt(query.limit, 10) : 20,
        query.offset ? parseInt(query.offset, 10) : 0,
      );

      return reply.send({
        success: true,
        data: result.data,
        total: result.total,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /rfcs - Create RFC
  app.post('/rfcs', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const body = request.body as CreateRFCInput;

      if (!body.changeRequestId || !body.rfcNumber) {
        return reply.status(400).send({
          success: false,
          error: 'changeRequestId and rfcNumber are required',
        });
      }

      const rfc = await changeService.createRFC(
        { ...body, createdBy: userId },
        tenantId,
      );

      return reply.status(201).send({
        success: true,
        data: rfc,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /rfcs/:id - Get RFC
  app.get('/rfcs/:id', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = getTenantId(request);

      const rfc = await changeService.getRFC(id, tenantId);

      return reply.send({
        success: true,
        data: rfc,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // PUT /rfcs/:id - Update RFC
  app.put('/rfcs/:id', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = getTenantId(request);
      const body = request.body as UpdateRFCInput;

      const rfc = await changeService.updateRFC(id, body, tenantId);

      return reply.send({
        success: true,
        data: rfc,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ==================== CAB Meetings ====================

  // GET /cab - List CAB meetings
  app.get('/cab', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;

      const result = await changeService.listCABMeetings(tenantId, {
        status: query.status,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });

      return reply.send({
        success: true,
        data: result.data,
        total: result.total,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /cab - Create CAB meeting
  app.post('/cab', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const body = request.body as CreateCABMeetingInput;

      if (!body.title || !body.scheduledAt) {
        return reply.status(400).send({
          success: false,
          error: 'title and scheduledAt are required',
        });
      }

      const meeting = await changeService.createCABMeeting(
        { ...body, createdBy: userId },
        tenantId,
      );

      return reply.status(201).send({
        success: true,
        data: meeting,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /cab/:id - Get CAB meeting
  app.get('/cab/:id', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = getTenantId(request);

      const meeting = await changeService.getCABMeeting(id, tenantId);

      return reply.send({
        success: true,
        data: meeting,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // PUT /cab/:id - Update CAB meeting
  app.put('/cab/:id', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = getTenantId(request);
      const body = request.body as UpdateCABMeetingInput;

      const meeting = await changeService.updateCABMeeting(id, body, tenantId);

      return reply.send({
        success: true,
        data: meeting,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /cab/:id/decisions - Add decision to CAB meeting
  app.post('/cab/:id/decisions', {
    onRequest: [requirePermission({ resource: 'change-management', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = getTenantId(request);
      const body = request.body as { changeRequestId: string; decision: string; notes?: string };

      if (!body.changeRequestId || !body.decision) {
        return reply.status(400).send({
          success: false,
          error: 'changeRequestId and decision are required',
        });
      }

      const meeting = await changeService.addCABDecision(id, body, tenantId);

      return reply.send({
        success: true,
        data: meeting,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
