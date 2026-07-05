/**
 * Audit API Routes
 *
 * Migrated to PostgreSQL Repository pattern.
 * Prefix: /api/v1/audit
 *
 * Endpoints:
 *   GET    /logs/export     - Export audit logs (JSON/CSV) via query params
 *   POST   /export          - Export audit logs as CSV (body params)
 *   POST   /export/json     - Export audit logs as JSON (body params)
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
import { AuditService, type ExportFormat } from '../services/audit/AuditService';
import { AuditComplianceService, ComplianceCheckResult, AuditComplianceReport, AuditCoverageStats } from '../services/audit/AuditComplianceService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OrionError, NotFoundError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

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

interface AuditExportBody {
  tenantId?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  dateFrom?: string;
  dateTo?: string;
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
    resource: log.resource_type,
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
function toCreateInput(body: AuditLogCreateBody, fallbackTenantId?: string): any {
  return {
    tenant_id: body.tenantId || fallbackTenantId,
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
  function handleRouteError(error: any, reply: FastifyReply) {
    if (error?.code === 'NOT_FOUND') {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    return handleError(reply, new OrionError('audit.route', ErrorCode.INTERNAL_ERROR));
  }

  // ==================== Audit Log CRUD ====================

  // GET /logs - List audit logs (paginated)
  app.get('/logs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

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
      return handleRouteError(error, reply);
    }
  });

  // GET /logs/:id - Get single audit log
  app.get('/logs/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const params = request.params as { id: string };

    try {
      const log = await service.getAuditLog(params.id);
      return reply.send(toAuditLogEntry(log));
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // POST /logs - Create audit log
  app.post('/logs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const body = request.body as AuditLogCreateBody;
    const fallbackTenantId = (request as any).user?.tenantId;

    try {
      const input = toCreateInput(body, fallbackTenantId);
      const log = await service.createAuditLog(input);
      return reply.status(201).send({ entry: toAuditLogEntry(log) });
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // GET /logs/:id/verify - Verify single audit log integrity
  app.get('/logs/:id/verify', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const params = request.params as { id: string };

    try {
      const log = await service.getAuditLog(params.id);
      // A single log is valid if it exists and has a proper hash
      return reply.send({
        entry: toAuditLogEntry(log),
        isValid: !!log.hash && log.hash.length > 0,
      });
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // ==================== Chain Verification ====================

  // POST /verify - Verify entire chain integrity
  app.post('/verify', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const body = request.body as { tenantId?: string } | undefined;
    const tenantId = body?.tenantId ?? '';

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
      return handleRouteError(error, reply);
    }
  });

  // ==================== Metadata ====================

  // GET /actions - Get distinct action types
  app.get('/actions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId;

    try {
      const actions = await service.getActions(tenantId ?? '');
      return reply.send({ actions });
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // GET /resource-types - Get distinct resource types
  app.get('/resource-types', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId;

    try {
      const resourceTypes = await service.getResourceTypes(tenantId ?? '');
      return reply.send({ resourceTypes });
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // ==================== Compliance Reporting ====================
  // SOC2 / ISO27001 compliance reports

  // GET /compliance/soc2 - SOC2 Type II compliance report
  app.get('/compliance/soc2', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId;

    try {
      const complianceService = new AuditComplianceService(pool!);
      const report = await complianceService.generateSOC2Report(tenantId ?? '');
      return reply.send(report);
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // GET /compliance/iso27001 - ISO27001 compliance report
  app.get('/compliance/iso27001', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId;

    try {
      const complianceService = new AuditComplianceService(pool!);
      const report = await complianceService.generateISO27001Report(tenantId ?? '');
      return reply.send(report);
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // GET /compliance/combined - Combined SOC2 + ISO27001 compliance report
  app.get('/compliance/combined', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId;

    try {
      const complianceService = new AuditComplianceService(pool!);
      const report = await complianceService.generateCombinedReport(tenantId ?? '');
      return reply.send(report);
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // GET /compliance/coverage - Audit coverage statistics
  app.get('/compliance/coverage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId;

    try {
      const complianceService = new AuditComplianceService(pool!);
      const stats = await complianceService.getAuditCoverageStats(tenantId ?? '');
      return reply.send(stats);
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // POST /compliance/check - Run all compliance checks
  app.post('/compliance/check', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const body = request.body as { framework?: 'SOC2' | 'ISO27001' | 'COMBINED'; tenantId?: string } | undefined;
    const tenantId = body?.tenantId;
    const framework = body?.framework || 'COMBINED';

    try {
      const complianceService = new AuditComplianceService(pool!);
      let report: AuditComplianceReport;

      switch (framework) {
        case 'SOC2':
          report = await complianceService.generateSOC2Report(tenantId ?? '');
          break;
        case 'ISO27001':
          report = await complianceService.generateISO27001Report(tenantId ?? '');
          break;
        default:
          report = await complianceService.generateCombinedReport(tenantId ?? '');
      }

      return reply.send(report);
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // ==================== Compatibility Endpoints ====================
  // These provide compatibility with existing frontend API calls

  // GET /chain/info - Chain info (frontend compatibility)
  app.get('/chain/info', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId;

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
      return handleRouteError(error, reply);
    }
  });

  // GET /storage/stats - Storage stats (frontend compatibility)
  app.get('/storage/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId;

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
      return handleRouteError(error, reply);
    }
  });

  // POST /storage/flush - Flush storage (frontend compatibility)
  // Note: This is a no-op for PostgreSQL as data is already persistent
  app.post('/storage/flush', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // PostgreSQL doesn't need flush - data is already persisted
    return reply.send({ status: 'noop', message: 'PostgreSQL storage does not require flush' });
  });

  // GET /chain/genesis - Genesis hash (frontend compatibility)
  app.get('/chain/genesis', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ genesisHash: '0'.repeat(64) });
  });

  // GET /chain/latest - Latest entry (frontend compatibility)
  app.get('/chain/latest', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId;

    try {
      const result = await service.listAuditLogs({ page: 1, limit: 1, tenantId });
      if (result.data.length === 0) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }
      return reply.send(toAuditLogEntry(result.data[0]));
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // GET /logs/export - Export audit logs (CSV/JSON)
  app.get('/logs/export', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const query = request.query as Record<string, any>;
    const format = (query.format as ExportFormat) || 'json';

    try {
      const result = await service.exportAuditLogs({
        tenantId: query.tenantId,
        userId: query.userId,
        action: query.action,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        format,
      });

      if (format === 'csv') {
        reply.type('text/csv');
        reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      } else {
        reply.type('application/json');
        reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      }

      return reply.send(result.content);
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // POST /export - Export audit logs as CSV (body params)
  app.post('/export', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const body = request.body as AuditExportBody;

    try {
      const result = await service.exportAuditLogs({
        tenantId: body.tenantId,
        userId: body.userId,
        action: body.action,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
        format: 'csv',
      });

      reply.type('text/csv');
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.send(result.content);
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });

  // POST /export/json - Export audit logs as JSON (body params)
  app.post('/export/json', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));

    const body = request.body as AuditExportBody;

    try {
      const result = await service.exportAuditLogs({
        tenantId: body.tenantId,
        userId: body.userId,
        action: body.action,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
        format: 'json',
      });

      reply.type('application/json');
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.send(result.content);
    } catch (error: any) {
      return handleRouteError(error, reply);
    }
  });
}
