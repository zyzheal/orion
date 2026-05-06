/**
 * API 路由注册 - Fastify 版本（不使用 fp 以支持 prefix）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { roleGuard } from '../middleware/roleGuard';
import { TenantIsolationService, createTenantValidatorMiddleware } from '../services/tenant';
import { RLSPolicyManager } from '../services/tenant/RLSPolicyManager';
import { tenantContext } from '../services/tenant/TenantContext';
import { PipelineController } from './controllers/PipelineController';
import { PipelineRunController } from './controllers/PipelineRunController';
import { StageController } from './controllers/StageController';
import { TaskController } from './controllers/TaskController';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRepository } from '../services/pipeline/PipelineRepository';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { PipelineRunRepository } from '../services/pipeline/PipelineRunRepository';
import { PipelineVersionService } from '../services/pipeline/PipelineVersionService';
import { PipelineBudgetService } from '../services/pipeline/PipelineBudgetService';
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
import testGenerationRoutes from './test-generation-routes';
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
import qualityGateRoutes from './quality-gate-routes';
import supplyChainRoutes from './supply-chain-routes';
import chaosEnhancedRoutes from './chaos-enhanced-routes';
import changeIntelligenceRoutes from './change-intelligence-routes';
import canaryAnalysisRoutes from './canary-analysis-routes';
import pluginMarketplaceRoutes from './plugin-marketplace-routes';
import canaryTrafficRoutes from './canary-traffic-routes';
import iacRoutes from './iac-routes';
import chatopsRoutes from './chatops-routes';
import skillRoutes from './skill-routes';
import aiCostRoutes from './ai-cost-routes';
import artifactRoutes from './artifact-routes';
import costOperationsRoutes from './cost-operations-routes';
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
import ephemeralEnvRoutes from './ephemeral-env-routes';
import mcpRoutes from './mcp-routes';
import { vectorRoutes } from './vector-routes';
import llmTraceRoutes from './llm-trace-routes';
import privacyRoutes from './privacy-routes';
import degradationRoutes from './degradation-routes';
import pipelineVersionRoutes from './pipeline-version-routes';
import pipelineBudgetRoutes from './pipeline-budget-routes';
import pipelineTemplateRoutes from './pipeline-template-routes';
import deployEnhancedRoutes from './deploy-enhanced-routes';
import developerPortalRoutes from './developer-portal-routes';
import autonomousPipelineRoutes from './autonomous-pipeline-routes';
import aiDecisionRoutes from './ai-decision-routes';
import observabilityRoutes from './observability-routes';
import crossDomainRoutes from './cross-domain-routes';
import configMgmtEnhancedRoutes from './config-mgmt-enhanced-routes';
import securityComplianceRoutes from './security-compliance-routes';
import multiModalTriggerRoutes from './multi-modal-trigger-routes';
import disasterRecoveryRoutes from './disaster-recovery-routes';
import disasterRecoveryAdvancedRoutes from './disaster-recovery-advanced-routes';
import performanceRoutes from './performance-routes';
import federationRoutes from './federation-routes';
import federationAdvancedRoutes from './federation-advanced-routes';
import multiCloudRoutes from './multi-cloud-routes';
import multiCloudAdvancedRoutes from './multi-cloud-advanced-routes';
import dataPipelineRoutes from './data-pipeline-routes';
import artifactOpsRoutes from './artifact-ops-routes';
import digitalTwinRoutes from './digital-twin-routes';
import apiGovernanceRoutes from './api-governance-routes';
import efficiencyEnhancedRoutes from './efficiency-enhanced-routes';
import communityRoutes from './community-routes';
import communityAdvancedRoutes from './community-advanced-routes';

export interface ApiRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
  /** Enable four-layer tenant isolation */
  enableTenantIsolation?: boolean;
}

// 角色常量 — 集中管理受保护路由所需的角色
const ADMIN_ROLES = ['admin', 'platform_admin'] as const;

/**
 * 初始化租户隔离服务
 */
function initializeTenantIsolation(database: DatabasePool | undefined): {
  isolationService: TenantIsolationService;
  rlsPolicyManager: RLSPolicyManager | null;
} {
  const isolationService = new TenantIsolationService();

  let rlsPolicyManager: RLSPolicyManager | null = null;
  if (database) {
    rlsPolicyManager = new RLSPolicyManager(database);
  }

  return { isolationService, rlsPolicyManager };
}

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
  // ==================== 租户隔离服务初始化 ====================
  // 初始化四层租户隔离服务 (P0 Task 6)
  const { isolationService, rlsPolicyManager } = initializeTenantIsolation(options.database);

  // 注册全局租户验证中间件
  if (options.enableTenantIsolation !== false) {
    // Layer 1: API层 - TenantValidatorMiddleware
    const tenantValidatorMiddleware = createTenantValidatorMiddleware(isolationService, {
      required: true,
      skipPaths: ['/healthz', '/readyz', '/version', '/api/v1/info', '/api/v1/public'],
    });

    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      return tenantValidatorMiddleware(request, reply, () => {});
    });

    // Layer 4: Database RLS - 设置 PostgreSQL session 变量
    if (options.database && rlsPolicyManager) {
      app.addHook('preHandler', async (request: FastifyRequest) => {
        const tenant = tenantContext.getCurrentTenant();
        if (tenant) {
          await rlsPolicyManager.setTenantSessionVariable(tenant.tenantId);
        }
      });

      // 清理 session 变量
      app.addHook('onResponse', async () => {
        await rlsPolicyManager.clearTenantSessionVariable();
        tenantContext.clearTenant();
      });
    }

    console.log('[Routes] Four-layer tenant isolation enabled');
  }

  // ==================== Pipeline 服务初始化 ====================
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

  // Phase 1 P0: Initialize version and budget services
  const versionService = options.database ? new PipelineVersionService(options.database) : null;
  const budgetService = options.database ? new PipelineBudgetService(options.database) : null;

  // 初始化控制器
  const pipelineController = new PipelineController(pipelineService);
  const pipelineRunController = new PipelineRunController(runService, engine, pipelineService, budgetService);
  const stageController = new StageController(runService, stageExecutor);
  const taskController = new TaskController(runService);

  // ==================== Pipeline 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // POST /api/v1/pipelines - 创建 Pipeline
    instance.post('/v1/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.create(request, reply);
    });

    // GET /api/v1/pipelines - 获取 Pipeline 列表
    instance.get('/v1/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.list(request, reply);
    });

    // GET /api/v1/pipelines/:id - 获取 Pipeline 详情
    instance.get('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.getById(request, reply);
    });

    // GET /api/v1/pipelines/:id/versions - 获取 Pipeline 所有版本
    instance.get('/v1/pipelines/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.getVersions(request, reply);
    });

    // PUT /api/v1/pipelines/:id - 更新 Pipeline
    instance.put('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.update(request, reply);
    });

    // DELETE /api/v1/pipelines/:id - 删除 Pipeline
    instance.delete('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.delete(request, reply);
    });

    // POST /api/v1/pipelines/validate - 验证 Pipeline YAML
    instance.post('/v1/pipelines/validate', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.validate(request, reply);
    });
  });

  // ==================== PipelineRun 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // POST /api/v1/pipelines/:id/runs - 触发 Pipeline 执行
    instance.post('/v1/pipelines/:id/runs', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.trigger(request, reply);
    });

    // GET /api/v1/pipeline-runs - 获取 PipelineRun 列表
    instance.get('/v1/pipeline-runs', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.list(request, reply);
    });

    // GET /api/v1/pipeline-runs/:id - 获取 PipelineRun 详情
    instance.get('/v1/pipeline-runs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.getById(request, reply);
    });

    // POST /api/v1/pipeline-runs/:id/cancel - 取消 PipelineRun
    instance.post('/v1/pipeline-runs/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.cancel(request, reply);
    });

    // GET /api/v1/pipeline-runs/:id/stages - 获取 PipelineRun 的 Stages
    instance.get('/v1/pipeline-runs/:id/stages', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.getStages(request, reply);
    });

    // GET /api/v1/pipeline-runs/:id/tasks - 获取 PipelineRun 的 Tasks
    instance.get('/v1/pipeline-runs/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.getTasks(request, reply);
    });
  });

  // ==================== Stage 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // GET /api/v1/stages/:id - 获取 Stage 详情
    instance.get('/v1/stages/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return stageController.getById(request, reply);
    });

    // GET /api/v1/stages/:id/tasks - 获取 Stage 下的 Tasks
    instance.get('/v1/stages/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
      return stageController.getTasks(request, reply);
    });

    // POST /api/v1/stages/:id/retry - 重试 Stage
    instance.post('/v1/stages/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
      return stageController.retry(request, reply);
    });
  });

  // ==================== Task 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // GET /api/v1/tasks/:id - 获取 Task 详情
    instance.get('/v1/tasks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return taskController.getById(request, reply);
    });

    // GET /api/v1/tasks/:id/log - 获取 Task 日志
    instance.get('/v1/tasks/:id/log', async (request: FastifyRequest, reply: FastifyReply) => {
      return taskController.getLog(request, reply);
    });

    // POST /api/v1/tasks/:id/retry - 重试 Task
    instance.post('/v1/tasks/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
      return taskController.retry(request, reply);
    });
  });

  // ==================== CMDB 路由 ====================

  // 注册 CMDB API 路由
  await registerWithRoleGuard(app, cmdbRoutes, '/v1/cmdb', { database: options.database });

  // ==================== 构建环境管理路由 ====================

  // 注册 Build Environment API 路由 (PostgreSQL backed for BuildCache)
  await registerWithRoleGuard(app, buildRoutes, '/v1/', { database: options.database });

  // 注册 Code Repository Integration API 路由
  await registerWithRoleGuard(app, codeRepoRoutes, '/v1/code-repo');

  // 注册 Configuration Management API 路由 (PostgreSQL backed)
  await registerWithRoleGuard(app, configRoutes, '/v1/config', { database: options.database });

  // 注册 FinOps 成本管理 API 路由
  await registerWithRoleGuard(app, costRoutes, '/v1/cost', { database: options.database });

  // 注册风险评估 API 路由
  await registerWithRoleGuard(app, riskRoutes, '/v1/risk');

  // 注册 FinOps 成本追踪与 ROI API 路由 (TASK-502) - PostgreSQL backed
  await registerWithRoleGuard(app, finopsV2Routes, '/v1/finops', { database: options.database });

  // 注册 AI Code Review API 路由 (TASK-302)
  await registerWithRoleGuard(app, aiReviewRoutes, '/v1/ai-review');

  // 注册诊断 Agent API 路由 (TASK-305) - PostgreSQL backed
  await registerWithRoleGuard(app, diagnosticRoutes, '/v1/diagnostic', { database: options.database });

  // 注册智能测试选择器 API 路由 (TASK-303)
  await registerWithRoleGuard(app, testSelectorRoutes, '/v1/test-selector');

  // 注册 AI 测试生成 API 路由 (AI Test Generation)
  await registerWithRoleGuard(app, testGenerationRoutes, '/v1/test');

  // 注册智能部署 API 路由 (TASK-701) - PostgreSQL backed + Phase 1 enhanced routes
  // Merged deployRoutes and deployEnhancedRoutes under single prefix to avoid route override
  await registerWithRoleGuard(app, async (app: FastifyInstance, options: any) => {
    await deployRoutes(app, options);
    await deployEnhancedRoutes(app, options);
  }, '/v1/deploy', { database: options.database });

  // 注册监控告警 API 路由 (TASK-703)
  await registerWithRoleGuard(app, monitoringRoutes, '/v1/monitoring', { database: options.database });

  // 注册智能工单 API 路由 (TASK-801) - PostgreSQL backed
  await registerWithRoleGuard(app, ticketingRoutes, '/v1/tickets', { database: options.database });

  // Register self-healing API routes (TASK-702) - PostgreSQL backed
  await registerWithRoleGuard(app, selfHealingRoutes, '/v1/self-healing', { database: options.database });

  // 注册备份恢复 API 路由 (TASK-704) - PostgreSQL backed
  await registerWithRoleGuard(app, backupRoutes, '/v1/backup', { database: options.database });

  // 注册 Plugin SPI API 路由 (TASK-104)
  await registerWithRoleGuard(app, pluginSpiRoutes, '/v1/plugins-spi');

  // 注册 Plugin Management API 路由
  await registerWithRoleGuard(app, pluginRoutes, '/v1/plugins');

  // 注册 AI 安全加固 API 路由 (TASK-1004) — P1-15 Fix: pass database for audit log persistence
  await registerWithRoleGuard(app, aiSecurityRoutes, '/v1/ai-security', { database: options.database });

  // 注册 AI 网关 API 路由
  await registerWithRoleGuard(app, aiGatewayRoutes, '/v1/ai-gateway');

  // 注册告警管理 API 路由
  await registerWithRoleGuard(app, alertRoutes, '/v1/alert');

  // 注册审计 API 路由
  await registerWithRoleGuard(app, auditRoutes, '/v1/audit', { database: options.database });

  // 注册租户管理 API 路由 (PostgreSQL backed)
  await registerWithRoleGuard(app, tenantRoutes, '/v1/tenant', { database: options.database });

  // 注册效能分析 API 路由 — P0-4 Fix: pass database for real DORA metrics
  await registerWithRoleGuard(app, efficiencyRoutes, '/v1/efficiency', { database: options.database });

  // 注册 SBOM Attestation API 路由 (P0) - migrated to PostgreSQL
  await registerWithRoleGuard(app, sbomRoutes, '/v1/sbom', { eventBus: options.eventBus, database: options.database });

  // 注册 OPA Policy Engine API 路由 (P0) - PostgreSQL backed
  await registerWithRoleGuard(app, policyRoutes, '/v1/policies', { database: options.database, eventBus: options.eventBus });

  // 注册 Quality Gate Trend API 路由 (Phase 1) - PostgreSQL backed
  await registerWithRoleGuard(app, qualityGateRoutes, '/v1/quality-gates', { database: options.database, eventBus: options.eventBus });

  // 注册 AI Change Intelligence API 路由 (P0)
  await registerWithRoleGuard(app, changeIntelligenceRoutes, '/v1/change-intelligence', { eventBus: options.eventBus });

  // 注册 ML Canary Analysis API 路由 (P0) - PostgreSQL backed
  await registerWithRoleGuard(app, canaryAnalysisRoutes, '/v1/canary-analysis', { eventBus: options.eventBus, database: options.database });

  // 注册 Plugin Marketplace API 路由 (Phase 3) - PostgreSQL backed
  await registerWithRoleGuard(app, pluginMarketplaceRoutes, '/v1/plugins/marketplace', { database: options.database });

  // 注册 Canary Traffic Management API 路由 (Phase 3) - PostgreSQL backed
  await registerWithRoleGuard(app, canaryTrafficRoutes, '/v1/canary/deployments', { database: options.database });

  // 注册 Skill Management API 路由 (M12)
  await registerWithRoleGuard(app, skillRoutes, '/v1/skills', { database: options.database });

  // 注册 AI Cost Optimization API 路由 (M36)
  await registerWithRoleGuard(app, aiCostRoutes, '/v1/ai-cost', { database: options.database });

  // 注册 IaC Management API 路由 (M20) - PostgreSQL backed
  await registerWithRoleGuard(app, iacRoutes, '/v1/iac', { eventBus: options.eventBus, database: options.database });

  // Register Ephemeral Dev Environments API routes (M31)
  await registerWithRoleGuard(app, ephemeralEnvRoutes, '/v1/ephemeral-envs', {
    
    eventBus: options.eventBus,
  });

  // 注册 ChatOps API 路由 (M35) - PostgreSQL backed
  await registerWithRoleGuard(app, chatopsRoutes, '/v1/chatops', {
    eventBus: options.eventBus,
    database: options.database,
    pipelineService,
  });

  // 注册 Manual Confirmation API 路由 (P0-6)
  await registerWithRoleGuard(app, confirmationRoutes, '/v1/confirmations', { database: options.database, eventBus: options.eventBus });

  // 注册 Artifact Registry API 路由
  await registerWithRoleGuard(app, artifactRoutes, '/v1/artifacts', { database: options.database });

  // 注册 Cost Operations API 路由 (Phase 2 - budget guards, anomaly detection, optimization)
  await registerWithRoleGuard(app, costOperationsRoutes, '/v1/cost-operations', { database: options.database });

  // 注册 Vector Store API 路由 (P0-G2 - pgvector backed) — admin only
  await registerWithRoleGuard(app, vectorStoreRoutes, '/v1/vector-store', { database: options.database });

  // 注册 OnCall 排班 API 路由 (P0 - SRE scheduling)
  await registerWithRoleGuard(app, oncallRoutes, '/v1/oncall', { database: options.database, eventBus: options.eventBus });

  // 注册审批 API 路由 (P0 - multi-level approval) — P0-7 Fix: requires database
  if (options.database) {
    await registerWithRoleGuard(app, approvalRoutes, '/v1/approvals', { database: options.database });
  }

  // 注册 Cron Scheduler API 路由 (P0-1 Fix: was missing)
  await registerWithRoleGuard(app, cronRoutes, '/v1/cron', { database: options.database });

  // 注册 EventBus API 路由 (M24 - PostgreSQL backed) — admin only
  await registerWithRoleGuard(app, eventbusRoutes, '/v1/eventbus', { database: options.database, eventBus: options.eventBus });

  // 注册 ProductLine 多分支产品线 API 路由 (M6) — P0-2 Fix: pass database
  await registerWithRoleGuard(app, productLineRoutes, '/v1/product-lines', { database: options.database });

  // 注册 Internal Library 二方库管理 API 路由 (M30)
  await registerWithRoleGuard(app, internalLibraryRoutes, '/v1/internal-libraries', { database: options.database });

  // 注册 Notification API 路由 (M8/M33)
  await registerWithRoleGuard(app, notificationRoutes, '/v1/notifications');

  // 注册 Role Management API 路由 (RBAC) - PostgreSQL backed
  await registerWithRoleGuard(app, roleRoutes, '/v1/roles', { database: options.database });

  // 注册 Session Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, sessionRoutes, '/v1/sessions', { database: options.database });

  // 注册 Webhook Management API 路由 (M1) - PostgreSQL backed
  await registerWithRoleGuard(app, webhookRoutes, '/v1/webhooks', { database: options.database });

  // 注册 Project Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, projectRoutes, '/v1/projects', { database: options.database });

  // 注册 Environment Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, environmentRoutes, '/v1/environments', { database: options.database });

  // 注册 Queue Management API 路由 (M24) - PostgreSQL backed
  await registerWithRoleGuard(app, queueRoutes, '/v1/queue', { database: options.database });

  // 注册 Knowledge Base API 路由 (M28) - PostgreSQL backed
  await registerWithRoleGuard(app, knowledgeRoutes, '/v1/knowledge', { database: options.database });

  // 注册 Metrics API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, metricsRoutes, '/v1/metrics', { database: options.database });

  // 注册 User Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, userRoutes, '/v1/users', { database: options.database });

  // 注册 Agent Orchestration API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, agentRoutes, '/v1/', { eventBus: options.eventBus, database: options.database });

  // 注册 API Key Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, apiKeyRoutes, '/v1/api-keys', { database: options.database });

  // 注册 MCP Server API 路由 - AI assistant integration
  await registerWithRoleGuard(app, mcpRoutes, '/v1/mcp', { database: options.database });

  // 注册 Vector Embedding & Semantic Search API 路由 (pgvector backed)
  await registerWithRoleGuard(app, vectorRoutes, '/v1/vector', { database: options.database });

  // 注册 LLM Trace API 路由 - LLM调用链追踪与成本分析
  await registerWithRoleGuard(app, llmTraceRoutes, '/v1/llm');

  // 注册 Privacy Policy API 路由 - 租户隐私策略管理
  await registerWithRoleGuard(app, privacyRoutes, '/v1/privacy');

  // 注册 Degradation Management API 路由 - AI Provider自动恢复
  await registerWithRoleGuard(app, degradationRoutes, '/v1/degradation');

  // ==================== Phase 1 P0 Routes ====================
  // Pipeline Version Control (version diff, rollback, tags, baseline)
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);
    await instance.register(pipelineVersionRoutes, {
      prefix: '/v1/pipelines',
      database: options.database,
    });
  });

  // Pipeline Execution Budget (config, estimate, monitoring)
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);
    await instance.register(pipelineBudgetRoutes, {
      prefix: '/v1/pipelines',
      database: options.database,
    });
  });

  // Pipeline Template Library (CRUD, instantiation)
  await registerWithRoleGuard(app, pipelineTemplateRoutes, '/v1/pipeline-templates', {
    database: options.database,
  });

  // Developer Portal (document management, search, categories)
  await registerWithRoleGuard(app, developerPortalRoutes, '/v1/developer-portal', {
    database: options.database,
  });

  // ==================== Phase 2: Autonomous Pipeline ====================
  // Error classification, adaptive timeout, auto-retry
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);
    await instance.register(autonomousPipelineRoutes, {
      prefix: '/v1/autonomous',
      database: options.database,
    });
  });

  // ==================== Phase 2: AI Decision Enhancement ====================
  // Decision explanation, model version management
  await registerWithRoleGuard(app, aiDecisionRoutes, '/v1');

  // ==================== Phase 2: Observability Enhancement ====================
  // Custom alert rules, RCA, silence rules
  await registerWithRoleGuard(app, observabilityRoutes, '/v1/observability', {
    database: options.database,
  });

  // ==================== Phase 3: Supply Chain Security ====================
  await registerWithRoleGuard(app, supplyChainRoutes, '/v1/supply-chain', {
    database: options.database,
  });

  // ==================== Phase 3: Chaos Engineering ====================
  await registerWithRoleGuard(app, chaosEnhancedRoutes, '/v1/chaos', {
    database: options.database,
  });

  // ==================== Phase 3: Cross-Domain Orchestration ====================
  await registerWithRoleGuard(app, crossDomainRoutes, '/v1/orchestration', {
    database: options.database,
  });

  // ==================== Phase 3: Config Management Enhancement ====================
  await registerWithRoleGuard(app, configMgmtEnhancedRoutes, '/v1/config-mgmt', {
    database: options.database,
  });

  // ==================== Phase 3: Security Compliance ====================
  // Compliance routes are registered under /v1 with compliance/ prefix
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);
    // Register compliance routes - the module handles /compliance/* paths
    await instance.register(securityComplianceRoutes, {
      prefix: '/v1',
      database: options.database,
    });
  });

  // ==================== Phase 3: Multi-Modal Trigger ====================
  await registerWithRoleGuard(app, multiModalTriggerRoutes, '/v1/triggers', {
    database: options.database,
  });

  // ==================== Community Ecosystem Services ====================
  await registerWithRoleGuard(app, communityRoutes, '/v1/community');

  // ==================== Community Ecosystem Advanced Services ====================
  await registerWithRoleGuard(app, communityAdvancedRoutes, '/v1/community-advanced');

  // ==================== Disaster Recovery ====================
  await registerWithRoleGuard(app, disasterRecoveryRoutes, '/v1/disaster-recovery', { database: options.database });

  // ==================== Disaster Recovery Advanced ====================
  await registerWithRoleGuard(app, disasterRecoveryAdvancedRoutes, '/v1/disaster-recovery/advanced', { database: options.database });

  // ==================== Performance Analysis ====================
  await registerWithRoleGuard(app, performanceRoutes, '/v1/performance');

  // ==================== Cluster Federation ====================
  await registerWithRoleGuard(app, federationRoutes, '/v1/federation');

  // ==================== Cluster Federation Advanced ====================
  await registerWithRoleGuard(app, federationAdvancedRoutes, '/v1/federation-advanced');

  // ==================== Multi-Cloud Management ====================
  await registerWithRoleGuard(app, multiCloudRoutes, '/v1/multi-cloud');

  // ==================== Multi-Cloud Advanced ====================
  await registerWithRoleGuard(app, multiCloudAdvancedRoutes, '/v1/multi-cloud-advanced');

  // ==================== Data Pipeline ====================
  await registerWithRoleGuard(app, dataPipelineRoutes, '/v1/data-pipelines');

  // ==================== Artifact Operations ====================
  await registerWithRoleGuard(app, artifactOpsRoutes, '/v1/artifact-ops');

  // ==================== Digital Twin ====================
  await registerWithRoleGuard(app, digitalTwinRoutes, '/v1/digital-twins');

  // ==================== API Governance ====================
  await registerWithRoleGuard(app, apiGovernanceRoutes, '/v1/api-governance');

  // ==================== Efficiency Enhanced ====================
  await registerWithRoleGuard(app, efficiencyEnhancedRoutes, '/v1/efficiency');
}