/**
 * API 路由注册 - Fastify 版本（不使用 fp 以支持 prefix）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EventEmitter } from 'events';
import jwtAuth, { JwtPayload } from '../middleware/jwtAuth';
const authenticateUser = jwtAuth;
import { requirePermission } from '../middleware/requirePermission';
import { authenticateUser as authUserLegacy, initAuthMiddleware } from '../middleware/authMiddleware';
import { TenantIsolationService, createTenantValidatorMiddleware } from '../services/tenant';
import { RLSPolicyManager } from '../services/tenant/RLSPolicyManager';
import { tenantContextStorage, SYSTEM_TENANT_ID } from '../db/tenant-context-storage';
import type { PoolClient } from 'pg';
import { EventBusService } from '../services/event-bus-service';
import { DatabasePool } from '../services/database';
import { RedisCache } from '../services/redis-cache';
import { CacheService } from '../services/cache/CacheService';
import configRoutes from './config-routes';
import { PluginManagerService } from '../services/plugin-manager-service';
import auditRoutes from './audit-routes';
import tenantRoutes from './tenant-routes';
import iacRoutes from './iac-routes';
import chatopsRoutes from './chatops-routes';
import skillRoutes from './skill-routes';
import sessionRoutes from './session-routes';
import confirmationRoutes from './confirmation-routes';

// New P0 routes
import vectorStoreRoutes from './vector-store-routes';
import unifiedConfigRoutes from './unified-config-routes';
import eventbusRoutes from './eventbus-routes';
import { productLineRoutes } from './product-line-routes';
import { internalLibraryRoutes } from './internal-library-routes';
import notificationRoutes from './notification-routes';
import webhookRoutes from './webhook-routes';
import roleRoutes from './role-routes';
import knowledgeRoutes from './knowledge-routes';
import subappRoutes from './subapp-routes';
import metricsRoutes from './metrics-routes';
import userRoutes from './user-routes';
import userProfileRoutes from './user-profile-routes';
import userActivityRoutes from './user-activity-routes';
import userTokenRoutes from './user-token-routes';
import userStatusRoutes from './user-status-routes';
import environmentRoutes from './environment-routes';
import projectRoutes from './project-routes';
import apiKeyRoutes from './api-key-routes';
import ephemeralEnvRoutes from './ephemeral-env-routes';
import mcpRoutes from './mcp-routes';
import { vectorRoutes } from './vector-routes';
import llmTraceRoutes, { initLLMTrace } from './llm-trace-routes';
import privacyRoutes from './privacy-routes';
import degradationRoutes from './degradation-routes';
import crossDomainRoutes from './cross-domain-routes';
import workflowRoutes from './workflow-routes';
import workflowTriggerRoutes from './workflow-trigger-routes';
import workflowWebhookRoutes from './workflow-webhook-routes';
import workflowTaskRoutes from './workflow-task-routes';
import eventRegistryRoutes from './event-trigger-registry-routes';
import taskTimeoutRoutes from './task-timeout-routes';
import workflowDependencyRoutes from './workflow-dependency-routes';
import cacheCleanupRoutes from './cache-cleanup-routes';
import configMgmtEnhancedRoutes from './config-mgmt-enhanced-routes';
import securityComplianceRoutes from './security-compliance-routes';
import disasterRecoveryRoutes from './disaster-recovery-routes';
import selfHealingRoutes from './self-healing-routes';
import multiModalTriggerRoutes from './multi-modal-trigger-routes';import digitalTwinRoutes from './digital-twin-routes';
import apiGovernanceRoutes from './api-governance-routes';import communityRoutes from './community-routes';
import communityAdvancedRoutes from './community-advanced-routes';
import moduleRoutes from './module-routes';
import scriptRoutes from './script-routes';
import scriptLibraryRoutes from './script-library-routes';
import { registerApprovalRoutes } from './approval-routes';
import artifactRoutes from './artifact-routes';
import artifactVersionRoutes from './artifact-version-routes';
import artifactOpsRoutes from './artifact-ops-routes';
import permissionAuditRoutes from './permission-audit-routes';
import abacPolicyRoutes, { registerSystemPolicyId } from './abac-policy-routes';
import projectMemberRoutes from './project-member-routes';
import uebaRoutes from './ueba-routes';
import { escalationScheduler } from '../services/escalation/EscalationScheduler';
import { registerSecretRoutes } from './secret-routes';
import { registerApkUploadHistoryRoutes } from './apk-upload-history-routes';
import branchPolicyRoutes from './branch-policy-routes';
import codeRepoRoutes from './code-repo-routes';
import workbenchRoutes from './workbench-routes';
import inceptionRoutes from './inception-routes';
import biDashboardRoutes from './bi-dashboard-routes';
import { PipelineBudgetService } from '../services/PipelineBudgetService';
import { PipelineBudgetRepository } from '../repositories/PipelineBudgetRepository';
import { registerBudgetRoutes } from './pipeline-budget-routes';
import capabilityRoutes from './capability-routes';
import { registerAIAgentRoutes } from './ai-agent-routes';
import apiMarketRoutes from './api-market-routes';
import serviceCatalogRoutes from './service-catalog-routes';
import changeRoutes from './change-routes';
import changeRequestRoutes from './change-request-routes';
import slaRoutes from './sla-routes';
import handlerRegistryRoutes from './handler-registry-routes';
import pipelineBatchRoutes from './pipeline-batch-routes';
import pipelineExecutionControlRoutes from './pipeline-execution-control-routes';
import processStepRoutes from './process-step-routes';
import sloRoutes from './slo-routes';
import tracingRoutes from './tracing-routes';
import ticketKnowledgeRoutes from './ticket-knowledge-routes';
import i18nRoutes from './i18n-routes';
import runbookRoutes from './runbook-routes';
import versionArchiveRoutes from './version-archive-routes';
import complianceRoutes from './compliance-routes';
import notificationPolicyRoutes from './notification-policy-routes';
import alertBreakerRoutes from './alert-breaker-routes';
import eventTriggerRoutes from './event-trigger-routes';
import reportDesignerRoutes from './report-designer-routes';
import costAllocationRoutes from './cost-allocation-routes';
import sprintRoutes from './sprint-routes';
import ciTypeRoutes from './ci-type-routes';

// AI Module Routes — AI Gateway, Cost, Review, Security
import aiGatewayRoutes from './ai-gateway-routes';
import aiCostRoutes from './ai-cost-routes';
import aiReviewRoutes from './ai-review-routes';
import aiSecurityRoutes from './ai-security-routes';

// New module routes — BuildEnv, Observability, Backup, OnCall, SBOM
import buildEnvRoutes from './build-env-routes';
import observabilityRoutes from './observability-routes';
import backupRoutes from './backup-routes';
import oncallRoutes from './oncall-routes';
import sbomRoutes from './sbom-routes';
import incidentRoutes from './incident-routes';

// Phase 3.5: Previously orphan routes — Alert, Cache, Circuit Breaker, Maintenance, Message Queue, Team
import alertRoutes from './alert-routes';
import cacheRoutes from './cache-routes';
import circuitBreakerRoutes from './circuit-breaker-routes';
import messageQueueRoutes from './message-queue-routes';
import teamRoutes from './team-routes';

// Previously orphan routes now being registered — Phase 3.5: register ticketing, CMDB, monitoring
import ticketingRoutes from './ticketing-routes';
import cmdbRoutes from './cmdb-routes';
import visorExecRoutes from './visor-exec-routes';
import terminalAuditRoutes from './terminal-audit-routes';
import monitoringRoutes from './monitoring-routes';
import dbaRoutes from './dba-routes';
import billingRoutes from './billing-routes';
import problemRoutes from './problem-routes';

// Previously orphan routes now being registered
import authEnhancedRoutes from './auth-enhanced-routes';
import authRoutes from './routes-auth';
import ssoProvidersRoutes from './sso-providers-routes';
import ssoUnifiedRoutes from './sso-unified-routes';
import autonomousPipelineRoutes from './autonomous-pipeline-routes';
import canaryAnalysisRoutes from './canary-analysis-routes';
import canaryTrafficRoutes from './canary-traffic-routes';
import chaosEnhancedRoutes from './chaos-enhanced-routes';
import cronRoutes from './cron-routes';
import dataPipelineRoutes from './data-pipeline-routes';
import dataQualityRoutes from './data-quality-routes';
import dataLineageRoutes from './data-lineage-routes';
import vectorizeRulesRoutes from './vectorize-rules-routes';
import decisionExplanationRoutes from './decision-explanation-routes';
import { registerDependencyCoordinationRoutes } from './dependency-coordination-routes';
import developerPortalRoutes from './developer-portal-routes';
import diagnosticRoutes from './diagnostic-routes';
import escalationRoutes from './escalation-routes';
import hookChainRoutes from './hook-chain-routes';
import performanceRoutes from './performance-routes';
import { registerPipelineGraphRoutes } from './pipeline-graph-routes';
import { registerPipelineRoutes } from './pipeline-routes-registrar';
import pipelineSSERoutes from './pipeline-sse-routes';
import pipelineErrorDetailRoutes from './pipeline-error-detail-routes';
import pipelineTemplateRoutes from './pipeline-template-routes';
import pipelineVersionRoutes from './pipeline-version-routes';
import { PipelineController } from './controllers/PipelineController';
import { PipelineRunController } from './controllers/PipelineRunController';
import { StageController } from './controllers/StageController';
import { TaskController } from './controllers/TaskController';
import { SCMWebhookService } from '../services/pipeline/SCMWebhookService';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { PipelineRunRepository } from '../services/pipeline/PipelineRunRepository';
import { PipelineEngine } from '../engine/PipelineEngine';
import { StageExecutor } from '../engine/StageExecutor';
import { TaskRunner } from '../engine/TaskRunner';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import featureFlagRoutes from './feature-flag-routes';
import pluginHotReloadRoutes from './plugin-hotreload-routes';
import pluginRoutes from './plugin-routes';
import policyRoutes from './policy-routes';
import queueRoutes from './queue-routes';
import supplyChainRoutes from './supply-chain-routes';
import testGenerationRoutes from './test-generation-routes';
import testSelectorRoutes from './test-selector-routes';
import deployRoutes from './deploy-routes';
import changeIntelligenceRoutes from './change-intelligence-routes';
import apmRoutes from './apm-routes';
import hrWebhookRoutes from './hrWebhookRoutes';
import aiDecisionRoutes from './ai-decision-routes';

// P1 new route modules — Integration, Efficiency, Chaos
import integrationRoutes from './integration-routes';
import efficiencyRoutes from './efficiency-routes';
import chaosRoutes from './chaos-routes';

// Dual Engine Routes (AST + LLM)
import { dualEngineRoutes } from './dual-engine-routes';

// Services needed for route registration
import { DependencyCoordinationService } from '../services/pipeline/DependencyCoordinationService';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRepository } from '../services/pipeline/PipelineRepository';
import { PipelineLogSSEService } from '../services/pipeline/PipelineLogSSEService';
import { PluginLifecycleManager } from '../services/plugin-spi/PluginLifecycleManager';
import { PluginRegistry } from '../services/plugin-spi/PluginRegistry';

import pino from 'pino';
import { ModuleManager } from '../services/module-lifecycle/ModuleManager';
import { OrionError, ErrorCode } from '../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const DEFAULT_MODULE_CONFIG = {
  core: {
    auth: { enabled: true },
    tenant: { enabled: true },
    database: { enabled: true },
    eventBus: { enabled: true },
    audit: { enabled: true },
    config: { enabled: true },
    degradation: { enabled: true },
    privacy: { enabled: true },
  },
  domains: {    build: { enabled: true, autoStart: true },
    deploy: { enabled: true, autoStart: true },
    monitoring: { enabled: true, autoStart: true },
    alert: { enabled: true, autoStart: true },
    security: { enabled: true, autoStart: true },
    ai: { enabled: true, autoStart: true },
    finops: { enabled: true, autoStart: true },
    chaos: { enabled: true, autoStart: true },
    backup: { enabled: true, autoStart: true },
    disasterRecovery: { enabled: true, autoStart: true },
    selfHealing: { enabled: true, autoStart: true },
    ticketing: { enabled: true, autoStart: true },
    knowledge: { enabled: true, autoStart: true },
    plugin: { enabled: true, autoStart: true },
    chatops: { enabled: true, autoStart: true },
    digitalTwin: { enabled: true, autoStart: true },
    federation: { enabled: true, autoStart: true },
    multiCloud: { enabled: true, autoStart: true },
    community: { enabled: true, autoStart: true },
    efficiency: { enabled: true, autoStart: true },
    cmdb: { enabled: true, autoStart: true },
    iac: { enabled: true, autoStart: true },
  },
  services: {    consistency: { enabled: false },
    deploymentWindow: { enabled: true },
    outputValidation: { enabled: false },
    costTracking: { enabled: true },
    riskEngine: { enabled: true },
    modelVersion: { enabled: false },
    agentRun: { enabled: false },
    agentProfile: { enabled: false },
    cmdbIntegration: { enabled: false },
  },
  features: {},
};

export interface ApiRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
  redis?: RedisCache;
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
  _requiredRoles: readonly string[] = ADMIN_ROLES
): Promise<void> {
  // 已迁移到 registerWithPermission：各路由内部使用 requirePermission 进行细粒度权限控制
  return registerWithPermission(app, routeModule, prefix, routeOptions);
}

/**
 * 使用 requirePermission 的模块级注册（细粒度权限控制）
 * @param routeModule - 路由模块函数
 * @param prefix - 路由前缀
 * @param routeOptions - 传递给路由模块的选项
 * @param resourceType - 资源类型（如 'user', 'pipeline'）
 * @param defaultAction - 默认操作（如 'read', 'write'）
 */
async function registerWithPermission(
  app: FastifyInstance,
  routeModule: (instance: FastifyInstance, opts?: any) => Promise<void>,
  prefix: string,
  routeOptions?: Record<string, unknown>,
  resourceType?: string,
  defaultAction?: string
): Promise<void> {
  await app.register(async (instance: FastifyInstance) => {
    // Skip auth in development for easier testing
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      instance.addHook('onRequest', authenticateUser);
    }
    // 具体的 requirePermission 在各路由内部添加
    await instance.register(routeModule, { prefix, ...routeOptions });
  });
}

export default async function apiRoutes(app: FastifyInstance, options: ApiRoutesOptions): Promise<void> {
  // ==================== SSE Service Initialization (shared with pipeline engine) ====================
  const pipelineLogSSE = new PipelineLogSSEService(new EventEmitter(), options.database);

  // ==================== LLM Trace Service Initialization ====================
  initLLMTrace(options.database);

  // ==================== 租户隔离服务初始化 ====================
  // 初始化四层租户隔离服务 (P0 Task 6)
  const { isolationService, rlsPolicyManager } = initializeTenantIsolation(options.database);

  // 注册全局租户验证中间件
  if (options.enableTenantIsolation !== false) {
    // Layer 1: API层 - TenantValidatorMiddleware
    const tenantValidatorMiddleware = createTenantValidatorMiddleware(isolationService, {
      required: true,
      skipPaths: ['/healthz', '/readyz', '/version', '/api/v1/info', '/api/v1/public', '/metrics'],
    });

    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      return tenantValidatorMiddleware(request, reply, () => {});
    });

    // Layer 4: Database RLS — 请求级连接 + AsyncLocalStorage
    // 替代原有的 pool.query() 方式，确保每个请求使用专用连接，
    // RLS session variable 在同一连接上设置和查询。
    if (options.database && rlsPolicyManager) {
      app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantCtx = (request as any).tenantContext;
        if (!tenantCtx) return;
        const tenant = tenantCtx.getCurrentTenant();
        if (!tenant) return;

        // 从连接池获取专用连接
        const client = await options.database!.getConnection();

        try {
          // 在该连接上设置 RLS session variable（SET SESSION 级别）
          await client.query(
            "SELECT set_config('app.current_tenant_id', $1, false), set_config('app.tenant_isolation', $2, false)",
            [String(tenant.tenantId), 'true']
          );

          // 将 client 挂载到 request 上，供 ALS enterWith 使用
          (request as any).dbClient = client;

          // 进入 ALS 上下文，后续所有 async 调用（包括 handler、service、repository）
          // 的 DatabasePool.query() 都会自动使用此 client
          tenantContextStorage.enterWith({
            dbClient: client,
            tenantId: tenant.tenantId,
            traceId: (request as any).traceId || '',
            spanId: (request as any).spanId || '',
          });
        } catch (error) {
          // set_config 失败 → 拒绝请求（安全失败模式）
          try {
            client.release();
          } catch {}
          reply.code(403).send({ error: 'Tenant isolation setup failed' });
          throw new OrionError('Failed to set tenant context', ErrorCode.OPERATION_FAILED);
        }
      });

      // 成功响应时清理连接
      app.addHook('onResponse', async (request: FastifyRequest) => {
        const client = (request as any).dbClient as PoolClient | undefined;
        if (client) {
          try {
            // 先 ROLLBACK（幂等，无活跃事务时无影响），确保连接不在 aborted 状态
            await client.query('ROLLBACK').catch(() => {});
            // 清除 session 变量
            await client.query(
              "SELECT set_config('app.current_tenant_id', $1, false), set_config('app.tenant_isolation', $2, false)",
              ['', 'false']
            );
          } finally {
            client.release();
          }
        }
      });

      // 错误时兜底释放连接（防止客户端断开导致连接泄漏）
      app.addHook('onError', async (request: FastifyRequest) => {
        const client = (request as any).dbClient as PoolClient | undefined;
        if (client) {
          try {
            await client.query('ROLLBACK').catch(() => {});
            client.release();
          } catch {}
        }
      });

      // 客户端断开时释放连接
      app.addHook('onTimeout', async (request: FastifyRequest) => {
        const client = (request as any).dbClient as PoolClient | undefined;
        if (client) {
          try {
            client.release();
          } catch {}
        }
      });
    }

    logger.info('[Routes] Four-layer tenant isolation enabled');
  }

  // ==================== ModuleManager 初始化 ====================
  const moduleManager = new ModuleManager(() => {
    const configSvc = (options as any).config || (global as any).unifiedConfigService;
    if (configSvc?.get) {
      return configSvc.get('moduleConfig') || DEFAULT_MODULE_CONFIG;
    }
    return DEFAULT_MODULE_CONFIG;
  }, options.database);
  await moduleManager.loadFromConfig();
  (options as any).moduleManager = moduleManager;

  // CMDB 路由已在下方统一注册（Phase 3.5）

  // 注册 Build Environment API 路由 (PostgreSQL backed for BuildCache)
  // Code Repository 路由已迁移到 orion-code-svc (port 3010)
  // Branch Policy API (PostgreSQL backed)
  await app.register(branchPolicyRoutes, {
    prefix: '/code-repo/branch-policies',
    database: options.database,
  });

  // Code Repo API (adapters, repos, branches, PRs, code-owners, webhooks)
  await app.register(codeRepoRoutes, { prefix: '/code-repo' });

  // 注册 Configuration Management API 路由 (PostgreSQL backed)
  await registerWithRoleGuard(app, configRoutes, '/config', { database: options.database, redis: options.redis });

  // FinOps 成本管理路由已迁移到 orion-finops-svc (port 3009)

  // Risk 路由已迁移到 orion-security-svc (port 3013)

  // FinOps V2 路由已迁移到 orion-finops-svc (port 3009)

  // 注册 AI Code Review API 路由 (TASK-302)
  // 注册诊断 Agent API 路由 (TASK-305) - PostgreSQL backed
  // 注册智能测试选择器 API 路由 (TASK-303)
  // 注册 AI 测试生成 API 路由 (AI Test Generation)
  // Deploy routes migrated to orion-deploy-svc (port 3003)

  // 注册监控告警 API 路由 (TASK-703)
  await registerWithRoleGuard(app, monitoringRoutes, '/monitoring', { database: options.database });
  // 注册智能工单 API 路由 (TASK-801)
  await registerWithRoleGuard(app, ticketingRoutes, '/ticketing', { database: options.database });
  // 注册 CMDB API 路由
  await registerWithRoleGuard(app, cmdbRoutes, '/cmdb', { database: options.database });
  // 注册 Visor Exec API 路由 (批量命令执行、脚本模板、定时任务、文件上传)
  await registerWithRoleGuard(app, visorExecRoutes, '/visor/exec');
  // 注册终端审计日志 API 路由 (连接日志 + 文件传输日志)
  await registerWithRoleGuard(app, terminalAuditRoutes, '/cmdb/terminal-audit', { database: options.database });
  // 注册 DBA API 路由 (Phase 4 - Database DevOps)
  await registerWithRoleGuard(app, dbaRoutes, '/dba', { database: options.database });
  // 注册 Billing API 路由 (Phase 4 - Quota & Billing)
  await registerWithRoleGuard(app, billingRoutes, '/billing', { database: options.database });
  // Register self-healing API routes (TASK-702) - PostgreSQL backed
  await registerWithRoleGuard(app, selfHealingRoutes, '/self-healing', { database: options.database });
  // 注册 Problem Management API 路由 (ITIL Problem Management) - PostgreSQL backed
  await registerWithRoleGuard(app, problemRoutes, '/problems', { database: options.database });
  // 注册备份恢复 API 路由 (TASK-704) - PostgreSQL backed
  // 注册 Plugin SPI API 路由 (TASK-104)// 注册 Plugin Enhanced API 路由 (Phase 1, shared instance)// 注册 AI 安全加固 API 路由 (TASK-1004) — P1-15 Fix: pass database for audit log persistence
  // 注册 AI 网关 API 路由
  // 注册告警管理 API 路由
  // 注册审计 API 路由
  await registerWithRoleGuard(app, auditRoutes, '/audit', { database: options.database });

  // 注册租户管理 API 路由 (PostgreSQL backed)
  await registerWithRoleGuard(app, tenantRoutes, '/tenant', { database: options.database });

  // 注册效能分析 API 路由 — P0-4 Fix: pass database for real DORA metrics// 注册 SBOM Attestation API 路由 (P0) - migrated to PostgreSQL// 注册 OPA Policy Engine API 路由 (P0) - PostgreSQL backed// 注册 Quality Gate Trend API 路由 (Phase 1) - PostgreSQL backed// 注册 AI Change Intelligence API 路由 (P0)
  // 注册 ML Canary Analysis API 路由 (P0) - PostgreSQL backed
  // 注册 Plugin Marketplace API 路由 (Phase 3) - PostgreSQL backed// 注册 Canary Traffic Management API 路由 (Phase 3) - PostgreSQL backed
  // 注册 Skill Management API 路由 (M12)
  await registerWithRoleGuard(app, skillRoutes, '/skills', { database: options.database });

  // 注册 AI Cost Optimization API 路由 (M36)
  // 注册 IaC Management API 路由 (M20) - PostgreSQL backed
  await registerWithRoleGuard(app, iacRoutes, '/iac', { eventBus: options.eventBus, database: options.database });

  // Register Ephemeral Dev Environments API routes (M31)
  await registerWithRoleGuard(app, ephemeralEnvRoutes, '/ephemeral-envs', {
    eventBus: options.eventBus,
    database: options.database,
  });

  // 注册 ChatOps API 路由 (M35) - PostgreSQL backed
  await registerWithRoleGuard(app, chatopsRoutes, '/chatops', {
    eventBus: options.eventBus,
    database: options.database,
  });

  // 注册 Manual Confirmation API 路由 (P0-6)
  await registerWithRoleGuard(app, confirmationRoutes, '/confirmations', { database: options.database, eventBus: options.eventBus });

  // 注册 Artifact Registry API 路由 (M29)
  await registerWithRoleGuard(app, artifactRoutes, '/artifacts', { database: options.database });

  // 注册 Artifact Version API 路由
  await registerWithRoleGuard(app, artifactVersionRoutes, '/artifact-versions', { database: options.database });

  // 注册 Artifact Ops API 路由 — 操作追踪、扫描、保留策略
  await registerWithRoleGuard(app, artifactOpsRoutes, '/artifact-ops', { database: options.database });

  // Permission Audit Routes (P2)
  await registerWithRoleGuard(app, permissionAuditRoutes, '/permission-audit', { database: options.database });

  // ABAC Policy Routes (P2)
  // 注册系统策略白名单（不可被删除/修改）
  const { abacPolicyEngine } = require('../services/authz/AbacPolicyEngine');
  abacPolicyEngine.getSystemPolicyIds().forEach((id: string) => registerSystemPolicyId(id));

  await registerWithRoleGuard(app, abacPolicyRoutes, '/abac-policies', { database: options.database });

  // Project Member Routes (P2)
  await registerWithRoleGuard(app, projectMemberRoutes, '/project-members', { database: options.database });

  // UEBA Routes (P2)
  await registerWithRoleGuard(app, uebaRoutes, '/ueba', { database: options.database });

  // Phase 4: Additional module routes (dynamic imports to avoid circular deps)
  const finOpsRoutes = await import('./finops-routes').then(m => m.default);
  const finOpsV2Routes = await import('./finops-v2-routes').then(m => m.default);
  const mlopsRoutes = await import('./mlops-routes').then(m => m.default);
  const metadataRoutes = await import('./metadata-routes').then(m => m.default);
  const inspectionRoutes = await import('./inspection-routes').then(m => m.default);
  const capacityRoutes = await import('./capacity-routes').then(m => m.default);
  const middlewareOpsRoutes = await import('./middleware-ops-routes').then(m => m.default);
  const serverlessRoutes = await import('./serverless-routes').then(m => m.default);
  const multiCloudRoutes = await import('./multi-cloud-routes').then(m => m.default);
  await registerWithRoleGuard(app, finOpsRoutes, '/cost-operations', { database: options.database });
  await registerWithRoleGuard(app, finOpsV2Routes, '/finops', { database: options.database });
  await registerWithRoleGuard(app, mlopsRoutes, '/mlops', { database: options.database });
  await registerWithRoleGuard(app, metadataRoutes, '/metadata', { database: options.database });
  await registerWithRoleGuard(app, dataQualityRoutes, '/data-quality', { database: options.database });
  await registerWithRoleGuard(app, dataLineageRoutes, '/data-lineage', { database: options.database });
  await registerWithRoleGuard(app, vectorizeRulesRoutes, '/vectorize-rules', { database: options.database });
  await registerWithRoleGuard(app, vectorStoreRoutes, '/vector-store', { database: options.database });
  await registerWithRoleGuard(app, inspectionRoutes, '/inspection', { database: options.database });
  await registerWithRoleGuard(app, capacityRoutes, '/capacity', { database: options.database });
  await registerWithRoleGuard(app, middlewareOpsRoutes, '/middleware', { database: options.database });
  await registerWithRoleGuard(app, serverlessRoutes, '/serverless', { database: options.database });
  await registerWithRoleGuard(app, multiCloudRoutes, '/multi-cloud', { database: options.database });

  // 注册统一配置中心 API (使用 /v1/system-config 前缀)
  await registerWithRoleGuard(app, unifiedConfigRoutes, '/system-config', { database: options.database });// 注册 OnCall 排班 API 路由 (P0 - SRE scheduling)
  // 注册 Escalation 统一升级 API 路由 (自动升级 + 手动升级)
  // 启动自动升级调度器
  // 使用系统租户模式绕过 RLS
  if (options.database && options.eventBus) {
    try {
      tenantContextStorage.run(
        { dbClient: null as unknown as PoolClient, tenantId: SYSTEM_TENANT_ID as unknown as number, isSystemTenant: true },
        async () => {
          await escalationScheduler.start();
          logger.info('[routes] Escalation scheduler started');
        }
      );
    } catch (error) {
      logger.warn('[routes] Failed to start escalation scheduler:', error);
    }
  }

  // 注册审批 API 路由 (P0 - multi-level approval)
  await registerApprovalRoutes(app, { database: options.database });

  // 注册 Cron Scheduler API 路由 (P0-1 Fix: was missing)
  // 注册 EventBus API 路由 (M24 - PostgreSQL backed) — admin only
  await registerWithRoleGuard(app, eventbusRoutes, '/eventbus', { database: options.database, eventBus: options.eventBus });

  // 注册 ProductLine 多分支产品线 API 路由 (M6) — P0-2 Fix: pass database
  await registerWithRoleGuard(app, productLineRoutes, '/product-lines', { database: options.database });

  // 注册 Internal Library 二方库管理 API 路由 (M30)
  await registerWithRoleGuard(app, internalLibraryRoutes, '/internal-libraries', { database: options.database });

  // 注册 Notification API 路由 (M8/M33) — 传入 eventBus 用于多通道投递事件
  await registerWithRoleGuard(app, notificationRoutes, '/notifications', { eventBus: options.eventBus, database: options.database });

  // 注册 Workbench API 路由 — 个人聚合工作台后端 (auth guarded)
  await registerWithRoleGuard(app, workbenchRoutes, '/workbench', { database: options.database });

  // 注册 Inception SQL Audit 路由
  await app.register(inceptionRoutes, { prefix: '/inception' });

  // 注册 BI Dashboard API 路由 — Executive/Manager/Engineer 仪表盘 (auth guarded)
  await registerWithRoleGuard(app, biDashboardRoutes, '', { database: options.database });

  // 注册 Role Management API 路由 (RBAC) - PostgreSQL backed
  await registerWithRoleGuard(app, roleRoutes, '/roles', { database: options.database });

  // 注册 Session Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, sessionRoutes, '/sessions', { database: options.database });

  // 注册 Webhook Management API 路由 (M1) - PostgreSQL backed
  await registerWithRoleGuard(app, webhookRoutes, '/webhooks', { database: options.database });

  // 注册 Project Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, projectRoutes, '/projects', { database: options.database });

  // 注册 Environment Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, environmentRoutes, '/environments', { database: options.database });

  // 注册 Queue Management API 路由 (M24) - PostgreSQL backed
  // 注册 Knowledge Base API 路由 (M28) - PostgreSQL backed
  await registerWithRoleGuard(app, knowledgeRoutes, '/knowledge', { database: options.database });

  // 注册 SubApp Management API 路由 - Page-based sub-app configuration
  await registerWithRoleGuard(app, subappRoutes, '/subapps', { database: options.database });

  // 注册 LLM Trace API 路由 - PostgreSQL backed with cost tracking
  await registerWithRoleGuard(app, llmTraceRoutes, '/llm', { database: options.database });

  // 注册 Metrics API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, metricsRoutes, '/metrics', { database: options.database });

  // 注册 User Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, userRoutes, '/users', { database: options.database, redis: options.redis });

  // 注册 User Profile API 路由 - 用户档案管理（所有权验证）
  await registerWithRoleGuard(app, userProfileRoutes, '/users', { database: options.database });

  // 注册 User Activity API 路由 - 用户操作日志（所有权验证）
  await registerWithRoleGuard(app, userActivityRoutes, '/users', { database: options.database });

  // 注册 User Token API 路由 - API Token 管理（所有权验证）
  await registerWithRoleGuard(app, userTokenRoutes, '/users', { database: options.database });

  // 注册 User Status Management API 路由 - 用户在职/离职状态管理
  await registerWithRoleGuard(app, userStatusRoutes, '/api/v1', {
    database: options.database,
    tokenBlacklist: null, // TokenBlacklistService initialized later
  });

  // 注册 Agent Orchestration API 路由 - PostgreSQL backed
  // 注册 API Key Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, apiKeyRoutes, '/api-keys', { database: options.database });

  // 注册 MCP Server API 路由 - AI assistant integration
  await registerWithRoleGuard(app, mcpRoutes, '/mcp', { database: options.database, redis: options.redis });

  // 注册 Vector Embedding & Semantic Search API 路由 (pgvector backed)// 注册 LLM Trace API 路由 - LLM调用链追踪与成本分析

  // 注册 Privacy Policy API 路由 - 租户隐私策略管理
  await registerWithRoleGuard(app, privacyRoutes, '/privacy', { database: options.database });

  await registerWithRoleGuard(app, disasterRecoveryRoutes, '/disaster-recovery', {
    database: options.database,
  });

  // 注册 Degradation Management API 路由 - AI Provider自动恢复

  // ==================== Phase 2: AI Decision Enhancement ====================
  // Decision explanation, model version management
  // ==================== Phase 2: Observability Enhancement ====================
  // Custom alert rules, RCA, silence rules - migrated to monitor-svc

  // ==================== Phase 3: Supply Chain Security ====================// ==================== Phase 3: Chaos Engineering ====================

  // ==================== Phase 3: Cross-Domain Orchestration ====================
  await registerWithRoleGuard(app, crossDomainRoutes, '/orchestration', {
    database: options.database,
  });

  // ==================== Workflow Routes (GAP Implementation) ====================
  await registerWithRoleGuard(app, workflowRoutes, '/workflows', {
    database: options.database,
  });

  // ==================== Workflow Trigger Routes ====================
  await registerWithRoleGuard(app, workflowTriggerRoutes, '/workflow-triggers', {
    database: options.database,
  });

  // ==================== Workflow Webhook Routes (no auth) ====================
  await app.register(workflowWebhookRoutes, { prefix: '/api/v1/webhooks', database: options.database });

  // ==================== Workflow Task Routes ====================
  await registerWithRoleGuard(app, workflowTaskRoutes, '/workflow-tasks', {
    database: options.database,
  });

  // ==================== Event Trigger Registry Routes ====================
  await registerWithRoleGuard(app, eventRegistryRoutes, '/event-registry', {
    database: options.database,
  });

  // ==================== Task Timeout Routes ====================
  await registerWithRoleGuard(app, taskTimeoutRoutes, '/task-timeouts', {
    database: options.database,
  });

  // ==================== Workflow Dependency Analysis Routes ====================
  await registerWithRoleGuard(app, workflowDependencyRoutes, '/workflow-dependencies', {});

  // ==================== Cache Cleanup Routes ====================
  await registerWithRoleGuard(app, cacheCleanupRoutes, '/cache-cleanup', {});

  // ==================== Phase 3: Config Management Enhancement ====================
  await registerWithRoleGuard(app, configMgmtEnhancedRoutes, '/config-mgmt', {
    database: options.database,
  });

  // ==================== Phase 3: Security Compliance ====================
  // Compliance routes are registered under /v1 with compliance/ prefix
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);
    // Register compliance routes - the module handles /compliance/* paths
    await instance.register(securityComplianceRoutes, {
      prefix: '/',
      database: options.database,
    });
  });

  // ==================== Phase 3: Multi-Modal Trigger ====================
  await registerWithRoleGuard(app, multiModalTriggerRoutes, '/triggers', {
    database: options.database,
  });

  // ==================== Community Ecosystem Services ====================
  if (await moduleManager.isModuleEnabled('domain:community')) {
    await registerWithRoleGuard(app, communityRoutes, '/community');
  } else {
    logger.info('[routes] Community module disabled, skipping route registration');
  }

  // ==================== Community Ecosystem Advanced Services ====================
  await registerWithRoleGuard(app, communityAdvancedRoutes, '/community-advanced');

  // Federation/MultiCloud/DisasterRecovery routes migrated to dr-svc and federation-svc

  // ==================== Performance Analysis ====================
  // ==================== Cluster Federation ====================
  // Federation routes migrated to federation-svc

  // ==================== Cluster Federation Advanced ====================
  // Federation Advanced routes migrated to federation-svc

  // ==================== Multi-Cloud Management ====================
  // Multi-Cloud routes migrated to federation-svc

  // Multi-Cloud Advanced routes migrated to federation-svc


  // ==================== Artifact Operations ====================

  // ==================== Digital Twin ====================
  await registerWithRoleGuard(app, digitalTwinRoutes, '/digital-twins', { database: options.database });

  // ==================== API Governance ====================
  await registerWithRoleGuard(app, apiGovernanceRoutes, '/api-governance');

  // Efficiency Enhanced routes migrated to efficiency-svc

  // ==================== Module Management ====================
  await registerWithRoleGuard(app, moduleRoutes, '/system/modules', { moduleManager: (options as any).moduleManager });

  // ==================== Inline Script ====================
  await registerWithRoleGuard(app, scriptRoutes, '/scripts', { database: options.database });

  // ==================== Script Library ====================
  await registerWithRoleGuard(app, scriptLibraryRoutes, '/script-library', { database: options.database });

  // ==================== Secret Management ====================
  await registerSecretRoutes(app, { database: options.database });

  // ==================== APK Upload History ====================
  await registerApkUploadHistoryRoutes(app, { database: options.database });

  // ==================== Pipeline Budget Management ====================
  if (options.database) {
    const pipelineBudgetRepo = new PipelineBudgetRepository(options.database);
    const pipelineBudgetService = new PipelineBudgetService(pipelineBudgetRepo);
    registerBudgetRoutes(app, pipelineBudgetService);
  }

  // ==================== Runner Management ====================
  // Runner Agent 注册、心跳、Job 回报（Runner Agent 通信无需 JWT）
  // Test Report 路由已迁移到 orion-code-svc (port 3010)

  // ==================== Previously Orphan Routes (Now Registered) ====================

  // Phase 3.8: Initialize centralized JWT key manager
  const { jwtKeyManager } = await import('../services/auth/JwtKeyManager');
  await jwtKeyManager.initialize(options.database || null);

  // Auth Enhanced - JWT Key Rotation & Token Blacklist
  // Basic Auth Routes - login, logout, register, refresh, me
  const tokenBlacklistService = options.database
    ? new (await import('../services/auth/TokenBlacklistService')).TokenBlacklistService(options.database)
    : null;
  await tokenBlacklistService?.connect();

  // Phase 3.8.1: Initialize auth middleware with centralized services
  initAuthMiddleware(tokenBlacklistService);

  await app.register(authRoutes, { prefix: '/api/v1/auth', database: options.database, tokenBlacklist: tokenBlacklistService, eventBus: options.eventBus });

  // Enhanced Auth Routes - JWT key rotation & token blacklist
  await registerWithRoleGuard(app, authEnhancedRoutes, '/auth', {
    database: options.database,
  });

  // SSO Providers Management - CRUD for authentication providers
  await registerWithRoleGuard(app, ssoProvidersRoutes, '/auth/sso', {
    database: options.database,
  });

  // SSO Unified Routes - login, callback, LDAP, WeChat Work, OIDC
  await (app as any).register(ssoUnifiedRoutes, {
    prefix: '/api/v1/auth/sso',
    database: options.database || null,
    redis: options.redis,
    tokenBlacklist: tokenBlacklistService,
  });

  // Legacy SSO Routes (backward compatibility)
  await (await import('./sso-routes')).registerSsoRoutes(app, {
    database: options.database,
    redis: options.redis,
  });

  // Autonomous Pipeline - Error classification, adaptive timeout, auto-retry
  await registerWithRoleGuard(app, autonomousPipelineRoutes, '/autonomous', {
    database: options.database,
  });

  // ML Canary Analysis
  await registerWithRoleGuard(app, canaryAnalysisRoutes, '/canary-analysis', {
    database: options.database,
    eventBus: options.eventBus,
  });

  // Canary Traffic Management
  await registerWithRoleGuard(app, canaryTrafficRoutes, '/canary/deployments', {
    database: options.database,
  });

  // Chaos Engineering - experiment management, fault injection, resilience scoring
  await registerWithRoleGuard(app, chaosEnhancedRoutes, '/chaos', {
    database: options.database,
  });

  // APM - Distributed tracing, database profiling, performance monitoring
  await registerWithRoleGuard(app, apmRoutes, '/apm', {
    database: options.database,
  });

  // HR Webhook - Employee lifecycle events from HR system (signature-verified, no auth required)
  await (app as any).register(hrWebhookRoutes, {
    prefix: '/api/v1/webhooks/hr',
    database: options.database,
    tokenBlacklist: tokenBlacklistService,
  });

  // Cron Scheduler
  await registerWithRoleGuard(app, cronRoutes, '/cron', {
    database: options.database,
  });

  // Data Pipeline - data pipeline management and lineage
  await registerWithRoleGuard(app, dataPipelineRoutes, '/data-pipelines');

  // Decision Explanation - SHAP decision explanations and quality feedback
  await registerWithRoleGuard(app, decisionExplanationRoutes, '/decisions', {
    database: options.database,
  });

  // Dependency Coordination - requires DependencyCoordinationService
  if (options.database) {
    const dependencyCoordinationService = new DependencyCoordinationService(options.database);
    await registerDependencyCoordinationRoutes(app, { dependencyCoordinationService });
  }

  // Developer Portal
  await registerWithRoleGuard(app, developerPortalRoutes, '/developer-portal', {
    database: options.database,
  });

  // Diagnostic Agent
  await registerWithRoleGuard(app, diagnosticRoutes, '/diagnostic', {
    database: options.database,
  });

  // Escalation - unified escalation management
  // Note: escalationScheduler is already started above
  await registerWithRoleGuard(app, escalationRoutes, '/escalation', {
    database: options.database,
    eventBus: options.eventBus,
  });

  // Hook Chain - hook chain orchestration
  await registerWithRoleGuard(app, hookChainRoutes, '/hook-chains');

  // Performance Analysis
  await registerWithRoleGuard(app, performanceRoutes, '/performance', {
    database: options.database,
  });

  // ==================== Pipeline CRUD Routes ====================
  // NOTE: Full pipeline execution routes require PipelineEngine + StageExecutor + TaskRunner
  // which have deep dependency chains. Registering basic CRUD + placeholder for now.
  if (options.database) {
    const pipelineRepo = new PipelineRepository(options.database);
    const pipelineCache = new CacheService(options.redis || null, 60);
    const pipelineService = new PipelineService(pipelineRepo, pipelineCache);
    const pipelineController = new PipelineController(pipelineService);

    await app.register(async (instance) => {
      instance.addHook('onRequest', authenticateUser);

      // POST /api/v1/pipelines - Create Pipeline
      instance.post('/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineController.create(request, reply);
      });

      // GET /api/v1/pipelines - List Pipelines
      instance.get('/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineController.list(request, reply);
      });

      // GET /api/v1/pipelines/:id - Get Pipeline by ID
      instance.get('/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineController.getById(request, reply);
      });

      // GET /api/v1/pipelines/:id/versions - Get Pipeline versions
      instance.get('/pipelines/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineController.getVersions(request, reply);
      });

      // PUT /api/v1/pipelines/:id - Update Pipeline
      instance.put('/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineController.update(request, reply);
      });

      // DELETE /api/v1/pipelines/:id - Delete Pipeline
      instance.delete('/pipelines/:id', {
        onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'delete' })]
      }, async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineController.delete(request, reply);
      });
    });

    // Register PipelineRun, Stage, Task routes (Pipeline routes already registered inline above)
    const pipelineEventPublisher = new PipelineEventPublisher();
    const pipelineRunRepo = new PipelineRunRepository(options.database);
    const pipelineRunService = new PipelineRunService(pipelineEventPublisher, pipelineRunRepo);

    const taskRunner = new TaskRunner();
    const stageExecutor = new StageExecutor(taskRunner, pipelineEventPublisher);

    const pipelineEngine = new PipelineEngine(
      pipelineService,
      pipelineRunService,
      pipelineEventPublisher,
      stageExecutor
    );

    const pipelineRunController = new PipelineRunController(pipelineRunService, pipelineEngine, pipelineService);
    const stageController = new StageController(pipelineRunService, stageExecutor);
    const taskController = new TaskController(pipelineRunService);
    const scmWebhookService = new SCMWebhookService(pipelineEngine);

    // ==================== PipelineRun routes ====================
    await app.register(async (instance: FastifyInstance) => {
      instance.addHook('onRequest', authenticateUser);

      // POST /api/v1/pipelines/:id/runs - Trigger Pipeline execution
      instance.post('/pipelines/:id/runs', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineRunController.trigger(request, reply);
      });

      // GET /api/v1/pipeline-runs - Get PipelineRun list
      instance.get('/pipeline-runs', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineRunController.list(request, reply);
      });

      // GET /api/v1/pipeline-runs/:id - Get PipelineRun detail
      instance.get('/pipeline-runs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineRunController.getById(request, reply);
      });

      // POST /api/v1/pipeline-runs/:id/cancel - Cancel PipelineRun
      instance.post('/pipeline-runs/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineRunController.cancel(request, reply);
      });

      // POST /api/v1/pipeline-runs/:id/retry - Retry PipelineRun
      instance.post('/pipeline-runs/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineRunController.retry(request, reply);
      });

      // GET /api/v1/pipeline-runs/:id/stages - Get stages for a run
      instance.get('/pipeline-runs/:id/stages', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineRunController.getStages(request, reply);
      });

      // GET /api/v1/pipeline-runs/:id/tasks - Get tasks for a run
      instance.get('/pipeline-runs/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
        return pipelineRunController.getTasks(request, reply);
      });
    });

    // ==================== Stage routes ====================
    await app.register(async (instance: FastifyInstance) => {
      instance.addHook('onRequest', authenticateUser);

      // GET /api/v1/stages/:id - Get Stage detail
      instance.get('/stages/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        return stageController.getById(request, reply);
      });

      // GET /api/v1/stages/:id/tasks - Get Tasks for a Stage
      instance.get('/stages/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
        return stageController.getTasks(request, reply);
      });

      // POST /api/v1/stages/:id/retry - Retry Stage
      instance.post('/stages/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
        return stageController.retry(request, reply);
      });
    });

    // ==================== Task routes ====================
    await app.register(async (instance: FastifyInstance) => {
      instance.addHook('onRequest', authenticateUser);

      // GET /api/v1/tasks/:id - Get Task detail
      instance.get('/tasks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        return taskController.getById(request, reply);
      });

      // GET /api/v1/tasks/:id/log - Get Task log
      instance.get('/tasks/:id/log', async (request: FastifyRequest, reply: FastifyReply) => {
        return taskController.getLog(request, reply);
      });

      // POST /api/v1/tasks/:id/retry - Retry Task
      instance.post('/tasks/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
        return taskController.retry(request, reply);
      });
    });

    // ==================== SCM Webhook routes (public - signature validated) ====================
    await app.register(async (instance: FastifyInstance) => {
      // POST /api/v1/webhooks/scm - Receive SCM webhook events
      instance.post('/webhooks/scm', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const body = request.body as any;
          const headers = request.headers as Record<string, string | undefined>;

          const githubSignature = headers['x-hub-signature-256'];
          const gitlabToken = headers['x-gitlab-token'];
          const githubEvent = headers['x-github-event'];
          const gitlabEvent = headers['x-gitlab-event'];

          let event;

          if (githubEvent === 'pull_request') {
            event = await scmWebhookService.handleGitHubPullRequest(body, githubSignature);
          } else if (githubSignature || githubEvent) {
            event = await scmWebhookService.handleGitHubPush(body, githubSignature);
          } else if (gitlabEvent === 'Merge Request Hook' || gitlabEvent === 'merge_request') {
            event = await scmWebhookService.handleGitLabMergeRequest(body, gitlabToken);
          } else if (gitlabToken) {
            event = await scmWebhookService.handleGitLabPush(body, gitlabToken);
          } else {
            event = await scmWebhookService.handleGitHubPush(body);
          }

          await reply.status(200).send({
            received: true,
            eventId: event.id,
            provider: event.provider,
            eventType: event.eventType,
            matchedPipelines: event.matchedPipelines,
          });
        } catch (error: any) {
          await reply.status(401).send({
            error: 'WEBHOOK_VALIDATION_FAILED',
            message: error.message,
          });
        }
      });

      // GET /api/v1/webhooks/scm/events - Get webhook event history (auth protected)
      instance.addHook('onRequest', authenticateUser);

      instance.get('/webhooks/scm/events', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as any;
        const limit = query.limit ? parseInt(query.limit, 10) : 20;
        const events = scmWebhookService.getEvents(limit);

        await reply.send({
          data: events.map(e => ({
            id: e.id,
            provider: e.provider,
            eventType: e.eventType,
            repository: e.repository,
            branch: e.branch,
            commitSha: e.commitSha,
            pusher: e.pusher,
            timestamp: e.timestamp,
            matchedPipelines: e.matchedPipelines,
          })),
          total: events.length,
        });
      });
    });
  }

  // Pipeline Graph - YAML/JSON conversion and validation
  if (options.database) {
    const pipelineRepository = new PipelineRepository(options.database);
    const pipelineCache = new CacheService(options.redis || null, 60);
    const pipelineService = new PipelineService(pipelineRepository, pipelineCache);
    await registerPipelineGraphRoutes(app, { pipelineService });
  }

  // Pipeline SSE - real-time log streaming
  await app.register(pipelineSSERoutes, { prefix: '/', pipelineLogSSE });

  // Pipeline Error Detail - structured error classification for failed runs
  await registerWithRoleGuard(app, pipelineErrorDetailRoutes, '/pipelines', {
    database: options.database,
  });

  // Pipeline Templates
  await registerWithRoleGuard(app, pipelineTemplateRoutes, '/pipeline-templates', {
    database: options.database,
    redis: options.redis,
  });

  // Pipeline Versions
  await registerWithRoleGuard(app, pipelineVersionRoutes, '/pipelines/versions', {
    database: options.database,
    redis: options.redis,
  });

  // Plugin Hot Reload
  if (options.database) {
    const pluginRegistry = new PluginRegistry();
    const pluginLifecycleManager = new PluginLifecycleManager(pluginRegistry);
    await registerWithRoleGuard(app, pluginHotReloadRoutes, '/plugins/hotreload', {
      lifecycleManager: pluginLifecycleManager,
      registry: pluginRegistry,
    });
  }

  // Plugin Management (enhanced plugin system)
  await registerWithRoleGuard(app, pluginRoutes, '/plugins', {
    database: options.database,
    pluginManager: (options as any).moduleManager,
  });

  // Queue Management
  await registerWithRoleGuard(app, queueRoutes, '/queue', {
    database: options.database,
  });

  // Supply Chain Security - SBOM, dependency analysis, artifact signing
  await registerWithRoleGuard(app, supplyChainRoutes, '/supply-chain', {
    database: options.database,
  });

  // OPA Policy Engine - policy definitions, evaluations, violations, exemptions
  await registerWithRoleGuard(app, policyRoutes, '/policies', {
    database: options.database,
  });

  // Test Generation - AI test case generation
  await registerWithRoleGuard(app, testGenerationRoutes, '/test-generation');

  // Test Selector - smart test selection
  await registerWithRoleGuard(app, testSelectorRoutes, '/test-selector', { database: options.database });

  // Smart Deploy - deployment execution, history, metrics
  await registerWithRoleGuard(app, deployRoutes, '/deploy', { database: options.database });

  // Change Intelligence - AI-powered blast radius analysis
  await registerWithRoleGuard(app, changeIntelligenceRoutes, '/change-intelligence', { database: options.database });

  // ==================== Capability Management ====================
  await registerWithRoleGuard(app, capabilityRoutes, '/capabilities', { database: options.database });

  // ==================== API Marketplace ====================
  await registerWithRoleGuard(app, apiMarketRoutes, '/market', { database: options.database });

  // ==================== AI Agent Framework ====================
  registerAIAgentRoutes(app);

  // ==================== AI Decision Explanation ====================
  await app.register(aiDecisionRoutes, { prefix: '/api/v1/ai-decisions', database: options.database });

  // ==================== AI Gateway ====================
  await registerWithRoleGuard(app, aiGatewayRoutes, '/ai/gateway', { database: options.database });

  // ==================== AI Cost Optimization ====================
  await registerWithRoleGuard(app, aiCostRoutes, '/ai/cost', { database: options.database });

  // ==================== AI Code Review ====================
  await registerWithRoleGuard(app, aiReviewRoutes, '/ai/review');

  // ==================== AI Security ====================
  await registerWithRoleGuard(app, aiSecurityRoutes, '/ai/security', { database: options.database });

  // ==================== Build Environment ====================
  await registerWithRoleGuard(app, buildEnvRoutes, '/build-env', { database: options.database });

  // ==================== Feature Flags ====================
  await registerWithRoleGuard(app, featureFlagRoutes, '/feature-flags', { database: options.database });

  // ==================== Observability ====================
  await registerWithRoleGuard(app, observabilityRoutes, '/observability', { database: options.database });

  // ==================== Backup & Recovery ====================
  await registerWithRoleGuard(app, backupRoutes, '/backup', { database: options.database });

  // ==================== OnCall Scheduling ====================
  await registerWithRoleGuard(app, oncallRoutes, '/oncall', { database: options.database });

  // ==================== SBOM (Software Bill of Materials) ====================
  await registerWithRoleGuard(app, sbomRoutes, '/sbom', { database: options.database });

  // ==================== Phase 3: Alert Management ====================
  // Phase 3.5 Fix: Register alert routes — previously orphan
  // NOTE: Alert routes are in-memory only; no DB dependency
  await registerWithRoleGuard(app, alertRoutes, '/alert', { database: options.database });

  // ==================== Degradation Management ====================
  await registerWithRoleGuard(app, degradationRoutes, '/degradation', { database: options.database });

  // ==================== Incident Management (ITIL-aligned) ====================
  // Full lifecycle, timeline, post-mortem/RCA, priority matrix, MTTR stats
  await registerWithRoleGuard(app, incidentRoutes, '/incidents', { database: options.database });

  // ==================== Phase 3: Cache Management ====================
  // Phase 3.5 Fix: Register cache routes — previously orphan
  const { CacheStrategyService } = await import('../services/cache/CacheStrategyService');
  const cacheStrategyService = options.redis ? new CacheStrategyService(options.redis) : null;
  await registerWithRoleGuard(app, cacheRoutes, '/cache', { cacheService: cacheStrategyService });

  // ==================== Phase 3: Circuit Breaker ====================
  // Phase 3.5 Fix: Register circuit breaker routes — previously orphan
  const { initCircuitBreakerService } = await import('../services/circuit-breaker');
  const circuitBreakerServiceInstance = await initCircuitBreakerService(options.database);
  await registerWithRoleGuard(app, circuitBreakerRoutes, '/circuit-breakers', { circuitBreakerService: circuitBreakerServiceInstance });

  // ==================== Phase 3: Maintenance Window ====================
  // Phase 3.5 Fix: Register maintenance window routes — previously orphan
  if (options.database) {
    const { registerMaintenanceWindowRoutes } = await import('./maintenance-window-routes');
    await app.register(async (instance) => {
      instance.addHook('onRequest', authenticateUser);
      await registerMaintenanceWindowRoutes(instance, { database: options.database });
    });
  }

  // ==================== Phase 3: Message Queue ====================
  // Phase 3.5 Fix: Register message queue routes — previously orphan
  const { MessageQueueService } = await import('../services/message-queue/message-queue-service');
  const messageQueueServiceInstance = new MessageQueueService();
  await registerWithRoleGuard(app, messageQueueRoutes, '/message-queue', { messageQueueService: messageQueueServiceInstance });

  // ==================== Team Management ====================
  // Phase 3.5 Fix: Register team routes — previously orphan
  await registerWithRoleGuard(app, teamRoutes, '/teams', { database: options.database });

  // ==================== Integration ====================
  await registerWithRoleGuard(app, integrationRoutes, '/integration', { database: options.database });

  // ==================== Efficiency / DORA Metrics ====================
  await registerWithRoleGuard(app, efficiencyRoutes, '/efficiency', { database: options.database });

  // ==================== Chaos Engineering ====================
  await registerWithRoleGuard(app, chaosRoutes, '/chaos', { database: options.database });

  // ==================== Dual Engine (AST + LLM) ====================
  await registerWithRoleGuard(app, dualEngineRoutes, '/dual-engine', { database: options.database });

  // ==================== Service Catalog (ITIL) ====================
  await registerWithRoleGuard(app, serviceCatalogRoutes, '/catalog', { database: options.database });

  // ==================== SLA Management (ITSM Phase B) ====================
  await registerWithRoleGuard(app, slaRoutes, '/sla', { database: options.database });

  // ==================== Change Management (ITSM Phase C) ====================
  await registerWithRoleGuard(app, changeRoutes, '/changes', { database: options.database });

  // ==================== Handler Registry SPI ====================
  await registerWithRoleGuard(app, handlerRegistryRoutes, '/handlers', { database: options.database });

  // ==================== Pipeline Batch Execution ====================
  await registerWithRoleGuard(app, pipelineBatchRoutes, '/pipeline-batch', { database: options.database });

  // ==================== Pipeline Execution Control ====================
  await registerWithRoleGuard(app, pipelineExecutionControlRoutes, '/pipeline-execution-control', { database: options.database });

  // ==================== Process Step Engine ====================
  await registerWithRoleGuard(app, processStepRoutes, '/process-steps', { database: options.database });

  // ==================== SLO/SLI Tracking ====================
  await registerWithRoleGuard(app, sloRoutes, '/slo', { database: options.database });

  // ==================== Distributed Tracing ====================
  await registerWithRoleGuard(app, tracingRoutes, '/tracing', { database: options.database });

  // ==================== Ticket Knowledge Mapping ====================
  await registerWithRoleGuard(app, ticketKnowledgeRoutes, '/ticket-knowledge', { database: options.database });

  // ==================== i18n Internationalization ====================
  await registerWithRoleGuard(app, i18nRoutes, '/i18n', { database: options.database });

  // ==================== Runbook Automation ====================
  await registerWithRoleGuard(app, runbookRoutes, '/runbooks', { database: options.database });

  // ==================== Version Archives ====================
  await registerWithRoleGuard(app, versionArchiveRoutes, '/version-archives', { database: options.database });

  // ==================== Compliance Reports ====================
  await registerWithRoleGuard(app, complianceRoutes, '/compliance', { database: options.database });

  // ==================== Report Designer ====================
  await registerWithRoleGuard(app, reportDesignerRoutes, '/reports', { database: options.database });

  // ==================== Notification Policies ====================
  await registerWithRoleGuard(app, notificationPolicyRoutes, '/notification-policies', { database: options.database });

  // ==================== Alert Breaker Rules ====================
  await registerWithRoleGuard(app, alertBreakerRoutes, '/alert-breakers', { database: options.database });

  // ==================== Event Trigger Rules ====================
  await registerWithRoleGuard(app, eventTriggerRoutes, '/event-triggers', { database: options.database });

  // ==================== Change Request RFC Approval ====================
  await registerWithRoleGuard(app, changeRequestRoutes, '/change-requests', { database: options.database });

  // ==================== Cost Allocation ====================
  await registerWithRoleGuard(app, costAllocationRoutes, '/cost-allocation', { database: options.database });

  // ==================== Sprint Board ====================
  await registerWithRoleGuard(app, sprintRoutes, '/sprints', { database: options.database });

  // ==================== CI Type Designer ====================
  await registerWithRoleGuard(app, ciTypeRoutes, '/ci-types', { database: options.database });
}