/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/service-registry/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Service Registry API Routes
 *
 * Phase 6 Service Governance: service registration, discovery, health, and heartbeat.
 *
 * Prefix: /api/v1/service-registry
 *
 * Endpoints:
 * - GET    /api/v1/service-registry/services          - List all registered services (tenant-scoped)
 * - POST   /api/v1/service-registry/register          - Register a new service
 * - DELETE /api/v1/service-registry/services/:id      - Deregister a service by internal id
 * - GET    /api/v1/service-registry/services/:id/health - Get service health status
 * - POST   /api/v1/service-registry/services/:id/heartbeat - Record service heartbeat
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ServiceRegistryRepository } from '../repositories/ServiceRegistryRepository';
import { OrionError, ErrorCode, handleError } from '../errors';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../db/tenant-context-storage';

const logger = createLogger('service-registry-routes');

// ==================== Types ====================

interface ServiceRegistryRoutesOptions {
  database?: DatabasePool;
}

interface RegisterBody {
  serviceId: string;
  serviceName: string;
  serviceUrl: string;
  protocol?: 'http' | 'grpc' | 'tcp' | 'custom';
  version?: string;
  metadata?: Record<string, unknown>;
}

// ==================== Route Module ====================

export default async function serviceRegistryRoutes(
  app: FastifyInstance,
  options: ServiceRegistryRoutesOptions,
): Promise<void> {
  const repository = options.database
    ? new ServiceRegistryRepository(options.database)
    : null;

  // ─── List Services ────────────────────────────────────────────────────────

  // GET /services - List all registered services (tenant-scoped, paginated)
  app.get(
    '/services',
    {
      preHandler: [
        authenticateUser,
        requirePermission({ resource: 'service-registry', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!repository) {
        return handleError(reply, new OrionError('Service registry not available', ErrorCode.SERVICE_UNAVAILABLE));
      }

      const traceId = getCurrentTraceId();
      try {
        const query = request.query as {
          serviceName?: string;
          health?: string;
          page?: string;
          limit?: string;
        };

        const page = query.page ? parseInt(query.page, 10) : 1;
        const limit = query.limit ? parseInt(query.limit, 10) : 20;
        const offset = (page - 1) * limit;

        // Fetch tenant-scoped services with pagination
        const entities = await (repository as any).findByTenantId(
          (repository as any).getTenantId(),
          limit,
          offset,
        );

        // Apply optional filters client-side (repository uses tenant_id via RLS)
        let filtered = entities;
        if (query.serviceName) {
          const nameFilter = query.serviceName.toLowerCase();
          filtered = filtered.filter((e: any) =>
            e.serviceName.toLowerCase().includes(nameFilter),
          );
        }
        if (query.health) {
          const healthFilter = query.health.toLowerCase();
          filtered = filtered.filter((e: any) =>
            e.healthStatus.toLowerCase() === healthFilter,
          );
        }

        const data = filtered.map((entity: any) => mapEntityToServiceInfo(entity));

        return reply.send({
          success: true,
          data,
          total: filtered.length,
          page,
          limit,
        });
      } catch (error) {
        logger.error({ err: error, traceId }, 'Failed to list services');
        return handleError(reply, error);
      }
    },
  );

  // ─── Register Service ─────────────────────────────────────────────────────

  // POST /register - Register a new service
  app.post(
    '/register',
    {
      preHandler: [
        authenticateUser,
        requirePermission({ resource: 'service-registry', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!repository) {
        return handleError(reply, new OrionError('Service registry not available', ErrorCode.SERVICE_UNAVAILABLE));
      }

      const traceId = getCurrentTraceId();
      try {
        const body = request.body as RegisterBody;

        if (!body.serviceId || !body.serviceName || !body.serviceUrl) {
          return handleError(
            reply,
            new OrionError('serviceId, serviceName, and serviceUrl are required', ErrorCode.VALIDATION_ERROR),
          );
        }

        // Check for duplicate serviceId within tenant
        const existing = await (repository as any).findByServiceId(body.serviceId);
        if (existing) {
          return handleError(
            reply,
            new OrionError(
              `Service already registered: ${body.serviceId}`,
              ErrorCode.ALREADY_EXISTS,
              false,
              { serviceId: body.serviceId },
            ),
          );
        }

        const entity = await (repository as any).register({
          serviceId: body.serviceId,
          serviceName: body.serviceName,
          serviceUrl: body.serviceUrl,
          protocol: body.protocol || 'http',
          version: body.version || '1.0.0',
          metadata: body.metadata || {},
        });

        logger.info({ traceId, serviceId: body.serviceId }, 'Service registered');

        return reply.code(201).send({
          success: true,
          data: mapEntityToServiceInfo(entity),
        });
      } catch (error) {
        logger.error({ err: error, traceId }, 'Failed to register service');
        return handleError(reply, error);
      }
    },
  );

  // ─── Deregister Service ───────────────────────────────────────────────────

  // DELETE /services/:id - Deregister a service by internal id
  app.delete(
    '/services/:id',
    {
      preHandler: [
        authenticateUser,
        requirePermission({ resource: 'service-registry', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!repository) {
        return handleError(reply, new OrionError('Service registry not available', ErrorCode.SERVICE_UNAVAILABLE));
      }

      const traceId = getCurrentTraceId();
      try {
        const { id } = request.params as { id: string };

        // Look up the service to get its serviceId for the deregister call
        const entity = await (repository as any).findById(id);
        if (!entity) {
          return handleError(
            reply,
            new OrionError(`Service not found: ${id}`, ErrorCode.NOT_FOUND),
          );
        }

        await (repository as any).deregister(entity.serviceId);

        logger.info({ traceId, serviceId: entity.serviceId }, 'Service deregistered');

        return reply.send({
          success: true,
          message: `Service ${entity.serviceId} deregistered`,
        });
      } catch (error) {
        logger.error({ err: error, traceId }, 'Failed to deregister service');
        return handleError(reply, error);
      }
    },
  );

  // ─── Service Health ───────────────────────────────────────────────────────

  // GET /services/:id/health - Get service health status
  app.get(
    '/services/:id/health',
    {
      preHandler: [
        authenticateUser,
        requirePermission({ resource: 'service-registry', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!repository) {
        return handleError(reply, new OrionError('Service registry not available', ErrorCode.SERVICE_UNAVAILABLE));
      }

      const traceId = getCurrentTraceId();
      try {
        const { id } = request.params as { id: string };

        const entity = await (repository as any).findById(id);
        if (!entity) {
          return handleError(
            reply,
            new OrionError(`Service not found: ${id}`, ErrorCode.NOT_FOUND),
          );
        }

        const now = new Date();
        const lastHeartbeat = entity.lastHeartbeatAt
          ? entity.lastHeartbeatAt.toISOString()
          : null;

        return reply.send({
          success: true,
          data: {
            serviceId: entity.serviceId,
            status: entity.healthStatus,
            latencyMs: 0,
            lastChecked: now.toISOString(),
            errorRate: 0,
            lastHeartbeat,
          },
        });
      } catch (error) {
        logger.error({ err: error, traceId }, 'Failed to get service health');
        return handleError(reply, error);
      }
    },
  );

  // ─── Heartbeat ────────────────────────────────────────────────────────────

  // POST /services/:id/heartbeat - Record service heartbeat
  app.post(
    '/services/:id/heartbeat',
    {
      preHandler: [
        authenticateUser,
        requirePermission({ resource: 'service-registry', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!repository) {
        return handleError(reply, new OrionError('Service registry not available', ErrorCode.SERVICE_UNAVAILABLE));
      }

      const traceId = getCurrentTraceId();
      try {
        const { id } = request.params as { id: string };

        const entity = await (repository as any).findById(id);
        if (!entity) {
          return handleError(
            reply,
            new OrionError(`Service not found: ${id}`, ErrorCode.NOT_FOUND),
          );
        }

        await (repository as any).recordHeartbeat(entity.serviceId);

        logger.debug({ traceId, serviceId: entity.serviceId }, 'Heartbeat recorded');

        return reply.send({
          success: true,
          message: 'Heartbeat recorded',
        });
      } catch (error) {
        logger.error({ err: error, traceId }, 'Failed to record heartbeat');
        return handleError(reply, error);
      }
    },
  );
}

// ==================== Helpers ====================

/**
 * Map a ServiceRegistryEntity to the camelCase ServiceInfo shape expected by the frontend.
 */
export function mapEntityToServiceInfo(entity: any): {
  id: string;
  serviceId: string;
  name: string;
  address: string;
  port: number;
  protocol?: string;
  version?: string;
  health: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  registeredAt: string;
  lastHeartbeat?: string;
  metadata?: Record<string, unknown>;
} {
  const url = entity.serviceUrl || '';
  let port = 0;
  let address = url;

  try {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('grpc://') || url.startsWith('tcp://')) {
      const parsed = new URL(url);
      port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
      address = parsed.hostname;
    } else if (url.includes(':')) {
      const lastColon = url.lastIndexOf(':');
      const hostPart = url.substring(0, lastColon);
      const portPart = url.substring(lastColon + 1);
      if (hostPart.startsWith('//')) {
        address = hostPart.substring(2);
      } else {
        address = hostPart;
      }
      const parsedPort = parseInt(portPart, 10);
      if (!isNaN(parsedPort)) {
        port = parsedPort;
      }
    }
  } catch {
    // leave address as full URL and port as 0 on parse failure
  }

  return {
    id: entity.id,
    serviceId: entity.serviceId,
    name: entity.serviceName,
    address,
    port,
    protocol: entity.protocol,
    version: entity.version,
    health: entity.healthStatus,
    registeredAt: entity.registeredAt instanceof Date
      ? entity.registeredAt.toISOString()
      : new Date(entity.registeredAt).toISOString(),
    lastHeartbeat: entity.lastHeartbeatAt
      ? (entity.lastHeartbeatAt instanceof Date
          ? entity.lastHeartbeatAt.toISOString()
          : new Date(entity.lastHeartbeatAt).toISOString())
      : undefined,
    metadata: entity.metadata || {},
  };
}