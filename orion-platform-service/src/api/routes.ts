/**
 * API 路由注册 - Fastify 版本（不使用 fp 以支持 prefix）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EventEmitter } from 'events';
import { authenticateUser } from '../middleware/authMiddleware';
import { roleGuard } from '../middleware/roleGuard';
import { TenantIsolationService, createTenantValidatorMiddleware } from '../services/tenant';
import { RLSPolicyManager } from '../services/tenant/RLSPolicyManager';
import { tenantContextStorage, SYSTEM_TENANT_ID } from '../db/tenant-context-storage';
import type { PoolClient } from 'pg';
import { EventBusService } from '../services/event-bus-service';
import { DatabasePool } from '../services/database';
import cmdbRoutes from '../routes-cmdb';
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
import metricsRoutes from './metrics-routes';
import userRoutes from './user-routes';
import environmentRoutes from './environment-routes';
import projectRoutes from './project-routes';
import apiKeyRoutes from './api-key-routes';
import ephemeralEnvRoutes from './ephemeral-env-routes';
import mcpRoutes from './mcp-routes';
import { vectorRoutes } from './vector-routes';
import llmTraceRoutes from './llm-trace-routes';
import privacyRoutes from './privacy-routes';
import degradationRoutes from './degradation-routes';
import crossDomainRoutes from './cross-domain-routes';
import workflowRoutes from './workflow-routes';
import configMgmtEnhancedRoutes from './config-mgmt-enhanced-routes';
import securityComplianceRoutes from './security-compliance-routes';
import disasterRecoveryRoutes from './disaster-recovery-routes';
import multiModalTriggerRoutes from './multi-modal-trigger-routes';import digitalTwinRoutes from './digital-twin-routes';
import apiGovernanceRoutes from './api-governance-routes';import communityRoutes from './community-routes';
import communityAdvancedRoutes from './community-advanced-routes';
import moduleRoutes from './module-routes';
import scriptRoutes from './script-routes';
import { registerApprovalRoutes } from './approval-routes';
import { escalationScheduler } from '../services/escalation/EscalationScheduler';
import { registerSecretRoutes } from './secret-routes';
import { registerApkUploadHistoryRoutes } from './apk-upload-history-routes';
import branchPolicyRoutes from './branch-policy-routes';
import { PipelineBudgetService } from '../services/PipelineBudgetService';
import { PipelineBudgetRepository } from '../repositories/PipelineBudgetRepository';
import { registerBudgetRoutes } from './pipeline-budget-routes';

// Previously orphan routes now being registered
import authEnhancedRoutes from './auth-enhanced-routes';
import autonomousPipelineRoutes from './autonomous-pipeline-routes';
import canaryAnalysisRoutes from './canary-analysis-routes';
import canaryTrafficRoutes from './canary-traffic-routes';
import cronRoutes from './cron-routes';
import { registerDependencyCoordinationRoutes } from './dependency-coordination-routes';
import developerPortalRoutes from './developer-portal-routes';
import diagnosticRoutes from './diagnostic-routes';
import escalationRoutes from './escalation-routes';
import hookChainRoutes from './hook-chain-routes';
import performanceRoutes from './performance-routes';
import { registerPipelineGraphRoutes } from './pipeline-graph-routes';
import pipelineSSERoutes from './pipeline-sse-routes';
import pipelineTemplateRoutes from './pipeline-template-routes';
import pipelineVersionRoutes from './pipeline-version-routes';
import pluginHotReloadRoutes from './plugin-hotreload-routes';
import pluginRoutes from './plugin-routes';
import queueRoutes from './queue-routes';
import testGenerationRoutes from './test-generation-routes';
import testSelectorRoutes from './test-selector-routes';

// Services needed for route registration
import { DependencyCoordinationService } from '../services/pipeline/DependencyCoordinationService';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRepository } from '../services/pipeline/PipelineRepository';
import { PipelineLogSSEService } from '../services/pipeline/PipelineLogSSEService';
import { PluginLifecycleManager } from '../services/plugin-spi/PluginLifecycleManager';
import { PluginRegistry } from '../services/plugin-spi/PluginRegistry';

import pino from 'pino';
import { ModuleManager } from '../services/module-lifecycle/ModuleManager';

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
  // ==================== SSE Service Initialization (shared with pipeline engine) ====================
  const pipelineLogSSE = new PipelineLogSSEService(new EventEmitter());

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
          });
        } catch (error) {
          // set_config 失败 → 拒绝请求（安全失败模式）
          try {
            client.release();
          } catch {}
          reply.code(403).send({ error: 'Tenant isolation setup failed' });
          throw new Error('Failed to set tenant context');
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

    console.log('[Routes] Four-layer tenant isolation enabled');
  }

  // ==================== ModuleManager 初始化 ====================
  const moduleManager = new ModuleManager(() => {
    const configSvc = (options as any).config || (global as any).unifiedConfigService;
    if (configSvc?.get) {
      return configSvc.get('moduleConfig') || DEFAULT_MODULE_CONFIG;
    }
    return DEFAULT_MODULE_CONFIG;
  });
  moduleManager.loadFromConfig();
  (options as any).moduleManager = moduleManager;

  // ==================== CMDB 路由 ====================

  // 注册 CMDB API 路由
  await registerWithRoleGuard(app, cmdbRoutes, '/v1/cmdb', { database: options.database });

  // 注册 Build Environment API 路由 (PostgreSQL backed for BuildCache)
  // Code Repository 路由已迁移到 orion-code-svc (port 3010)

  // 注册 Branch Policy API 路由 (PostgreSQL backed)
  await app.register(branchPolicyRoutes, {
    prefix: '/v1/code-repo/branch-policies',
    database: options.database,
  });

  // 注册 Configuration Management API 路由 (PostgreSQL backed)
  await registerWithRoleGuard(app, configRoutes, '/v1/config', { database: options.database });

  // FinOps 成本管理路由已迁移到 orion-finops-svc (port 3009)

  // Risk 路由已迁移到 orion-security-svc (port 3013)

  // FinOps V2 路由已迁移到 orion-finops-svc (port 3009)

  // 注册 AI Code Review API 路由 (TASK-302)
  // 注册诊断 Agent API 路由 (TASK-305) - PostgreSQL backed
  // 注册智能测试选择器 API 路由 (TASK-303)
  // 注册 AI 测试生成 API 路由 (AI Test Generation)
  // Deploy routes migrated to orion-deploy-svc (port 3003)

  // 注册监控告警 API 路由 (TASK-703) - migrated to orion-monitor-svc (port 3005)
  // 注册智能工单 API 路由 (TASK-801) - migrated to orion-ticket-svc (port 3004)
  // Register self-healing API routes (TASK-702) - PostgreSQL backed
  // 注册备份恢复 API 路由 (TASK-704) - PostgreSQL backed
  // 注册 Plugin SPI API 路由 (TASK-104)// 注册 Plugin Enhanced API 路由 (Phase 1, shared instance)// 注册 AI 安全加固 API 路由 (TASK-1004) — P1-15 Fix: pass database for audit log persistence
  // 注册 AI 网关 API 路由
  // 注册告警管理 API 路由
  // 注册审计 API 路由
  await registerWithRoleGuard(app, auditRoutes, '/v1/audit', { database: options.database });

  // 注册租户管理 API 路由 (PostgreSQL backed)
  await registerWithRoleGuard(app, tenantRoutes, '/v1/tenant', { database: options.database });

  // 注册效能分析 API 路由 — P0-4 Fix: pass database for real DORA metrics// 注册 SBOM Attestation API 路由 (P0) - migrated to PostgreSQL// 注册 OPA Policy Engine API 路由 (P0) - PostgreSQL backed// 注册 Quality Gate Trend API 路由 (Phase 1) - PostgreSQL backed// 注册 AI Change Intelligence API 路由 (P0)
  // 注册 ML Canary Analysis API 路由 (P0) - PostgreSQL backed
  // 注册 Plugin Marketplace API 路由 (Phase 3) - PostgreSQL backed// 注册 Canary Traffic Management API 路由 (Phase 3) - PostgreSQL backed
  // 注册 Skill Management API 路由 (M12)
  await registerWithRoleGuard(app, skillRoutes, '/v1/skills', { database: options.database });

  // 注册 AI Cost Optimization API 路由 (M36)
  // 注册 IaC Management API 路由 (M20) - PostgreSQL backed
  await registerWithRoleGuard(app, iacRoutes, '/v1/iac', { eventBus: options.eventBus, database: options.database });

  // Register Ephemeral Dev Environments API routes (M31)
  await registerWithRoleGuard(app, ephemeralEnvRoutes, '/v1/ephemeral-envs', {
    eventBus: options.eventBus,
    database: options.database,
  });

  // 注册 ChatOps API 路由 (M35) - PostgreSQL backed
  await registerWithRoleGuard(app, chatopsRoutes, '/v1/chatops', {
    eventBus: options.eventBus,
    database: options.database,
  });

  // 注册 Manual Confirmation API 路由 (P0-6)
  await registerWithRoleGuard(app, confirmationRoutes, '/v1/confirmations', { database: options.database, eventBus: options.eventBus });

  // 注册 Artifact Registry API 路由// Cost Operations 路由已迁移到 orion-finops-svc (port 3009)

  // 注册统一配置中心 API (使用 /v1/system-config 前缀)
  await registerWithRoleGuard(app, unifiedConfigRoutes, '/v1/system-config', { database: options.database });// 注册 OnCall 排班 API 路由 (P0 - SRE scheduling)
  // 注册 Escalation 统一升级 API 路由 (自动升级 + 手动升级)
  // 启动自动升级调度器
  // 使用系统租户模式绕过 RLS
  if (options.database && options.eventBus) {
    try {
      tenantContextStorage.run(
        { dbClient: null as unknown as PoolClient, tenantId: SYSTEM_TENANT_ID as unknown as number, isSystemTenant: true },
        async () => {
          await escalationScheduler.start();
          console.log('[routes] Escalation scheduler started');
        }
      );
    } catch (error) {
      console.warn('[routes] Failed to start escalation scheduler:', error);
    }
  }

  // 注册审批 API 路由 (P0 - multi-level approval)
  await registerApprovalRoutes(app, { database: options.database });

  // 注册 Cron Scheduler API 路由 (P0-1 Fix: was missing)
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
  // 注册 Knowledge Base API 路由 (M28) - PostgreSQL backed
  await registerWithRoleGuard(app, knowledgeRoutes, '/v1/knowledge', { database: options.database });

  // 注册 Metrics API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, metricsRoutes, '/v1/metrics', { database: options.database });

  // 注册 User Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, userRoutes, '/v1/users', { database: options.database });

  // 注册 Agent Orchestration API 路由 - PostgreSQL backed
  // 注册 API Key Management API 路由 - PostgreSQL backed
  await registerWithRoleGuard(app, apiKeyRoutes, '/v1/api-keys', { database: options.database });

  // 注册 MCP Server API 路由 - AI assistant integration
  await registerWithRoleGuard(app, mcpRoutes, '/v1/mcp', { database: options.database });

  // 注册 Vector Embedding & Semantic Search API 路由 (pgvector backed)// 注册 LLM Trace API 路由 - LLM调用链追踪与成本分析

  // 注册 Privacy Policy API 路由 - 租户隐私策略管理
  await registerWithRoleGuard(app, privacyRoutes, '/v1/privacy');

  await registerWithRoleGuard(app, disasterRecoveryRoutes, '/v1/disaster-recovery', {
    database: options.database,
  });

  // 注册 Degradation Management API 路由 - AI Provider自动恢复

  // ==================== Phase 2: AI Decision Enhancement ====================
  // Decision explanation, model version management
  // ==================== Phase 2: Observability Enhancement ====================
  // Custom alert rules, RCA, silence rules - migrated to monitor-svc

  // ==================== Phase 3: Supply Chain Security ====================// ==================== Phase 3: Chaos Engineering ====================

  // ==================== Phase 3: Cross-Domain Orchestration ====================
  await registerWithRoleGuard(app, crossDomainRoutes, '/v1/orchestration', {
    database: options.database,
  });

  // ==================== Workflow Routes (GAP Implementation) ====================
  await registerWithRoleGuard(app, workflowRoutes, '/v1/workflows', {});

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
  if (moduleManager.isModuleEnabled('domain:community')) {
    await registerWithRoleGuard(app, communityRoutes, '/v1/community');
  } else {
    logger.info('[routes] Community module disabled, skipping route registration');
  }

  // ==================== Community Ecosystem Advanced Services ====================
  await registerWithRoleGuard(app, communityAdvancedRoutes, '/v1/community-advanced');

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
  await registerWithRoleGuard(app, digitalTwinRoutes, '/v1/digital-twins');

  // ==================== API Governance ====================
  await registerWithRoleGuard(app, apiGovernanceRoutes, '/v1/api-governance');

  // Efficiency Enhanced routes migrated to efficiency-svc

  // ==================== Module Management ====================
  await registerWithRoleGuard(app, moduleRoutes, '/v1/system/modules', { moduleManager: (options as any).moduleManager });

  // ==================== Inline Script ====================
  await registerWithRoleGuard(app, scriptRoutes, '/v1/scripts', { database: options.database });

  // ==================== Secret Management ====================
  await registerSecretRoutes(app, { database: options.database });

  // ==================== APK Upload History ====================
  await registerApkUploadHistoryRoutes(app);

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

  // Auth Enhanced - JWT Key Rotation & Token Blacklist
  await registerWithRoleGuard(app, authEnhancedRoutes, '/v1/auth', {
    database: options.database,
  });

  // Autonomous Pipeline - Error classification, adaptive timeout, auto-retry
  await registerWithRoleGuard(app, autonomousPipelineRoutes, '/v1/autonomous', {
    database: options.database,
  });

  // ML Canary Analysis
  await registerWithRoleGuard(app, canaryAnalysisRoutes, '/v1/canary-analysis', {
    database: options.database,
    eventBus: options.eventBus,
  });

  // Canary Traffic Management
  await registerWithRoleGuard(app, canaryTrafficRoutes, '/v1/canary/deployments', {
    database: options.database,
  });

  // Cron Scheduler
  await registerWithRoleGuard(app, cronRoutes, '/v1/cron', {
    database: options.database,
  });

  // Dependency Coordination - requires DependencyCoordinationService
  if (options.database) {
    const dependencyCoordinationService = new DependencyCoordinationService();
    await registerDependencyCoordinationRoutes(app, { dependencyCoordinationService });
  }

  // Developer Portal
  await registerWithRoleGuard(app, developerPortalRoutes, '/v1/developer-portal', {
    database: options.database,
  });

  // Diagnostic Agent
  await registerWithRoleGuard(app, diagnosticRoutes, '/v1/diagnostic', {
    database: options.database,
  });

  // Escalation - unified escalation management
  // Note: escalationScheduler is already started above
  await registerWithRoleGuard(app, escalationRoutes, '/v1/escalation', {
    database: options.database,
    eventBus: options.eventBus,
  });

  // Hook Chain - hook chain orchestration
  await registerWithRoleGuard(app, hookChainRoutes, '/v1/hook-chains');

  // Performance Analysis
  await registerWithRoleGuard(app, performanceRoutes, '/v1/performance', {
    database: options.database,
  });

  // Pipeline Graph - YAML/JSON conversion and validation
  if (options.database) {
    const pipelineRepository = new PipelineRepository(options.database);
    const pipelineService = new PipelineService(pipelineRepository);
    await registerPipelineGraphRoutes(app, { pipelineService });
  }

  // Pipeline SSE - real-time log streaming
  await app.register(pipelineSSERoutes, { prefix: '/v1', pipelineLogSSE });

  // Pipeline Templates
  await registerWithRoleGuard(app, pipelineTemplateRoutes, '/v1/pipeline-templates', {
    database: options.database,
  });

  // Pipeline Versions
  await registerWithRoleGuard(app, pipelineVersionRoutes, '/v1/pipelines/versions', {
    database: options.database,
  });

  // Plugin Hot Reload
  if (options.database) {
    const pluginRegistry = new PluginRegistry();
    const pluginLifecycleManager = new PluginLifecycleManager(pluginRegistry);
    await registerWithRoleGuard(app, pluginHotReloadRoutes, '/v1/plugins/hotreload', {
      lifecycleManager: pluginLifecycleManager,
      registry: pluginRegistry,
    });
  }

  // Plugin Management (enhanced plugin system)
  await registerWithRoleGuard(app, pluginRoutes, '/v1/plugins', {
    database: options.database,
    pluginManager: (options as any).moduleManager,
  });

  // Queue Management
  await registerWithRoleGuard(app, queueRoutes, '/v1/queue', {
    database: options.database,
  });

  // Test Generation - AI test case generation
  await registerWithRoleGuard(app, testGenerationRoutes, '/v1/test-generation');

  // Test Selector - smart test selection
  await registerWithRoleGuard(app, testSelectorRoutes, '/v1/test-selector');
}