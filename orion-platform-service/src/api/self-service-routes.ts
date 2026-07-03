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
import { ServiceCatalogService } from '../services/service-catalog/ServiceCatalogService';
import { TicketingService } from '../services/ticketing/TicketingService';
import { TicketingRepository } from '../services/ticketing/TicketingRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { handleError } from '../errors';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'self-service-routes' });

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

  const catalogService = new ServiceCatalogService(db);
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

  // GET /self-service/catalog/services - List active services
  app.get('/catalog/services', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const result = await catalogService.listServices(tenantId, {
        category: query.category,
        status: 'active',
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
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };

      const entity = await catalogService.getService(id, tenantId);
      return reply.send({ success: true, data: entity });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ==================== Service Requests ====================

  // POST /self-service/requests - Submit a service request
  app.post('/requests', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const body = request.body as Record<string, unknown>;

      if (!body.serviceId) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      const entity = await catalogService.createRequest({
        serviceId: body.serviceId as string,
        requesterId: userId,
        title: (body.title as string) || '',
        description: body.description as string | undefined,
        priority: body.priority as string | undefined,
        assignedTo: body.assignedTo as string | undefined,
      }, tenantId);

      return reply.status(201).send({ success: true, data: entity });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /self-service/requests - List my requests
  app.get('/requests', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const query = request.query as Record<string, string>;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const result = await catalogService.listRequests(tenantId, {
        requesterId: userId,
        status: query.status,
        serviceId: query.serviceId,
        limit,
        offset,
      });

      return reply.send({
        success: true,
        data: result.requests,
        total: result.total,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /self-service/requests/:id - Get my request detail
  app.get('/requests/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };

      const entity = await catalogService.getRequest(id, tenantId);
      return reply.send({ success: true, data: entity });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ==================== Tickets ====================

  // POST /self-service/tickets - Submit a ticket
  app.post('/tickets', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const body = request.body as Record<string, unknown>;

      if (!body.title || !body.description || !body.category || !body.priority) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      const validCategories = [
        'infrastructure', 'application', 'database', 'network',
        'security', 'deployment', 'pipeline', 'performance', 'cost', 'other',
      ];
      if (!validCategories.includes(body.category as string)) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      const validPriorities = ['critical', 'high', 'medium', 'low'];
      if (!validPriorities.includes(body.priority as string)) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
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
    onRequest: [authenticateUser],
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
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ticket = await ticketingService.getTicket((request.params as any).id);
      return reply.send({ success: true, data: { ticket } });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
