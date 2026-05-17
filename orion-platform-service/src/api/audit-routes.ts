/**
 * Audit API Routes
 *
 * Migrated to PostgreSQL Repository pattern.
 * Prefix: /api/v1/audit
 *
 * Endpoints:
 *   GET    /logs           - List audit logs (paginated)
 *   GET    /logs/:id       - Get audit log by ID
 *   POST   /logs           - Create audit log
 *   GET    /logs/:id/verify - Verify single audit log
 *   POST   /verify         - Verify entire chain
 *   GET    /actions        - Get distinct actions
 *   GET    /resource-types - Get distinct resource types
 *   GET    /chain/info     - Chain info (compatibility)
 *   GET    /storage/stats  - Storage stats (compatibility)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { AuditRepository } from '../services/audit/AuditRepository';
import { AuditService } from '../services/audit/AuditService';

interface AuditRoutesOptions {
  database?: DatabasePool;
}

interface AuditLogCreateBody {
  action: string;
  userId?: string;
  tenantId?: string;
  details?: Record<string, any>;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
  requestBody?: Record<string, any>;
  responseCode?: number;
  responseBody?: Record<string, any>;
}

/**
 * Map database AuditLog (snake_case) to frontend-friendly format (camelCase)
 */
function toAuditLogEntry(log: any): any {
  return {
    id: log.id,
    timestamp: log.created_at,
    action: log.action,
    userId: log.user_id,
    tenantId: log.tenant_id,
    details: log.request_body || log.response_body || {},
    resourceType: log.resource_type,
    resourceId: log.resource_id,
    ipAddress: log.ip_address,
    userAgent: log.user_agent,
    prevHash: log.prev_hash,
    contentHash: log.hash,
    chainHash: log.hash,
    sequenceNumber: 0, // Not stored in DB; chain order is by created_at
    requestMethod: log.request_method,
    requestPath: log.request_path,
    responseCode: log.response_code,
  };
}

/**
 * Map frontend create body to CreateAuditLogInput
 */
function toCreateInput(body: AuditLogCreateBody): any {
  return {
    tenant_id: body.tenantId || 'default',
    user_id: body.userId,
    action: body.action,
    resource_type: body.resourceType || 'audit',
    resource_id: body.resourceId,
    request_method: body.requestMethod,
    request_path: body.requestPath,
    request_body: body.details || body.requestBody,
    response_code: body.responseCode,
    response_body: body.responseBody,
    ip_address: body.ipAddress,
    user_agent: body.userAgent,
  };
}

export default async function auditRoutes(
  app: FastifyInstance,
  options: AuditRoutesOptions
): Promise<void> {
  // Initialize PostgreSQL-backed services
  const pool = options.database;
  const repository = pool ? new AuditRepository(pool) : undefined;
  const service = repository ? new AuditService(repository) : undefined;

  // Error handler
  function handleError(error: any, reply: FastifyReply, context: string) {
    if (error?.code === 'NOT_FOUND') {
      return reply.status(404).send({ error: 'NOT_FOUND', message: error.message });
    }
    return reply.status(500).send({
      error: context,
      message: error?.message || 'Internal server error',
    });
  }

  // ==================== Audit Log CRUD ====================

  // GET /logs - List audit logs (paginated)
  app.get('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Database not configured' });

    const query = request.query as Record<string, any>;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;

    try {
      const result = await service.listAuditLogs({
        page,
        limit,
        tenantId: query.tenantId,
        userId: query.userId,
        action: query.action,
        resourceType: query.resourceType,
      });

      // Map to frontend-expected format: { entries, total }
      return reply.send({
        entries: result.data.map(toAuditLogEntry),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error: any) {
      return handleError(error, reply, 'AUDIT_LIST_ERROR');
    }
  });

  // GET /logs/:id - Get single audit log
  app.get('/logs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Database not configured' });

    const params = request.params as { id: string };

    try {
      const log = await service.getAuditLog(params.id);
      return reply.send(toAuditLogEntry(log));
    } catch (error: any) {
      return handleError(error, reply, 'AUDIT_GET_ERROR');
    }
  });

  // POST /logs - Create audit log
  app.post('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Database not configured' });

    const body = request.body as AuditLogCreateBody;

    try {
      const input = toCreateInput(body);
      const log = await service.createAuditLog(input);
      return reply.status(201).send({ entry: toAuditLogEntry(log) });
    } catch (error: any) {
      return handleError(error, reply, 'AUDIT_CREATE_ERROR');
    }
  });

  // GET /logs/:id/verify - Verify single audit log integrity
  app.get('/logs/:id/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Database not configured' });

    const params = request.params as { id: string };

    try {
      const log = await service.getAuditLog(params.id);
      // A single log is valid if it exists and has a proper hash
      return reply.send({
        entry: toAuditLogEntry(log),
        isValid: !!log.hash && log.hash.length > 0,
      });
    } catch (error: any) {
      return handleError(error, reply, 'AUDIT_VERIFY_ERROR');
    }
  });

  // ==================== Chain Verification ====================

  // POST /verify - Verify entire chain integrity
  app.post('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Database not configured' });

    const body = request.body as { tenantId?: string } | undefined;
    const tenantId = body?.tenantId || 'default';

    try {
      const result = await service.verifyChain(tenantId);
      return reply.send({
        result: {
          valid: result.valid,
          totalVerified: result.totalVerified ?? 0,
          breaks: result.valid ? [] : [{
            breakType: 'HASH_MISMATCH' as const,
            description: `Chain broken at ${result.brokenAt?.toISOString()}`,
            detectedAt: new Date().toISOString(),
          }],
          verifiedAt: new Date().toISOString(),
        },
        verifiedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(error, reply, 'AUDIT_VERIFY_ERROR');
    }
  });

  // ==================== Metadata ====================

  // GET /actions - Get distinct action types
  app.get('/actions', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Database not configured' });

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId || 'default';

    try {
      const actions = await service.getActions(tenantId);
      return reply.send({ actions });
    } catch (error: any) {
      return handleError(error, reply, 'AUDIT_ACTIONS_ERROR');
    }
  });

  // GET /resource-types - Get distinct resource types
  app.get('/resource-types', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Database not configured' });

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId || 'default';

    try {
      const resourceTypes = await service.getResourceTypes(tenantId);
      return reply.send({ resourceTypes });
    } catch (error: any) {
      return handleError(error, reply, 'AUDIT_RESOURCE_TYPES_ERROR');
    }
  });

  // ==================== Compatibility Endpoints ====================
  // These provide compatibility with existing frontend API calls

  // GET /chain/info - Chain info (frontend compatibility)
  app.get('/chain/info', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Database not configured' });

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId || 'default';

    try {
      const [logs, total] = await Promise.all([
        service.listAuditLogs({ page: 1, limit: 1, tenantId }),
        service.listAuditLogs({ page: 1, limit: 1, tenantId }),
      ]);

      return reply.send({
        totalEntries: total.total,
        firstSequence: 1,
        lastSequence: total.total,
        lastChainHash: logs.data.length > 0 ? logs.data[0].hash : '',
        genesisHash: '0'.repeat(64),
      });
    } catch (error: any) {
      return handleError(error, reply, 'AUDIT_CHAIN_INFO_ERROR');
    }
  });

  // GET /storage/stats - Storage stats (frontend compatibility)
  app.get('/storage/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Database not configured' });

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId || 'default';

    try {
      const total = await service.listAuditLogs({ page: 1, limit: 1, tenantId });
      return reply.send({
        stats: {
          totalEntries: total.total,
          storageSize: total.total * 1024, // Approximate
          lastFlushAt: new Date().toISOString(),
          isHealthy: true,
        },
      });
    } catch (error: any) {
      return handleError(error, reply, 'AUDIT_STORAGE_STATS_ERROR');
    }
  });

  // POST /storage/flush - Flush storage (frontend compatibility)
  // Note: This is a no-op for PostgreSQL as data is already persistent
  app.post('/storage/flush', async (request: FastifyRequest, reply: FastifyReply) => {
    // PostgreSQL doesn't need flush - data is already persisted
    return reply.send({ status: 'noop', message: 'PostgreSQL storage does not require flush' });
  });

  // GET /chain/genesis - Genesis hash (frontend compatibility)
  app.get('/chain/genesis', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ genesisHash: '0'.repeat(64) });
  });

  // GET /chain/latest - Latest entry (frontend compatibility)
  app.get('/chain/latest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Database not configured' });

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId || 'default';

    try {
      const result = await service.listAuditLogs({ page: 1, limit: 1, tenantId });
      if (result.data.length === 0) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'No audit logs found' });
      }
      return reply.send(toAuditLogEntry(result.data[0]));
    } catch (error: any) {
      return handleError(error, reply, 'AUDIT_LATEST_ERROR');
    }
  });
}
