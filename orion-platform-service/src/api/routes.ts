/**
 * API 路由注册 - Fastify 版本（不使用 fp 以支持 prefix）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PipelineController } from './controllers/PipelineController';
import { PipelineRunController } from './controllers/PipelineRunController';
import { StageController } from './controllers/StageController';
import { TaskController } from './controllers/TaskController';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
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
import confirmationRoutes from './confirmation-routes';

// New P0 routes
import vectorStoreRoutes from './vector-store-routes';
import oncallRoutes from './oncall-routes';
import approvalRoutes from './approval-routes';
import eventbusRoutes from './eventbus-routes';
import productLineRoutes from './product-line-routes';
import internalLibraryRoutes from './internal-library-routes';
import notificationRoutes from './notification-routes';

export interface ApiRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
}

export default async function apiRoutes(app: FastifyInstance, options: ApiRoutesOptions): Promise<void> {
  // 初始化服务
  const eventPublisher = new PipelineEventPublisher(options.eventBus ? {
    eventBus: {
      publish: (subject: string, data: any) => options.eventBus!.publish(subject, data),
      isHealthy: () => true,
    }
  } : undefined);
  const pipelineService = new PipelineService();
  const runService = new PipelineRunService(eventPublisher);
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
  app.post('/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.create(request, reply);
  });

  // GET /api/v1/pipelines - 获取 Pipeline 列表
  app.get('/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.list(request, reply);
  });

  // GET /api/v1/pipelines/:id - 获取 Pipeline 详情
  app.get('/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.getById(request, reply);
  });

  // GET /api/v1/pipelines/:id/versions - 获取 Pipeline 所有版本
  app.get('/pipelines/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.getVersions(request, reply);
  });

  // PUT /api/v1/pipelines/:id - 更新 Pipeline
  app.put('/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.update(request, reply);
  });

  // DELETE /api/v1/pipelines/:id - 删除 Pipeline
  app.delete('/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.delete(request, reply);
  });

  // POST /api/v1/pipelines/validate - 验证 Pipeline YAML
  app.post('/pipelines/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.validate(request, reply);
  });

  // ==================== PipelineRun 路由 ====================

  // POST /api/v1/pipelines/:id/runs - 触发 Pipeline 执行
  app.post('/pipelines/:id/runs', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.trigger(request, reply);
  });

  // GET /api/v1/pipeline-runs - 获取 PipelineRun 列表
  app.get('/pipeline-runs', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.list(request, reply);
  });

  // GET /api/v1/pipeline-runs/:id - 获取 PipelineRun 详情
  app.get('/pipeline-runs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.getById(request, reply);
  });

  // POST /api/v1/pipeline-runs/:id/cancel - 取消 PipelineRun
  app.post('/pipeline-runs/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.cancel(request, reply);
  });

  // GET /api/v1/pipeline-runs/:id/stages - 获取 PipelineRun 的 Stages
  app.get('/pipeline-runs/:id/stages', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.getStages(request, reply);
  });

  // GET /api/v1/pipeline-runs/:id/tasks - 获取 PipelineRun 的 Tasks
  app.get('/pipeline-runs/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.getTasks(request, reply);
  });

  // ==================== Stage 路由 ====================

  // GET /api/v1/stages/:id - 获取 Stage 详情
  app.get('/stages/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageController.getById(request, reply);
  });

  // GET /api/v1/stages/:id/tasks - 获取 Stage 下的 Tasks
  app.get('/stages/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageController.getTasks(request, reply);
  });

  // POST /api/v1/stages/:id/retry - 重试 Stage
  app.post('/stages/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageController.retry(request, reply);
  });

  // ==================== Task 路由 ====================

  // GET /api/v1/tasks/:id - 获取 Task 详情
  app.get('/tasks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return taskController.getById(request, reply);
  });

  // GET /api/v1/tasks/:id/log - 获取 Task 日志
  app.get('/tasks/:id/log', async (request: FastifyRequest, reply: FastifyReply) => {
    return taskController.getLog(request, reply);
  });

  // POST /api/v1/tasks/:id/retry - 重试 Task
  app.post('/tasks/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
    return taskController.retry(request, reply);
  });

  // ==================== CMDB 路由 ====================

  // 注册 CMDB API 路由
  await app.register(cmdbRoutes, { prefix: '/cmdb', database: options.database });

  // ==================== 构建环境管理路由 ====================

  // 注册 Build Environment API 路由
  await app.register(buildRoutes, { prefix: '/build' });

  // 注册 Code Repository Integration API 路由
  await app.register(codeRepoRoutes, { prefix: '/code-repo' });

  // 注册 Configuration Management API 路由 (PostgreSQL backed)
  await app.register(configRoutes, { prefix: '/config', database: options.database });

  // 注册 FinOps 成本管理 API 路由
  await app.register(costRoutes, { prefix: '/cost', database: options.database });

  // 注册风险评估 API 路由
  await app.register(riskRoutes, { prefix: '/risk' });

  // 注册 FinOps 成本追踪与 ROI API 路由 (TASK-502) - PostgreSQL backed
  await app.register(finopsV2Routes, { prefix: '/finops', database: options.database });

  // 注册 AI Code Review API 路由 (TASK-302)
  await app.register(aiReviewRoutes, { prefix: '/ai-review' });

  // 注册诊断 Agent API 路由 (TASK-305)
  await app.register(diagnosticRoutes, { prefix: '/diagnostic' });

  // 注册智能测试选择器 API 路由 (TASK-303)
  await app.register(testSelectorRoutes, { prefix: '/test-selector' });

  // 注册智能部署 API 路由 (TASK-701)
  await app.register(deployRoutes, { prefix: '/deploy' });

  // 注册监控告警 API 路由 (TASK-703)
  await app.register(monitoringRoutes, { prefix: '/monitoring', database: options.database });

  // 注册智能工单 API 路由 (TASK-801) - PostgreSQL backed
  await app.register(ticketingRoutes, { prefix: '/tickets', database: options.database });

  // 注册自愈引擎 API 路由 (TASK-702)
  await app.register(selfHealingRoutes, { prefix: '/self-healing' });

  // 注册备份恢复 API 路由 (TASK-704) - PostgreSQL backed
  await app.register(backupRoutes, { prefix: '/backup', database: options.database });

  // 注册 Plugin SPI API 路由 (TASK-104)
  await app.register(pluginSpiRoutes, { prefix: '/plugins-spi' });

  // 注册 Plugin Management API 路由
  await app.register(pluginRoutes, { prefix: '/plugins' });

  // 注册 AI 安全加固 API 路由 (TASK-1004)
  await app.register(aiSecurityRoutes, { prefix: '/ai-security' });

  // 注册 AI 网关 API 路由
  await app.register(aiGatewayRoutes, { prefix: '/ai-gateway' });

  // 注册告警管理 API 路由
  await app.register(alertRoutes, { prefix: '/alert' });

  // 注册审计 API 路由
  await app.register(auditRoutes, { prefix: '/audit', database: options.database });

  // 注册租户管理 API 路由
  await app.register(tenantRoutes, { prefix: '/tenant' });

  // 注册效能分析 API 路由
  await app.register(efficiencyRoutes, { prefix: '/efficiency' });

  // 注册 SBOM Attestation API 路由 (P0) - migrated to PostgreSQL
  await app.register(sbomRoutes, { prefix: '/sbom', eventBus: options.eventBus, database: options.database });

  // 注册 OPA Policy Engine API 路由 (P0) - PostgreSQL backed
  await app.register(policyRoutes, { prefix: '/policies', database: options.database, eventBus: options.eventBus });

  // 注册 AI Change Intelligence API 路由 (P0)
  await app.register(changeIntelligenceRoutes, { prefix: '/change-intelligence', eventBus: options.eventBus });

  // 注册 ML Canary Analysis API 路由 (P0)
  await app.register(canaryAnalysisRoutes, { prefix: '/canary-analysis', eventBus: options.eventBus });

  // 注册 Skill Management API 路由 (M12)
  await app.register(skillRoutes, { prefix: '/skills', database: options.database });

  // 注册 AI Cost Optimization API 路由 (M36)
  await app.register(aiCostRoutes, { prefix: '/ai-cost' });

  // 注册 IaC Management API 路由 (M20)
  await app.register(iacRoutes, { prefix: '/iac', eventBus: options.eventBus });

  // 注册 ChatOps API 路由 (M35)
  await app.register(chatopsRoutes, { prefix: '/chatops', eventBus: options.eventBus });

  // 注册 Manual Confirmation API 路由 (P0-6)
  await app.register(confirmationRoutes, { prefix: '/confirmations' });

  // 注册 Artifact Registry API 路由
  await app.register(artifactRoutes, { prefix: '/artifacts' });

  // 注册 Vector Store API 路由 (P0 - AI semantic search)
  await app.register(vectorStoreRoutes, { prefix: '/vector-store' });

  // 注册 OnCall 排班 API 路由 (P0 - SRE scheduling)
  await app.register(oncallRoutes, { prefix: '/oncall' });

  // 注册审批 API 路由 (P0 - multi-level approval)
  await app.register(approvalRoutes, { prefix: '/approvals' });

  // 注册 EventBus API 路由 (P0 - NATS message bus)
  await app.register((app: FastifyInstance) => eventbusRoutes(app, options.eventBus), { prefix: '/eventbus' });

  // 注册 ProductLine 多分支产品线 API 路由 (M6)
  await app.register(productLineRoutes);

  // 注册 Internal Library 二方库管理 API 路由 (M30)
  await app.register(internalLibraryRoutes);

  // 注册 Notification API 路由 (M8/M33)
  await app.register(notificationRoutes, { prefix: '/notifications' });
}