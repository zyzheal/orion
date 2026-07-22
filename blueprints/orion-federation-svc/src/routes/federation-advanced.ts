/**
 * Federation Advanced API Routes - Phase 4
 *
 * Routes under /v1/federation-advanced
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FederationAdvancedService } from '../services/FederationAdvancedService';
import { FederationService } from '../services/FederationService';
import { FederationAdvancedController } from './controllers/FederationAdvancedController';

// FederationService needs a database pool; pass null for in-memory mode
const federationService = new FederationService(null as any);
const service = new FederationAdvancedService();
const controller = new FederationAdvancedController(service, federationService);

export default async function federationAdvancedRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/federation-advanced/scheduling-policies - 创建调度策略
  app.post('/scheduling-policies', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createSchedulingPolicy(request, reply);
  });

  // GET /v1/federation-advanced/scheduling-policies - 获取调度策略列表
  app.get('/scheduling-policies', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listSchedulingPolicies(request, reply);
  });

  // POST /v1/federation-advanced/cross-cluster-jobs - 调度跨集群任务
  app.post('/cross-cluster-jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.scheduleCrossClusterJob(request, reply);
  });

  // POST /v1/federation-advanced/resource-pools - 创建资源池
  app.post('/resource-pools', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createResourcePool(request, reply);
  });

  // GET /v1/federation-advanced/resource-pools/:poolId - 获取资源池状态
  app.get('/resource-pools/:poolId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getResourcePoolStatus(request, reply);
  });

  // ==================== Executor Management ====================

  // POST /v1/federation-advanced/executors - 注册执行器
  app.post('/executors', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerExecutor(request, reply);
  });

  // GET /v1/federation-advanced/executors - 获取执行器列表
  app.get('/executors', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listExecutors(request, reply);
  });

  // GET /v1/federation-advanced/executors/dashboard - 执行器健康仪表盘
  app.get('/executors/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getExecutorDashboard(request, reply);
  });

  // GET /v1/federation-advanced/executors/:executorId/health - 获取执行器健康状态
  app.get('/executors/:executorId/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getExecutorHealth(request, reply);
  });

  // POST /v1/federation-advanced/executors/:executorId/heartbeat - 执行器心跳
  app.post('/executors/:executorId/heartbeat', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executorHeartbeat(request, reply);
  });

  // DELETE /v1/federation-advanced/executors/:executorId - 注销执行器
  app.delete('/executors/:executorId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deregisterExecutor(request, reply);
  });

  // POST /v1/federation-advanced/dispatch-job - 调度任务（带负载均衡）
  app.post('/dispatch-job', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.dispatchJob(request, reply);
  });
}
