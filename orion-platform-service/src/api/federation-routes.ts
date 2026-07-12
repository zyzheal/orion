/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/federation/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Federation API Routes
 * 多集群联邦管理 API 路由
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { FederationService } from '../services/federation/FederationService';
import { FederationAdvancedService } from '../services/federation/FederationAdvancedService';
import { FederationAdvancedController } from './controllers/FederationAdvancedController';
import { handleError, ServiceUnavailableError, NotFoundError } from '../errors';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface FederationRoutesOptions {
  database?: DatabasePool;
}

export default async function federationRoutes(
  app: FastifyInstance,
  options: FederationRoutesOptions
): Promise<void> {
  const db = options.database;
  const federationService = db ? new FederationService(db) : null;
  const advancedService = db ? new FederationAdvancedService(db) : null;
  const advancedController = advancedService && federationService
    ? new FederationAdvancedController(advancedService, federationService)
    : null;

  // DB 不可用时的统一错误响应
  const dbUnavailable = async (_request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('FederationService', 'Federation management requires database connection'));
  };

  // ==================== Federation Config CRUD ====================

  // POST /federation - 创建联邦配置
  app.post('/federation', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const body = (request as any).body;
      const result = await federationService.createFederation(body);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /federation/:id - 获取联邦配置
  app.get('/federation/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { id: string };
      const result = await federationService.getFederation(params.id);
      if (!result) {
        return handleError(reply, new NotFoundError('Federation not found'));
      }
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /federation - 获取联邦配置列表
  app.get('/federation', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const tenantId = (request as any).user?.tenantId;
      const result = await federationService.listFederations(tenantId);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // PUT /federation/:id - 更新联邦配置
  app.put('/federation/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { id: string };
      const body = (request as any).body;
      const result = await federationService.updateFederation(params.id, body);
      if (!result) {
        return handleError(reply, new NotFoundError('Federation not found'));
      }
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // DELETE /federation/:id - 删除联邦配置
  app.delete('/federation/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { id: string };
      const deleted = await federationService.deleteFederation(params.id);
      return reply.send({ deleted });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ==================== Executor Management ====================

  // POST /federation/executors - 注册执行器
  app.post('/federation/executors', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const body = (request as any).body;
      const result = await federationService.registerExecutor(body);
      return reply.status(201).send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /federation/executors - 获取执行器列表
  app.get('/federation/executors', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const tenantId = (request as any).user?.tenantId;
      const result = await federationService.listExecutors(tenantId);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /federation/executors/:executorId/health - 获取执行器健康状态
  app.get('/federation/executors/:executorId/health', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { executorId: string };
      const result = await federationService.getExecutorHealth(params.executorId);
      if (!result) {
        return handleError(reply, new NotFoundError('Executor not found'));
      }
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /federation/executors/dashboard - 获取执行器健康仪表盘
  app.get('/federation/executors/dashboard', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const tenantId = (request as any).user?.tenantId;
      const result = await federationService.getExecutorDashboard(tenantId);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /federation/executors/:executorId/heartbeat - 执行器心跳
  app.post('/federation/executors/:executorId/heartbeat', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { executorId: string };
      const body = (request as any).body;
      const result = await federationService.executorHeartbeat(params.executorId, body);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // DELETE /federation/executors/:executorId - 注销执行器
  app.delete('/federation/executors/:executorId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { executorId: string };
      const deregistered = await federationService.deregisterExecutor(params.executorId);
      return reply.send({ deregistered });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /federation/dispatch-job - 调度任务
  app.post('/federation/dispatch-job', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const tenantId = (request as any).user?.tenantId;
      const body = (request as any).body;
      const result = await federationService.dispatchJob(tenantId, body);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ==================== Federation Advanced ====================

  // POST /federation-advanced/scheduling-policies - 创建调度策略
  app.post('/federation-advanced/scheduling-policies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!advancedController) return dbUnavailable(request, reply);
    return advancedController.createSchedulingPolicy(request, reply);
  });

  // GET /federation-advanced/scheduling-policies - 获取调度策略列表
  app.get('/federation-advanced/scheduling-policies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!advancedController) return dbUnavailable(request, reply);
    return advancedController.listSchedulingPolicies(request, reply);
  });

  // POST /federation-advanced/cross-cluster-jobs - 调度跨集群任务
  app.post('/federation-advanced/cross-cluster-jobs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!advancedController) return dbUnavailable(request, reply);
    return advancedController.scheduleCrossClusterJob(request, reply);
  });

  // POST /federation-advanced/resource-pools - 创建资源池
  app.post('/federation-advanced/resource-pools', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!advancedController) return dbUnavailable(request, reply);
    return advancedController.createResourcePool(request, reply);
  });

  // GET /federation-advanced/resource-pools/:poolId - 获取资源池状态
  app.get('/federation-advanced/resource-pools/:poolId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!advancedController) return dbUnavailable(request, reply);
    return advancedController.getResourcePoolStatus(request, reply);
  });

  // ==================== Federation Lifecycle ====================

  // POST /federation/:id/sync - Sync federation config
  app.post('/federation/:id/sync', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { id: string };
      const body = (request as any).body;
      const result = await federationService.syncFederationConfig(params.id, body);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /federation/:id/refresh - Refresh federation data
  app.post('/federation/:id/refresh', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { id: string };
      const body = (request as any).body;
      const result = await federationService.refreshFederationData(params.id, body);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /federation/:id/audit - Federation audit log
  app.get('/federation/:id/audit', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { id: string };
      const result = await federationService.getFederationAudit(params.id);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /federation/:id/status - Federation status
  app.get('/federation/:id/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { id: string };
      const result = await federationService.getFederationStatus(params.id);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /federation/:id/health-check - Health check
  app.post('/federation/:id/health-check', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { id: string };
      const body = (request as any).body;
      const result = await federationService.healthCheckFederation(params.id, body);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /federation/:id/progress - Sync progress
  app.get('/federation/:id/progress', {
    onRequest: [authenticateUser, requirePermission({ resource: 'federation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!federationService) return dbUnavailable(request, reply);
    try {
      const params = (request as any).params as { id: string };
      const result = await federationService.getFederationSyncProgress(params.id);
      return reply.send(result);
    } catch (error) {
      return handleError(reply, error);
    }
  });
}