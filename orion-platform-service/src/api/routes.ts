/**
 * API 路由注册 - Fastify 版本（不使用 fp 以支持 prefix）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { roleGuard } from '../middleware/roleGuard';
import { PipelineController } from './controllers/PipelineController';
import { PipelineRunController } from './controllers/PipelineRunController';
import { StageController } from './controllers/StageController';
import { TaskController } from './controllers/TaskController';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRepository } from '../services/pipeline/PipelineRepository';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { PipelineRunRepository } from '../services/pipeline/PipelineRunRepository';
import { PipelineEngine } from '../engine/PipelineEngine';
import { StageExecutor } from '../engine/StageExecutor';
import { TaskRunner } from '../engine/TaskRunner';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { EventBusService } from '../services/event-bus-service';
import { DatabasePool } from '../services/database';
import cmdbRoutes from '../routes-cmdb';
import buildRoutes from './build-routes';
import codeRepoRoutes from './code-repo-routes';
import costRoutes from './cost-routes';
import configRoutes from './config-routes';
import riskRoutes from './risk-routes';
import finopsV2Routes from './finops-v2-routes';
import aiReviewRoutes from './ai-review-routes';
import diagnosticRoutes from './diagnostic-routes';
import testSelectorRoutes from './test-selector-routes';
import deployRoutes from './deploy-routes';
import monitoringRoutes from './monitoring-routes';
import ticketingRoutes from './ticketing-routes';
import selfHealingRoutes from './self-healing-routes';
import backupRoutes from './backup-routes';
import pluginSpiRoutes from './plugin-spi-routes';
import aiSecurityRoutes from './ai-security-routes';
import pluginRoutes from '../routes-plugin';
import aiGatewayRoutes from './ai-gateway-routes';
import alertRoutes from './alert-routes';
import auditRoutes from './audit-routes';
import tenantRoutes from './tenant-routes';
import efficiencyRoutes from './efficiency-routes';
import sbomRoutes from './sbom-routes';
import policyRoutes from './policy-routes';
import changeIntelligenceRoutes from './change-intelligence-routes';
import canaryAnalysisRoutes from './canary-analysis-routes';
import iacRoutes from './iac-routes';
import chatopsRoutes from './chatops-routes';
import skillRoutes from './skill-routes';
import aiCostRoutes from './ai-cost-routes';
import artifactRoutes from './artifact-routes';
import sessionRoutes from './session-routes';
import confirmationRoutes from './confirmation-routes';

// New P0 routes
import vectorStoreRoutes from './vector-store-routes';
import oncallRoutes from './oncall-routes';
import approvalRoutes from './approval-routes';
import cronRoutes from './cron-routes';
import eventbusRoutes from './eventbus-routes';
import { productLineRoutes } from './product-line-routes';
import { internalLibraryRoutes } from './internal-library-routes';
import notificationRoutes from './notification-routes';
import webhookRoutes from './webhook-routes';
import roleRoutes from './role-routes';
import knowledgeRoutes from './knowledge-routes';
import metricsRoutes from './metrics-routes';
import userRoutes from './user-routes';
import environmentRoutes from './environment-routes';
import queueRoutes from './queue-routes';
import projectRoutes from './project-routes';
import agentRoutes from '../routes-agent';
import apiKeyRoutes from './api-key-routes';

export interface ApiRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
}

// 角色常量 — 集中管理受保护路由所需的角色
const ADMIN_ROLES = ['admin', 'platform_admin'] as const;

/**
 * 为路由模块注册带 JWT 认证 + 角色校验的封装插件。
 *
 * Fastify 的插件封装机制确保 addHook 注册的 onRequest 钩子
 * 仅作用于该插件内部注册的路由，不影响其他路由。
 *
 * @param app - Fastify 实例
 * @param routeModule - 路由模块函数
 * @param prefix - 路由前缀（如 '/users'）
 * @param routeOptions - 传递给路由模块的自定义选项（不含 prefix）
 * @param requiredRoles - 所需角色列表
 */
async function registerWithRoleGuard(
  app: FastifyInstance,
  routeModule: (instance: FastifyInstance, opts?: any) => Promise<void>,
  prefix: string,
  routeOptions?: Record<string, unknown>,
  requiredRoles: readonly string[] = ADMIN_ROLES
): Promise<void> {
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);
    instance.addHook('onRequest', roleGuard([...requiredRoles]));
    await instance.register(routeModule, { prefix, ...routeOptions });
  });
}

export default async function apiRoutes(app: FastifyInstance, options: ApiRoutesOptions): Promise<void> {
  // 初始化服务
  // ARCH-010: 直接传递 EventBusService 到 PipelineEventPublisher
  const eventPublisher = new PipelineEventPublisher({
    eventBus: options.eventBus,
    source: 'pipeline-service',
  });
  // 初始化 Pipeline 服务 - PostgreSQL Repository pattern
  let pipelineRepository: PipelineRepository | null = null;
  let pipelineRunRepository: PipelineRunRepository | null = null;

  if (options.database) {
    pipelineRepository = new PipelineRepository(options.database);
    pipelineRunRepository = new PipelineRunRepository(options.database);
    console.log('[Routes] Database-backed PipelineRepository & PipelineRunRepository initialized');
  } else {
    console.warn('[Routes] Database not available, pipeline CRUD will not be functional');
  }

  const pipelineService = new PipelineService(pipelineRepository!);
  const runService = new PipelineRunService(eventPublisher, pipelineRunRepository!);
  const taskRunner = new TaskRunner();
  const stageExecutor = new StageExecutor(taskRunner, eventPublisher);
  const engine = new PipelineEngine(pipelineService, runService, eventPublisher, stageExecutor);

  // 初始化控制器
  const pipelineController = new PipelineController(pipelineService);
  const pipelineRunController = new PipelineRunController(runService, engine);
  const stageController = new StageController(runService, stageExecutor);
  const taskController = new TaskController(runService);

  // ==================== Pipeline 路由 ====================

  // POST /api/v1/pipelines - 创建 Pipeline
  app.post('/v1/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.create(request, reply);
  });

  // GET /api/v1/pipelines - 获取 Pipeline 列表
  app.get('/v1/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.list(request, reply);
  });

  // GET /api/v1/pipelines/:id - 获取 Pipeline 详情
  app.get('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.getById(request, reply);
  });

  // GET /api/v1/pipelines/:id/versions - 获取 Pipeline 所有版本
  app.get('/v1/pipelines/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.getVersions(request, reply);
  });

  // PUT /api/v1/pipelines/:id - 更新 Pipeline
  app.put('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.update(request, reply);
  });

  // DELETE /api/v1/pipelines/:id - 删除 Pipeline
  app.delete('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.delete(request, reply);
  });

  // POST /api/v1/pipelines/validate - 验证 Pipeline YAML
  app.post('/v1/pipelines/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.validate(request, reply);
  });

  // ==================== PipelineRun 路由 ====================

  // POST /api/v1/pipelines/:id/runs - 触发 Pipeline 执行
  app.post('/v1/pipelines/:id/runs', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.trigger(request, reply);
  });

  // GET /api/v1/pipeline-runs - 获取 PipelineRun 列表
  app.get('/v1/pipeline-runs', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.list(request, reply);
  });

  // GET /api/v1/pipeline-runs/:id - 获取 PipelineRun 详情
  app.get('/v1/pipeline-runs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.getById(request, reply);
  });

  // POST /api/v1/pipeline-runs/:id/cancel - 取消 PipelineRun
  app.post('/v1/pipeline-runs/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.cancel(request, reply);
  });

  // GET /api/v1/pipeline-runs/:id/stages - 获取 PipelineRun 的 Stages
  app.get('/v1/pipeline-runs/:id/stages', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.getStages(request, reply);
  });

  // GET /api/v1/pipeline-runs/:id/tasks - 获取 PipelineRun 的 Tasks
  app.get('/v1/pipeline-runs/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.getTasks(request, reply);
  });

  // ==================== Stage 路由 ====================

  // GET /api/v1/stages/:id - 获取 Stage 详情
  app.get('/v1/stages/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageController.getById(request, reply);
  });

  // GET /api/v1/stages/:id/tasks - 获取 Stage 下的 Tasks
  app.get('/v1/stages/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageController.getTasks(request, reply);
  });

  // POST /api/v1/stages/:id/retry - 重试 Stage
  app.post('/v1/stages/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageController.retry(request, reply);
  });

  // ==================== Task 路由 ====================

  // GET /api/v1/tasks/:id - 获取 Task 详情
  app.get('/v1/tasks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return taskController.getById(request, reply);
  });

  // GET /api/v1/tasks/:id/log - 获取 Task 日志
  app.get('/v1/tasks/:id/log', async (request: FastifyRequest, reply: FastifyReply) => {
    return taskController.getLog(request, reply);
  });

  // POST /api/v1/tasks/:id/retry - 重试 Task
  app.post('/v1/tasks/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
    return taskController.retry(request, reply);
  });

  // ==================== CMDB 路由 ====================

  // 注册 CMDB API 路由
  await app.register(cmdbRoutes, { prefix: '/v1/cmdb', database: options.database });

  // ==================== 构建环境管理路由 ====================

  // 注册 Build Environment API 路由 (PostgreSQL backed for BuildCache)
  await registerWithRoleGuard(app, buildRoutes, '/v1/', { database: options.database });

  // 注册 Code Repository Integration API 路由
  await registerWithRoleGuard(app, codeRepoRoutes, '/v1/code-repo');

  // 注册 Configuration Management API 路由 (PostgreSQL backed)
  await app.register(configRoutes, { prefix: '/v1/config', database: options.database });

  // 注册 FinOps 成本管理 API 路由
  await app.register(costRoutes, { prefix: '/v1/cost', database: options.database });

  // 注册风险评估 API 路由
  await app.register(riskRoutes, { prefix: '/v1/risk' });

  // 注册 FinOps 成本追踪与 ROI API 路由 (TASK-502) - PostgreSQL backed
  await app.register(finopsV2Routes, { prefix: '/v1/finops', database: options.database });

  // 注册 AI Code Review API 路由 (TASK-302)
  await registerWithRoleGuard(app, aiReviewRoutes, '/v1/ai-review');

  // 注册诊断 Agent API 路由 (TASK-305) - PostgreSQL backed
  await registerWithRoleGuard(app, diagnosticRoutes, '/v1/diagnostic', { database: options.database });

  // 注册智能测试选择器 API 路由 (TASK-303)
  await app.register(testSelectorRoutes, { prefix: '/v1/test-selector' });

  // 注册智能部署 API 路由 (TASK-701) - PostgreSQL backed
  await app.register(deployRoutes, { prefix: '/v1/deploy', database: options.database });

  // 注册监控告警 API 路由 (TASK-703)
  await registerWithRoleGuard(app, monitoringRoutes, '/v1/monitoring', { database: options.database });

  // 注册智能工单 API 路由 (TASK-801) - PostgreSQL backed
  await app.register(ticketingRoutes, { prefix: '/v1/tickets', database: options.database });

  // Register self-healing API routes (TASK-702) - PostgreSQL backed
  await registerWithRoleGuard(app, selfHealingRoutes, '/v1/self-healing', { database: options.database });

  // 注册备份恢复 API 路由 (TASK-704) - PostgreSQL backed
  await app.register(backupRoutes, { prefix: '/v1/backup', database: options.database });

  // 注册 Plugin SPI API 路由 (TASK-104)
  await app.register(pluginSpiRoutes, { prefix: '/v1/plugins-spi' });

  // 注册 Plugin Management API 路由
  await registerWithRoleGuard(app, pluginRoutes, '/v1/plugins');

  // 注册 AI 安全加固 API 路由 (TASK-1004) — P1-15 Fix: pass database for audit log persistence
  await registerWithRoleGuard(app, aiSecurityRoutes, '/v1/ai-security', { database: options.database });

  // 注册 AI 网关 API 路由
  await app.register(aiGatewayRoutes, { prefix: '/v1/ai-gateway' });

  // 注册告警管理 API 路由
  await app.register(alertRoutes, { prefix: '/v1/alert' });

  // 注册审计 API 路由
  await registerWithRoleGuard(app, auditRoutes, '/v1/audit', { database: options.database });

  // 注册租户管理 API 路由 (PostgreSQL backed)
  await registerWithRoleGuard(app, tenantRoutes, '/v1/tenant', { database: options.database });

  // 注册效能分析 API 路由 — P0-4 Fix: pass database for real DORA metrics
  await app.register(efficiencyRoutes, { prefix: '/v1/efficiency', database: options.database });

  // 注册 SBOM Attestation API 路由 (P0) - migrated to PostgreSQL
  await app.register(sbomRoutes, { prefix: '/v1/sbom', eventBus: options.eventBus, database: options.database });

  // 注册 OPA Policy Engine API 路由 (P0) - PostgreSQL backed
  await app.register(policyRoutes, { prefix: '/v1/policies', database: options.database, eventBus: options.eventBus });

  // 注册 AI Change Intelligence API 路由 (P0)
  await app.register(changeIntelligenceRoutes, { prefix: '/v1/change-intelligence', eventBus: options.eventBus });

  // 注册 ML Canary Analysis API 路由 (P0)
  await app.register(canaryAnalysisRoutes, { prefix: '/v1/canary-analysis', eventBus: options.eventBus });

  // 注册 Skill Management API 路由 (M12)
  await app.register(skillRoutes, { prefix: '/v1/skills', database: options.database });

  // 注册 AI Cost Optimization API 路由 (M36)
  await registerWithRoleGuard(app, aiCostRoutes, '/v1/ai-cost', { database: options.database });

  // 注册 IaC Management API 路由 (M20) - PostgreSQL backed
  await registerWithRoleGuard(app, iacRoutes, '/v1/iac', { eventBus: options.eventBus, database: options.database });

  // 注册 ChatOps API 路由 (M35) - PostgreSQL backed
  await registerWithRoleGuard(app, chatopsRoutes, '/v1/chatops', {
    eventBus: options.eventBus,
    database: options.database,
    pipelineService,
  });

  // 注册 Manual Confirmation API 路由 (P0-6)
  await registerWithRoleGuard(app, confirmationRoutes, '/v1/confirmations', { database: options.database, eventBus: options.eventBus });

  // 注册 Artifact Registry API 路由
  await app.register(artifactRoutes, { prefix: '/v1/artifacts', database: options.database });

  // 注册 Vector Store API 路由 (P0-G2 - pgvector backed) — admin only
  await registerWithRoleGuard(app, vectorStoreRoutes, '/v1/vector-store', { database: options.database });

  // 注册 OnCall 排班 API 路由 (P0 - SRE scheduling)
  await app.register(oncallRoutes, { prefix: '/v1/oncall', database: options.database, eventBus: options.eventBus });

  // 注册审批 API 路由 (P0 - multi-level approval) — P0-7 Fix: requires database
  if (options.database) {
    await app.register(approvalRoutes, { prefix: '/v1/approvals', database: options.database });
  }

  // 注册 Cron Scheduler API 路由 (P0-1 Fix: was missing)
  await app.register(cronRoutes, { prefix: '/v1/cron', database: options.database });

  // 注册 EventBus API 路由 (M24 - PostgreSQL backed) — admin only
  await registerWithRoleGuard(app, eventbusRoutes, '/v1/eventbus', { database: options.database, eventBus: options.eventBus });

  // 注册 ProductLine 多分支产品线 API 路由 (M6) — P0-2 Fix: pass database
  await app.register(productLineRoutes, { prefix: '/v1/product-lines', database: options.database });

  // 注册 Internal Library 二方库管理 API 路由 (M30)
  await app.register(internalLibraryRoutes, { prefix: '/v1/internal-libraries', database: options.database });

  // 注册 Notification API 路由 (M8/M33)
  await app.register(notificationRoutes, { prefix: '/v1/notifications' });

  // 注册 Role Management API 路由 (RBAC) - PostgreSQL backed
  await registerWithRoleGuard(app, roleRoutes, '/v1/roles', { database: options.database });

  // 注册 Session Management API 路由 - PostgreSQL backed
  await app.register(sessionRoutes, { prefix: '/v1/sessions', database: options.database });

  // 注册 Webhook Management API 路由 (M1) - PostgreSQL backed
  await app.register(webhookRoutes, { prefix: '/v1/webhooks', database: options.database });

  // 注册 Project Management API 路由 - PostgreSQL backed
  await app.register(projectRoutes, { prefix: '/v1/projects', database: options.database });

  // 注册 Environment Management API 路由 - PostgreSQL backed
  await app.register(environmentRoutes, { prefix: '/v1/environments', database: options.database });

  // 注册 Queue Management API 路由 (M24) - PostgreSQL backed
  await app.register(queueRoutes, { prefix: '/v1/queue', database: options.database });

  // 注册 Knowledge Base API 路由 (M28) - PostgreSQL backed
  await app.register(knowledgeRoutes, { prefix: '/v1/knowledge', database: options.database });

  // 注册 Metrics API 路由 - PostgreSQL backed
  await app.register(metricsRoutes, { prefix: '/v1/metrics', database: options.database });

  // 注册 User Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, userRoutes, '/v1/users', { database: options.database });

  // 注册 Agent Orchestration API 路由 - PostgreSQL backed
  await app.register(agentRoutes, { prefix: '/v1/', eventBus: options.eventBus, database: options.database });

  // 注册 API Key Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, apiKeyRoutes, '/v1/api-keys', { database: options.database });
}