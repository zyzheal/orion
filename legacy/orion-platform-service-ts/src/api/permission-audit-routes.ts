/**
 * Permission Audit API Routes
 * Prefix: /api/v1/permission-audit
 *
 * 提供权限审计日志的查询接口，供管理界面展示。
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { PermissionAuditRepository } from '../repositories/PermissionAuditRepository';
import { DatabasePool } from '../services/database';
import { OrionError, ErrorCode, handleError } from '../errors';

interface AuditRoutesOptions {
  database?: DatabasePool;
}

interface QueryByUserParams {
  userId: string;
}

interface QueryByResourceParams {
  resourceType: string;
  resourceId?: string;
}

interface DeniedQuery {
  limit?: string;
  offset?: string;
  hours?: string;
}

interface StatsQuery {
  hours?: string;
}

export default async function permissionAuditRoutes(
  app: FastifyInstance,
  options: AuditRoutesOptions
): Promise<void> {
  const auditRepo = options.database ? new PermissionAuditRepository(options.database) : null;

  if (!auditRepo) {
    app.log.warn('[PermissionAuditRoutes] No database pool provided, audit routes will not be functional');
    return;
  }

  // Error handler
  function handleRouteError(error: Error, reply: FastifyReply) {
    return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
  }

  // GET /api/v1/permission-audit/denied - 查询所有拒绝记录
  app.get<{ Querystring: DeniedQuery }>('/denied', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request, reply) => {
    try {
      const limit = parseInt(request.query.limit || '100', 10);
      const offset = parseInt(request.query.offset || '0', 10);
      const data = await auditRepo.queryDenied(limit, request.user!.tenantId);
      return reply.send({ data, total: data.length, offset });
    } catch (err) {
      return handleRouteError(err as Error, reply);
    }
  });

  // GET /api/v1/permission-audit/user/:userId - 查询用户的审计日志
  app.get<{ Params: QueryByUserParams; Querystring: { limit?: string } }>('/user/:userId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request, reply) => {
    try {
      const { userId } = request.params;
      const limit = parseInt(request.query.limit || '100', 10);
      const data = await auditRepo.queryByUser(userId, limit, request.user!.tenantId);
      return reply.send({ data, total: data.length });
    } catch (err) {
      return handleRouteError(err as Error, reply);
    }
  });

  // GET /api/v1/permission-audit/resource/:resourceType - 按资源类型查询
  app.get<{ Params: QueryByResourceParams; Querystring: { resourceId?: string; limit?: string } }>('/resource/:resourceType', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request, reply) => {
    try {
      const { resourceType } = request.params;
      const { resourceId, limit } = request.query;
      const data = await auditRepo.queryByResource(resourceType, resourceId, parseInt(limit || '100', 10), request.user!.tenantId);
      return reply.send({ data, total: data.length });
    } catch (err) {
      return handleRouteError(err as Error, reply);
    }
  });

  // GET /api/v1/permission-audit/stats/denied-by-user - 统计用户被拒次数
  app.get<{ Querystring: StatsQuery }>('/stats/denied-by-user', {
    onRequest: [authenticateUser, requirePermission({ resource: 'audit', action: 'read' })],
  }, async (request, reply) => {
    try {
      const hours = parseInt(request.query.hours || '24', 10);
      const data = await auditRepo.countDeniedByUser(hours, request.user!.tenantId);
      return reply.send({ data, hours });
    } catch (err) {
      return handleRouteError(err as Error, reply);
    }
  });
}
