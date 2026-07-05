/**
 * Terminal Audit API Routes
 *
 * Routes under /api/v1/cmdb/terminal-audit
 * Handles terminal connect logs, file transfer logs, and audit stats.
 * Uses PostgreSQL for persistence.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { TerminalAuditRepository } from '../repositories/TerminalAuditRepository';
import { createLogger } from '../utils/logger';
import { NotFoundError, handleError } from '../errors';

const logger = createLogger('terminal-audit-routes');

// ============================================================================
// Route Registration
// ============================================================================

export default async function terminalAuditRoutes(
  app: FastifyInstance,
  options?: Record<string, unknown>
): Promise<void> {
  const db = (options as { database?: DatabasePool } | undefined)?.database;

  if (!db) {
    logger.warn('[TerminalAuditRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const repo = new TerminalAuditRepository(db);

  // ==================== Connect Logs ====================

  // List terminal connect logs (paginated, filterable by status)
  app.get('/connect-logs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 10;
    const statusFilter = query.status as string | undefined;

    const result = await repo.findAllConnectLogs(undefined, {
      page,
      pageSize,
      status: statusFilter && ['active', 'closed', 'terminated'].includes(statusFilter) ? statusFilter : undefined,
    });

    const data = result.entities.map((e) => ({
      id: e.id,
      username: e.username,
      hostname: e.hostname,
      hostIp: e.host_ip,
      connectTime: e.connect_time.toISOString(),
      disconnectTime: e.disconnect_time?.toISOString(),
      duration: e.duration,
      status: e.status,
      clientIp: e.client_ip,
    }));

    return reply.send({
      success: true,
      data,
      total: result.total,
      page,
      pageSize,
    });
  });

  // Get connect log detail
  app.get('/connect-logs/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const log = await repo.findConnectLogById(params.id);

    if (!log) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    return reply.send({
      success: true,
      data: {
        id: log.id,
        username: log.username,
        hostname: log.hostname,
        hostIp: log.host_ip,
        connectTime: log.connect_time.toISOString(),
        disconnectTime: log.disconnect_time?.toISOString(),
        duration: log.duration,
        status: log.status,
        clientIp: log.client_ip,
      },
    });
  });

  // ==================== File Transfer Logs ====================

  // List file transfer logs (paginated, filterable by operation and status)
  app.get('/file-logs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 10;
    const operationFilter = query.operation as string | undefined;
    const statusFilter = query.status as string | undefined;

    const result = await repo.findAllFileLogs(undefined, {
      page,
      pageSize,
      operation: operationFilter && ['upload', 'download'].includes(operationFilter) ? operationFilter : undefined,
      status: statusFilter && ['success', 'failed'].includes(statusFilter) ? statusFilter : undefined,
    });

    const data = result.entities.map((e) => ({
      id: e.id,
      username: e.username,
      hostname: e.hostname,
      filePath: e.file_path,
      fileName: e.file_name,
      fileSize: e.file_size,
      operation: e.operation,
      timestamp: e.timestamp.toISOString(),
      status: e.status,
    }));

    return reply.send({
      success: true,
      data,
      total: result.total,
      page,
      pageSize,
    });
  });

  // Get file transfer log detail
  app.get('/file-logs/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const log = await repo.findFileLogById(params.id);

    if (!log) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    return reply.send({
      success: true,
      data: {
        id: log.id,
        username: log.username,
        hostname: log.hostname,
        filePath: log.file_path,
        fileName: log.file_name,
        fileSize: log.file_size,
        operation: log.operation,
        timestamp: log.timestamp.toISOString(),
        status: log.status,
      },
    });
  });

  // ==================== Stats ====================

  // Get audit stats
  app.get('/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await repo.getAuditStats();

    return reply.send({
      success: true,
      data: {
        totalConnectLogs: stats.totalConnectLogs,
        activeSessions: stats.activeSessions,
        totalFileTransfers: stats.totalFileTransfers,
      },
    });
  });
}
