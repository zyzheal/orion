/**
 * Service Catalog API Routes
 *
 * Routes under /api/v1/catalog
 * ITSM module for managing service offerings and service requests.
 *
 * Endpoints:
 *   GET/POST  /services          - List/create catalog services
 *   GET/PUT/DELETE /services/:id - CRUD for a single service
 *   GET/POST  /requests          - List/create service requests
 *   GET/PUT   /requests/:id      - Get/update a request
 *   POST      /requests/:id/status - Status transition
 *   GET       /requests/:id/timeline - Get timeline events
 *   GET       /stats             - Catalog statistics
 *   GET       /sla-breaches      - SLA breach detection
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ServiceCatalogService } from '../services/service-catalog/ServiceCatalogService';
import { requirePermission } from '../middleware/requirePermission';
import { handleError } from '../errors';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'service-catalog-routes' });

interface ServiceCatalogRoutesOptions {
  database?: DatabasePool;
}

export default async function serviceCatalogRoutes(
  app: FastifyInstance,
  options: ServiceCatalogRoutesOptions,
): Promise<void> {
  if (!options.database) {
    logger.warn('[ServiceCatalogRoutes] No database pool provided, service catalog routes will not be functional');
    return;
  }

  const catalogService = new ServiceCatalogService(options.database);

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

  // ==================== Catalog Services ====================

  // GET /api/v1/catalog/services - List catalog services
  app.get('/services', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const result = await catalogService.listServices(tenantId, {
        category: query.category,
        status: query.status,
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

  // POST /api/v1/catalog/services - Create catalog service
  app.post('/services', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const body = request.body as Record<string, unknown>;

      const entity = await catalogService.createService({
        name: body.name as string,
        description: body.description as string | undefined,
        category: body.category as string | undefined,
        status: body.status as string | undefined,
        owner: body.owner as string | undefined,
        supportTeam: body.supportTeam as string | undefined,
        slaTier: body.slaTier as string | undefined,
        availabilityTarget: body.availabilityTarget as number | undefined,
        responseTimeTarget: body.responseTimeTarget as number | undefined,
        relatedSystems: body.relatedSystems as string[] | undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
        createdBy: userId,
      }, tenantId);

      return reply.status(201).send({ success: true, data: entity });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /api/v1/catalog/services/:id - Get catalog service by ID
  app.get('/services/:id', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'read' })],
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

  // PUT /api/v1/catalog/services/:id - Update catalog service
  app.put('/services/:id', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const entity = await catalogService.updateService(id, {
        name: body.name as string | undefined,
        description: body.description as string | undefined,
        category: body.category as string | undefined,
        status: body.status as string | undefined,
        owner: body.owner as string | undefined,
        supportTeam: body.supportTeam as string | undefined,
        slaTier: body.slaTier as string | undefined,
        availabilityTarget: body.availabilityTarget as number | undefined,
        responseTimeTarget: body.responseTimeTarget as number | undefined,
        relatedSystems: body.relatedSystems as string[] | undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
      }, tenantId);

      return reply.send({ success: true, data: entity });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // DELETE /api/v1/catalog/services/:id - Delete catalog service
  app.delete('/services/:id', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };

      await catalogService.deleteService(id, tenantId);
      return reply.send({ success: true, message: 'Catalog service deleted' });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ==================== Service Requests ====================

  // GET /api/v1/catalog/requests - List service requests
  app.get('/requests', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as Record<string, string>;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const result = await catalogService.listRequests(tenantId, {
        serviceId: query.service_id,
        requesterId: query.requester_id,
        status: query.status,
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

  // POST /api/v1/catalog/requests - Create service request
  app.post('/requests', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const body = request.body as Record<string, unknown>;

      const entity = await catalogService.createRequest({
        serviceId: body.serviceId as string,
        requesterId: userId,
        title: body.title as string,
        description: body.description as string | undefined,
        priority: body.priority as string | undefined,
        assignedTo: body.assignedTo as string | undefined,
      }, tenantId);

      return reply.status(201).send({ success: true, data: entity });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /api/v1/catalog/requests/:id - Get service request by ID
  app.get('/requests/:id', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'read' })],
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

  // PUT /api/v1/catalog/requests/:id - Update service request
  app.put('/requests/:id', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const entity = await catalogService.updateRequest(id, {
        title: body.title as string | undefined,
        description: body.description as string | undefined,
        priority: body.priority as string | undefined,
        assignedTo: body.assignedTo as string | undefined,
      }, tenantId);

      return reply.send({ success: true, data: entity });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /api/v1/catalog/requests/:id/status - Status transition
  app.post('/requests/:id/status', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const userId = getUserId(request);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      if (!body.status) {
        return handleError(reply, new ValidationError('Status is required'))
      }

      const entity = await catalogService.transitionStatus(id, {
        status: body.status as string,
        userId,
        comment: body.comment as string | undefined,
      }, tenantId);

      return reply.send({ success: true, data: entity });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /api/v1/catalog/requests/:id/timeline - Get timeline events
  app.get('/requests/:id/timeline', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };

      const timeline = await catalogService.getTimeline(id, tenantId);
      return reply.send({ success: true, data: timeline });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ==================== Statistics & SLA ====================

  // GET /api/v1/catalog/stats - Catalog statistics
  app.get('/stats', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const stats = await catalogService.getStats(tenantId);
      return reply.send({ success: true, data: stats });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /api/v1/catalog/sla-breaches - Get SLA breaches
  app.get('/sla-breaches', {
    onRequest: [requirePermission({ resource: 'service-catalog', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getTenantId(request);
      const breaches = await catalogService.getSlaBreaches(tenantId);
      return reply.send({ success: true, data: breaches, total: breaches.length });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
