/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/incident/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Incident Management API Routes (ITIL-aligned)
 *
 * Full incident lifecycle, timeline, post-mortem, escalation, SLA, statistics.
 *
 * Prefix: /api/v1/incidents
 *
 * Endpoints:
 *   CRUD:         GET/POST /, GET/PUT/DELETE /:id
 *   Status:       PATCH /:id/status
 *   Assignment:   PATCH /:id/assign
 *   Escalation:   POST /:id/escalate, GET /:id/escalations
 *   SLA:          GET /:id/sla, POST /:id/sla/breach
 *   Timeline:     GET/POST /:id/timeline
 *   Postmortem:   GET/POST/PUT /:id/postmortem, POST /:id/postmortem/publish, POST /:id/postmortem/archive
 *   Statistics:   GET /stats
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IncidentService, CreateIncidentEnhancedInput, CreatePostmortemInput } from '../services/incident/IncidentService';
import { KnowledgeIntegrationService } from '../services/knowledge/KnowledgeIntegrationService';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { DatabasePool } from '../services/database';
import { createLogger } from '../utils/logger';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { getCurrentTenantId } from '../db/tenant-context-storage';

const logger = createLogger('incident-routes');

interface IncidentRoutesOptions {
  database?: DatabasePool;
  knowledgeIntegration?: KnowledgeIntegrationService;
}

export default async function incidentRoutes(
  app: FastifyInstance,
  options: IncidentRoutesOptions = {}
): Promise<void> {
  const db = options.database;
  if (!db) {
    logger.warn('[IncidentRoutes] No database pool provided, incident routes will not be functional');
    return;
  }

  const service = new IncidentService(db, options.knowledgeIntegration);

  // P0-A: 全局认证 + 读权限守卫（所有 incident 操作均需登录）
  app.addHook('onRequest', authenticateUser);

  // ── POST / — Create incident ──────────────────────────────────────────
  app.post('/', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as CreateIncidentEnhancedInput;
      if (!body.title || !body.type || !body.severity) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'title, type, and severity are required');
      }

      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const incident = await service.createIncident(body, tenantId);
      return created(reply, request, incident);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create incident');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET / — List incidents ────────────────────────────────────────────
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const result = await service.listIncidents(tenantId, {
        status: query.status,
        severity: query.severity,
        priority: query.priority,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });
      return success(reply, request, result.incidents, { total: result.total });
    } catch (err: any) {
      logger.error({ err }, 'Failed to list incidents');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /stats — Incident statistics ──────────────────────────────────
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const stats = await service.getStats(tenantId);
      return success(reply, request, stats);
    } catch (err: any) {
      logger.error({ err }, 'Failed to get incident stats');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id — Get incident ───────────────────────────────────────────
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const incident = await service.getIncident(id, tenantId);
      if (!incident) return notFound(reply, request, undefined, 'Incident not found');
      return success(reply, request, incident);
    } catch (err: any) {
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to get incident');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /:id — Update incident ────────────────────────────────────────
  app.put('/:id', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const incident = await service.updateIncident(id, body, tenantId);
      if (!incident) return notFound(reply, request, undefined, 'Incident not found');
      return success(reply, request, incident);
    } catch (err: any) {
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to update incident');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /:id — Delete incident ─────────────────────────────────────
  app.delete('/:id', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const deleted = await service.deleteIncident(id, tenantId);
      if (!deleted) return notFound(reply, request, undefined, 'Incident not found');
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to delete incident');
      return internalError(reply, request, err.message);
    }
  });

  // ── PATCH /:id/status — Update status ─────────────────────────────────
  app.patch('/:id/status', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { status: string; actor_id?: string; reason?: string };
      if (!body.status) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'status is required');
      }
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const incident = await service.updateStatus(id, body.status, body.actor_id || '', tenantId, body.reason);
      return success(reply, request, incident);
    } catch (err: any) {
      if (err.code === 'STATE_CONFLICT') {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      }
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to update status');
      return internalError(reply, request, err.message);
    }
  });

  // ── PATCH /:id/assign — Assign commander ──────────────────────────────
  app.patch('/:id/assign', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { commander_id: string };
      if (!body.commander_id) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'commander_id is required');
      }
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const incident = await service.assignCommander(id, body.commander_id, tenantId);
      return success(reply, request, incident);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to assign commander');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/escalate — Escalate incident ────────────────────────────
  app.post('/:id/escalate', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { to_level: number; reason: string; escalated_by: string };
      if (!body.to_level || !body.reason || !body.escalated_by) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'to_level, reason, and escalated_by are required');
      }
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      await service.escalate(id, body, tenantId);
      return success(reply, request, { escalated: true, to_level: body.to_level });
    } catch (err: any) {
      if (err.code === 'VALIDATION_ERROR') {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      }
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to escalate incident');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id/escalations — Get escalation history ─────────────────────
  app.get('/:id/escalations', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const escalations = await service.getEscalationHistory(id, tenantId);
      return success(reply, request, escalations);
    } catch (err: any) {
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to get escalation history');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id/sla — Check SLA breach status ────────────────────────────
  app.get('/:id/sla', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const sla = await service.checkSlaBreach(id, tenantId);
      return success(reply, request, sla);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to check SLA');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/sla/breach — Mark SLA breach ────────────────────────────
  app.post('/:id/sla/breach', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const incident = await service.markSlaBreach(id, tenantId);
      return success(reply, request, incident);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to mark SLA breach');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/timeline — Add timeline event ──────────────────────────
  app.post('/:id/timeline', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { event_type: string; content: string; actor_id?: string; metadata?: Record<string, any> };
      if (!body.event_type || !body.content) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'event_type and content are required');
      }
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const event = await service.addTimelineEvent(
        id, body.event_type, body.content, body.actor_id || '', tenantId, body.metadata
      );
      return created(reply, request, event);
    } catch (err: any) {
      if (err.code === 'VALIDATION_ERROR') {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      }
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to add timeline event');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id/timeline — Get timeline ─────────────────────────────────
  app.get('/:id/timeline', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const query = request.query as any;
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const timeline = await service.getTimeline(id, tenantId, {
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return success(reply, request, timeline);
    } catch (err: any) {
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to get timeline');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/postmortem — Create post-mortem ────────────────────────
  app.post('/:id/postmortem', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as CreatePostmortemInput;
      if (!body.summary || !body.root_cause) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'summary and root_cause are required');
      }
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const postmortem = await service.createPostmortem(id, body, tenantId);
      return created(reply, request, postmortem);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      if (err.code === 'ALREADY_EXISTS') {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      }
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to create postmortem');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id/postmortem — Get post-mortem ────────────────────────────
  app.get('/:id/postmortem', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const postmortem = await service.getPostmortem(id, tenantId);
      if (!postmortem) return notFound(reply, request, undefined, 'Post-mortem not found');
      return success(reply, request, postmortem);
    } catch (err: any) {
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to get postmortem');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /:id/postmortem — Update post-mortem (draft only) ────────────
  app.put('/:id/postmortem', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const postmortem = await service.updatePostmortem(id, body, tenantId);
      return success(reply, request, postmortem);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      if (err.code === 'STATE_CONFLICT') {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      }
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to update postmortem');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/postmortem/publish — Publish post-mortem ───────────────
  app.post('/:id/postmortem/publish', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { reviewed_by?: string };
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const postmortem = await service.publishPostmortem(id, tenantId, body?.reviewed_by);
      return success(reply, request, postmortem);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      if (err.code === 'STATE_CONFLICT') {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      }
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to publish postmortem');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/postmortem/archive — Archive post-mortem ───────────────
  app.post('/:id/postmortem/archive', {
    onRequest: [requirePermission({ resource: 'incident', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const postmortem = await service.archivePostmortem(id, tenantId);
      return success(reply, request, postmortem);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      if (err.code === 'STATE_CONFLICT') {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, err.message);
      }
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to archive postmortem');
      return internalError(reply, request, err.message);
    }
  });

  // ── Knowledge Recommendations (Task 4.63) ──────────────────────────────

  // GET /:id/knowledge — Get knowledge base recommendations for an incident
  app.get('/:id/knowledge', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const query = request.query as { limit?: string };
      const tenantId = ((request as any).tenantContext?.getCurrentTenant()?.tenantId) || getCurrentTenantId();
      const recommendations = await service.getKnowledgeRecommendations(
        id,
        tenantId,
        query.limit ? parseInt(query.limit, 10) : 5
      );
      return success(reply, request, recommendations);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, undefined, err.message);
      }
      logger.error({ err, incidentId: (request.params as any).id }, 'Failed to get knowledge recommendations');
      return internalError(reply, request, err.message);
    }
  });
}