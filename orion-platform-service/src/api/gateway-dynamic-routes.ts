/**
 * Gateway Dynamic Routes API
 *
 * Phase 6 Service Governance: CRUD for API Gateway route configuration.
 *
 * Mounted at: /api/v1/gateway
 * Frontend: /api/v1/gateway/routes
 *
 * Endpoints:
 *   GET    /routes           - List routes (paginated, filterable)
 *   GET    /routes/:id       - Get single route
 *   POST   /routes           - Create route
 *   PUT    /routes/:id       - Update route
 *   DELETE /routes/:id       - Delete route
 *   PATCH  /routes/:id/toggle - Toggle enabled/disabled
 *   GET    /routes/stats     - Route statistics
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { GatewayRouteRepository, type CreateGatewayRouteInput, type UpdateGatewayRouteInput } from '../repositories/GatewayRouteRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OrionError, NotFoundError, ErrorCode, handleError } from '../errors';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../db/tenant-context-storage';

const logger = createLogger('gateway-dynamic-routes');

// ==================== Types ====================

interface GatewayRoutesOptions {
  database?: DatabasePool;
}

interface ListQuery {
  page?: string;
  pageSize?: string;
  enabled?: string;
  q?: string;
}

// ==================== Route Module ====================

export default async function gatewayDynamicRoutes(
  app: FastifyInstance,
  options: GatewayRoutesOptions,
): Promise<void> {
  const repository = options.database
    ? new GatewayRouteRepository(options.database)
    : null;

  // ==================== List Routes ====================

  app.get('/routes', {
    onRequest: [authenticateUser, requirePermission({ resource: 'gateway-routes', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!repository) return handleError(reply, new OrionError('SERVICE_UNAVAILABLE', ErrorCode.SERVICE_UNAVAILABLE));

    const query = request.query as ListQuery;
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10) || 20));
    const offset = (page - 1) * pageSize;

    try {
      const tenantId = getCurrentTraceId(); // use trace context to get tenantId
      const result = await repository.findAll({
        where: {
          ...(query.enabled !== undefined ? { enabled: query.enabled === 'true' } : {}),
          ...(query.q ? { path: query.q } : {}),
        },
        orderBy: 'priority',
        orderDir: 'DESC',
        limit: pageSize,
        offset,
      });

      // Map to frontend format
      const routes = result.entities.map((entity) => ({
        id: entity.id,
        path: entity.path,
        method: entity.methods[0] || 'GET',
        methods: entity.methods,
        targetService: extractServiceName(entity.upstreamUrl),
        targetUrl: entity.upstreamUrl,
        description: entity.metadata?.description,
        enabled: entity.enabled,
        authRequired: entity.metadata?.authRequired ?? true,
        allowedRoles: entity.metadata?.allowedRoles,
        allowedTenants: entity.metadata?.allowedTenants,
        rateLimit: entity.metadata?.rateLimit,
        timeoutMs: entity.metadata?.timeoutMs,
        retryPolicy: entity.metadata?.retryPolicy,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
        createdBy: entity.createdBy,
        lastRequestAt: entity.metadata?.lastRequestAt,
        requestCount: entity.metadata?.requestCount,
        errorRate: entity.metadata?.errorRate,
      }));

      return reply.send({ data: routes, total: result.total, page, pageSize });
    } catch (error: any) {
      logger.error({ error, traceId: getCurrentTraceId() }, 'Failed to list gateway routes');
      return handleError(reply, new OrionError('LIST_FAILED', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Get Single Route ====================

  app.get('/routes/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'gateway-routes', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!repository) return handleError(reply, new OrionError('SERVICE_UNAVAILABLE', ErrorCode.SERVICE_UNAVAILABLE));

    const { id } = request.params as { id: string };

    try {
      const entity = await repository.findById(id);
      if (!entity) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }

      return reply.send({
        id: entity.id,
        path: entity.path,
        method: entity.methods[0] || 'GET',
        methods: entity.methods,
        targetService: extractServiceName(entity.upstreamUrl),
        targetUrl: entity.upstreamUrl,
        description: entity.metadata?.description,
        enabled: entity.enabled,
        authRequired: entity.metadata?.authRequired ?? true,
        allowedRoles: entity.metadata?.allowedRoles,
        allowedTenants: entity.metadata?.allowedTenants,
        rateLimit: entity.metadata?.rateLimit,
        timeoutMs: entity.metadata?.timeoutMs,
        retryPolicy: entity.metadata?.retryPolicy,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
        createdBy: entity.createdBy,
        lastRequestAt: entity.metadata?.lastRequestAt,
        requestCount: entity.metadata?.requestCount,
        errorRate: entity.metadata?.errorRate,
      });
    } catch (error: any) {
      logger.error({ error, traceId: getCurrentTraceId() }, 'Failed to get gateway route');
      return handleError(reply, new OrionError('GET_FAILED', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Create Route ====================

  app.post('/routes', {
    onRequest: [authenticateUser, requirePermission({ resource: 'gateway-routes', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!repository) return handleError(reply, new OrionError('SERVICE_UNAVAILABLE', ErrorCode.SERVICE_UNAVAILABLE));

    const body = request.body as {
      path: string;
      methods?: string[];
      targetService: string;
      targetUrl?: string;
      description?: string;
      enabled?: boolean;
      authRequired?: boolean;
      allowedRoles?: string[];
      allowedTenants?: string[];
      rateLimit?: { maxRequests: number; windowMs: number };
      timeoutMs?: number;
      retryPolicy?: { maxRetries: number; backoffMs: number };
    };

    if (!body.path || !body.targetService) {
      return handleError(reply, new OrionError('path and targetService are required', ErrorCode.VALIDATION_ERROR));
    }

    try {
      const input: CreateGatewayRouteInput = {
        path: body.path,
        methods: body.methods || ['GET'],
        upstreamUrl: body.targetUrl,
        enabled: body.enabled ?? true,
        createdBy: (request as any).user?.userId || null,
        metadata: {
          description: body.description,
          authRequired: body.authRequired ?? true,
          allowedRoles: body.allowedRoles,
          allowedTenants: body.allowedTenants,
          rateLimit: body.rateLimit,
          timeoutMs: body.timeoutMs,
          retryPolicy: body.retryPolicy,
        },
      };

      const entity = await repository.create(input);

      logger.info(
        { routeId: entity.id, path: entity.path, traceId: getCurrentTraceId() },
        '[gateway-dynamic-routes] Route created',
      );

      return reply.status(201).send({
        id: entity.id,
        path: entity.path,
        method: entity.methods[0] || 'GET',
        methods: entity.methods,
        targetService: extractServiceName(entity.upstreamUrl),
        targetUrl: entity.upstreamUrl,
        description: entity.metadata?.description,
        enabled: entity.enabled,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
        createdBy: entity.createdBy,
      });
    } catch (error: any) {
      logger.error({ error, traceId: getCurrentTraceId() }, 'Failed to create gateway route');
      return handleError(reply, new OrionError('CREATE_FAILED', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Update Route ====================

  app.put('/routes/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'gateway-routes', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!repository) return handleError(reply, new OrionError('SERVICE_UNAVAILABLE', ErrorCode.SERVICE_UNAVAILABLE));

    const { id } = request.params as { id: string };
    const body = request.body as Partial<CreateGatewayRouteInput>;

    try {
      const existing = await repository.findById(id);
      if (!existing) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }

      // Merge existing metadata with updates
      const currentMetadata = existing.metadata || {};
      const newMetadata = body.metadata ? { ...currentMetadata, ...body.metadata } : currentMetadata;

      const input: UpdateGatewayRouteInput = {
        ...(body.path !== undefined ? { path: body.path } : {}),
        ...(body.methods !== undefined ? { methods: body.methods } : {}),
        ...(body.upstreamUrl !== undefined ? { upstreamUrl: body.upstreamUrl } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        updatedBy: (request as any).user?.userId || null,
        metadata: newMetadata,
      };

      const entity = await repository.update(id, input);

      logger.info(
        { routeId: entity?.id, traceId: getCurrentTraceId() },
        '[gateway-dynamic-routes] Route updated',
      );

      if (!entity) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }

      return reply.send({
        id: entity.id,
        path: entity.path,
        method: entity.methods[0] || 'GET',
        methods: entity.methods,
        targetService: extractServiceName(entity.upstreamUrl),
        targetUrl: entity.upstreamUrl,
        description: entity.metadata?.description,
        enabled: entity.enabled,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
        createdBy: entity.createdBy,
      });
    } catch (error: any) {
      logger.error({ error, traceId: getCurrentTraceId() }, 'Failed to update gateway route');
      return handleError(reply, new OrionError('UPDATE_FAILED', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Delete Route ====================

  app.delete('/routes/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'gateway-routes', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!repository) return handleError(reply, new OrionError('SERVICE_UNAVAILABLE', ErrorCode.SERVICE_UNAVAILABLE));

    const { id } = request.params as { id: string };

    try {
      const deleted = await repository.delete(id);
      if (!deleted) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }

      logger.info(
        { routeId: id, traceId: getCurrentTraceId() },
        '[gateway-dynamic-routes] Route deleted',
      );

      return reply.status(204).send();
    } catch (error: any) {
      logger.error({ error, traceId: getCurrentTraceId() }, 'Failed to delete gateway route');
      return handleError(reply, new OrionError('DELETE_FAILED', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Toggle Route ====================

  app.patch('/routes/:id/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'gateway-routes', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!repository) return handleError(reply, new OrionError('SERVICE_UNAVAILABLE', ErrorCode.SERVICE_UNAVAILABLE));

    const { id } = request.params as { id: string };
    const body = request.body as { enabled: boolean };

    try {
      const existing = await repository.findById(id);
      if (!existing) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }

      const entity = await repository.update(id, {
        enabled: body.enabled,
        updatedBy: (request as any).user?.userId || null,
      });

      logger.info(
        { routeId: id, enabled: entity?.enabled, traceId: getCurrentTraceId() },
        '[gateway-dynamic-routes] Route toggled',
      );

      return reply.send({
        id: entity!.id,
        path: entity!.path,
        method: entity!.methods[0] || 'GET',
        methods: entity!.methods,
        targetService: extractServiceName(entity!.upstreamUrl),
        targetUrl: entity!.upstreamUrl,
        description: entity!.metadata?.description,
        enabled: entity!.enabled,
        createdAt: entity!.createdAt.toISOString(),
        updatedAt: entity!.updatedAt.toISOString(),
        createdBy: entity!.createdBy,
      });
    } catch (error: any) {
      logger.error({ error, traceId: getCurrentTraceId() }, 'Failed to toggle gateway route');
      return handleError(reply, new OrionError('UPDATE_FAILED', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Route Stats ====================

  app.get('/routes/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'gateway-routes', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!repository) return handleError(reply, new OrionError('SERVICE_UNAVAILABLE', ErrorCode.SERVICE_UNAVAILABLE));

    try {
      const stats = await repository.getStats();
      return reply.send(stats);
    } catch (error: any) {
      logger.error({ error, traceId: getCurrentTraceId() }, 'Failed to get gateway route stats');
      return handleError(reply, new OrionError('STATS_FAILED', ErrorCode.INTERNAL_ERROR));
    }
  });
}

// ==================== Helpers ====================

function extractServiceName(upstreamUrl: string | null): string {
  if (!upstreamUrl) return 'unknown';
  try {
    const url = new URL(upstreamUrl);
    return url.hostname;
  } catch {
    return upstreamUrl.split('/')[0] || 'unknown';
  }
}
