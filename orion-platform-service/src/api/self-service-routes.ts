/**
 * ITSM Self-Service Portal API Routes
 *
 * Routes under /api/v1/self-service
 * Provides end-user facing APIs for service catalog browsing,
 * service request submission, and ticket management.
 *
 * Endpoints:
 *   GET    /self-service/catalog/services           - List available services
 *   POST   /self-service/requests                   - Submit a service request
 *   GET    /self-service/requests                   - List my requests
 *   GET    /self-service/requests/:id               - Get request detail
 *   POST   /self-service/tickets                    - Submit a ticket
 *   GET    /self-service/tickets                    - List my tickets
 *   GET    /self-service/tickets/:id                - Get ticket detail
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { SelfServiceService } from '../services/itsm/SelfServiceService';
import { TicketingService } from '../services/ticketing/TicketingService';
import { TicketingRepository } from '../services/ticketing/TicketingRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { handleError } from '../errors';
import { OrionError, ErrorCode } from '../errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('self-service-routes');

interface SelfServiceRoutesOptions {
  database?: DatabasePool;
}

export default async function selfServiceRoutes(
  app: FastifyInstance,
  options: SelfServiceRoutesOptions,
): Promise<void> {
  const db = options.database;
  if (!db) {
    logger.warn('[SelfServiceRoutes] No database pool provided, self-service routes will not be functional');
    return;
  }

  const selfService = new SelfServiceService(db);
  const ticketingRepo = new TicketingRepository(db);
  const ticketingService = new TicketingService(ticketingRepo);

  // ==================== Helpers ====================

  function getTenantId(request: FastifyRequest): string {
    const tenantCtx = (request as any).tenantContext;
    const tenantId = tenantCtx?.getCurrentTenant?.()?.tenantId ?? (request as any).tenantId ?? 'default';
    return String(tenantId);
  }

  function getUserId(request: FastifyRequest): string {
    const user = (request as any).user;
    return user?.userId || user?.sub || 'anonymous';
  }

  // ==================== Service Catalog ====================

  // GET /self-service/catalog/services - List available services
  app.get('/catalog/services', {
    onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const result = await selfService.getServiceCatalog(tenantId, {
        category: query.category,
        limit,
        offset,
      });

      return reply.send({
        success: true,
        data: result.services,
        total: result.total,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /self-service/catalog/services/:id - Get service detail
  app.get('/catalog/services/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };

      const service = await selfService.getServiceDetail(id, tenantId);
      return reply.send({ success: true, data: service });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ==================== Service Requests ====================

  // POST /self-service/requests - Submit a service request
  app.post('/requests', {
    onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const body = request.body as Record<string, unknown>;

      if (!body.serviceId || !body.title) {
        throw new OrionError('serviceId and title are required', ErrorCode.VALIDATION_ERROR);
      }

      const detail = await selfService.createServiceRequest(tenantId, userId, {
        serviceId: body.serviceId as string,
        title: body.title as string,
        description: body.description as string | undefined,
        priority: body.priority as string | undefined,
        assignedTo: body.assignedTo as string | undefined,
      });

      return reply.status(201).send({ success: true, data: detail });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /self-service/requests - List my requests
  app.get('/requests', {
    onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const result = await selfService.getServiceRequests(tenantId, {
        requesterId: getUserId(request),
        serviceId: query.serviceId,
        status: query.status,
        limit,
        offset,
      });

      return reply.send({
        success: true,
        data: result,
        total: result.length,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /self-service/requests/:id - Get request detail
  app.get('/requests/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };

      const detail = await selfService.getServiceRequestDetail(id, tenantId);
      return reply.send({ success: true, data: detail });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /self-service/requests/:id/approve - Approve a service request
  app.post(
    '/requests/:id/approve',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'approve' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = getTenantId(request);
        const { id } = request.params as { id: string };
        const approverId = getUserId(request);
        const body = request.body as Record<string, unknown>;

        const detail = await selfService.approveRequest(
          id,
          approverId,
          (body.comment as string | undefined) || '',
          tenantId,
        );

        return reply.send({ success: true, data: detail });
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  // POST /self-service/requests/:id/reject - Reject a service request
  app.post(
    '/requests/:id/reject',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'approve' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = getTenantId(request);
        const { id } = request.params as { id: string };
        const approverId = getUserId(request);
        const body = request.body as Record<string, unknown>;

        const detail = await selfService.rejectRequest(
          id,
          approverId,
          (body.comment as string | undefined) || '',
          tenantId,
        );

        return reply.send({ success: true, data: detail });
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  // ==================== Attachments ====================

  // POST /self-service/requests/:id/attachments - Add attachment to a request
  app.post(
    '/requests/:id/attachments',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = getTenantId(request);
        const { id } = request.params as { id: string };
        const userId = getUserId(request);
        const body = request.body as Record<string, unknown>;

        if (!body.fileName) {
          throw new OrionError('fileName is required', ErrorCode.VALIDATION_ERROR);
        }

        const attachment = await selfService.addAttachment(id, {
          fileName: body.fileName as string,
          fileSize: body.fileSize as number | undefined,
          mimeType: body.mimeType as string | undefined,
          storageKey: body.storageKey as string | undefined,
          description: body.description as string | undefined,
          uploadedBy: userId,
        });

        return reply.status(201).send({ success: true, data: attachment });
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  // GET /self-service/requests/:id/attachments - List attachments for a request
  app.get(
    '/requests/:id/attachments',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = getTenantId(request);
        const { id } = request.params as { id: string };

        const attachments = await selfService.getAttachments(id);
        return reply.send({ success: true, data: attachments });
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  // ==================== Tickets ====================

  // POST /self-service/tickets - Submit a ticket
  app.post('/tickets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const body = request.body as Record<string, unknown>;

      if (!body.title || !body.description || !body.category || !body.priority) {
        throw new OrionError('title, description, category, and priority are required', ErrorCode.VALIDATION_ERROR);
      }

      const validCategories = [
        'infrastructure', 'application', 'database', 'network',
        'security', 'deployment', 'pipeline', 'performance', 'cost', 'other',
      ];
      if (!validCategories.includes(body.category as string)) {
        throw new OrionError('Invalid category', ErrorCode.VALIDATION_ERROR);
      }

      const validPriorities = ['critical', 'high', 'medium', 'low'];
      if (!validPriorities.includes(body.priority as string)) {
        throw new OrionError('Invalid priority', ErrorCode.VALIDATION_ERROR);
      }

      const input = {
        tenant_id: tenantId,
        title: body.title as string,
        description: body.description as string,
        type: body.category as string,
        priority: body.priority as string,
        reporter_id: userId,
        tags: body.tags ? (Array.isArray(body.tags) ? body.tags : [body.tags]) : undefined,
      };

      const ticket = await ticketingService.createTicket(input);
      return reply.status(201).send({ success: true, data: { ticket } });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /self-service/tickets - List my tickets
  app.get('/tickets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const query = request.query as Record<string, string>;
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;

      const result = await ticketingService.listTickets({
        page,
        limit,
        tenantId,
        status: query.status,
        priority: query.priority,
        assigneeId: userId,
      });

      return reply.send({
        success: true,
        data: {
          tickets: result.data,
          count: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /self-service/tickets/:id - Get my ticket detail
  app.get('/tickets/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'self-service', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ticket = await ticketingService.getTicket((request.params as any).id);
      return reply.send({ success: true, data: { ticket } });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
