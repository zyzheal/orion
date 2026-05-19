/**
 * UEBA API Routes
 * Prefix: /api/v1/ueba
 *
 * 提供用户行为分析和异常检测接口。
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { UEBAService } from '../services/authz/UEBAEngine';
import { PermissionAuditRepository } from '../repositories/PermissionAuditRepository';
import { DatabasePool } from '../services/database';

interface UEBARoutesOptions {
  database?: DatabasePool;
}

interface UserQuery {
  userId: string;
  hours?: string;
}

interface RiskQuery {
  hours?: string;
  limit?: string;
}

export default async function uebaRoutes(app: FastifyInstance, options: UEBARoutesOptions): Promise<void> {
  const auditRepo = options.database ? new PermissionAuditRepository(options.database) : null;
  const uebaService = auditRepo ? new UEBAService(auditRepo) : null;

  if (!uebaService) {
    console.warn('[UEBARoutes] No database pool provided');
    return;
  }

  function handleError(error: Error, reply: FastifyReply) {
    return reply.status(500).send({ error: error.name, message: error.message });
  }

  // GET /api/v1/ueba/user/:userId - 分析单个用户行为
  app.get<{ Params: { userId: string }; Querystring: { hours?: string } }>('/user/:userId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ueba', action: 'read' })],
  }, async (request, reply) => {
    try {
      const hours = parseInt(request.query.hours || '24', 10);
      const stats = await uebaService.analyzeUserBehavior(request.params.userId, hours);
      if (!stats) {
        return reply.send({ data: null, message: 'No deny records found for this user' });
      }
      return reply.send({ data: stats });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });

  // GET /api/v1/ueba/risks - 获取高风险用户列表
  app.get<{ Querystring: RiskQuery }>('/risks', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ueba', action: 'read' })],
  }, async (request, reply) => {
    try {
      const hours = parseInt(request.query.hours || '24', 10);
      const limit = parseInt(request.query.limit || '10', 10);
      const risks = await uebaService.getHighRiskUsers(hours, limit);
      return reply.send({ data: risks, total: risks.length });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });

  // GET /api/v1/ueba/anomalies - 获取异常告警
  app.get<{ Querystring: RiskQuery }>('/anomalies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ueba', action: 'read' })],
  }, async (request, reply) => {
    try {
      const hours = parseInt(request.query.hours || '24', 10);
      const anomalies = await uebaService.detectAnomalies(hours);
      return reply.send({ data: anomalies, total: anomalies.length });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });
}