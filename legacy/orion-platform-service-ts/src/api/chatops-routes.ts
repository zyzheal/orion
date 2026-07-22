/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/chatops/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * ChatOps API Routes
 *
 * Routes under /api/v1/chatops
 * Migrated to PostgreSQL Repository pattern (M35)
 * Phase 1a: Added recommendations, sessions/messages, settings, alerts, SSE
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { EventBusService } from '../services/event-bus-service';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import {
  ChatOpsCommandRepository,
  ChatOpsExecutionRepository,
  ChatOpsSessionRepository,
  ChatOpsAuditLogRepository,
  ChatOpsMessageRepository,
  ChatOpsNotificationPreferenceRepository,
  ChatOpsDNDSettingsRepository,
  ChatOpsAlertStateRepository,
} from '../repositories/ChatOpsRepository';
import { CommandService } from '../services/chatops/CommandService';
import { ExecutionService } from '../services/chatops/ExecutionService';
import { CommandRouter } from '../services/chatops/CommandRouter';
import { ChatOpsController } from './controllers/ChatOpsController';
import { RecommendationService, RealDataProvider } from '../services/chatops/RecommendationService';
// MockDataProviderImpl 保留用于回滚: import { RecommendationService, MockDataProviderImpl } from ...
import { DashboardService } from '../services/chatops/DashboardService';
import { NotificationPreferenceService } from '../services/chatops/NotificationPreferenceService';
import { DNDService } from '../services/chatops/DNDService';
import { AlertStateService } from '../services/chatops/AlertStateService';
import { PlatformConfigService } from '../services/chatops/PlatformConfigService';
import { ChatConfigService } from '../services/chatops/ChatConfigService';
import { ChatOpsEventSubscriber } from '../services/chatops/EventSubscriber';
import { KnowledgeIntegrationService } from '../services/knowledge/KnowledgeIntegrationService';
import { SSEConnectionManager } from '../services/chatops/SSEConnectionManager';
import { InputValidator } from '../services/chatops/InputValidator';
import { DeployService } from '../services/deploy/DeployService';
import { DeployRepository } from '../services/deploy/DeployRepository';
import { MonitoringService } from '../services/monitoring';
import { MonitoringRepository } from '../services/monitoring/MonitoringRepository';
import { DiagnosticService } from '../services/diagnostic/DiagnosticService';
import { DiagnosticRepository } from '../services/diagnostic/DiagnosticRepository';
import { SelfHealingService } from '../services/self-healing/SelfHealingService';
import { SelfHealingRepository } from '../services/self-healing/SelfHealingRepository';
import { CapabilityMappingService } from '../services/chatops/CapabilityMappingService';
import { PermissionService } from '../services/chatops/PermissionService';
import { CommandVersionService } from '../services/chatops/CommandVersionService';
import { RateLimitService } from '../services/chatops/RateLimitService';
import { WebhookService } from '../services/chatops/WebhookService';
import { RedisCache } from '../services/redis-cache';
import { OrionError, ErrorCode , ValidationError, NotFoundError, UnauthorizedError, handleError} from '../errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('chatops-routes');

interface ChatOpsRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
  /** Redis 实例，用于 RateLimitService 滑动窗口 */
  redis?: RedisCache | null;
  /** 可选注入的外部服务，用于 CommandRouter 真实 handler */
  pipelineService?: any;
  deployService?: any;
  monitoringService?: any;
  diagnosticService?: any;
  selfHealingService?: any;
  /** 知识库集成服务 (Task 4.63) */
  knowledgeIntegration?: KnowledgeIntegrationService;
}

export default async function chatopsRoutes(
  app: FastifyInstance,
  options: ChatOpsRoutesOptions,
): Promise<void> {
  if (!options.database) {
    logger.warn('[ChatOpsRoutes] No database pool provided, chatops routes will not be functional');
    return;
  }

  const db = options.database;

  // ==================== Existing Repositories ====================
  const commandRepo = new ChatOpsCommandRepository(db);
  const executionRepo = new ChatOpsExecutionRepository(db);
  const sessionRepo = new ChatOpsSessionRepository(db);
  const auditRepo = new ChatOpsAuditLogRepository(db);

  // ==================== Phase 1a New Repositories ====================
  const messageRepo = new ChatOpsMessageRepository(db);
  const notifPrefRepo = new ChatOpsNotificationPreferenceRepository(db);
  const dndRepo = new ChatOpsDNDSettingsRepository(db);
  const alertStateRepo = new ChatOpsAlertStateRepository(db);

  // ==================== Existing Services ====================
  const commandService = new CommandService({
    pool: db,
    eventBus: options.eventBus,
    repository: commandRepo,
  });

  // InputValidator: 安全校验服务，注册所有命令 schema
  const inputValidator = new InputValidator();

  // CommandRouter: 注册真实服务 handler (若注入)，否则使用内置 mock handler
  const serviceMap = new Map<string, any>();
  const commandRouter = new CommandRouter(serviceMap, db);

  // 注册真实服务 handler
  if (options.pipelineService) {
    commandRouter.registerHandler('pipeline', async (params: Record<string, unknown>) => {
      const pipelineId = params.pipelineId as string;
      if (!pipelineId) throw new OrionError('pipelineId 必填', ErrorCode.OPERATION_FAILED);
      try {
        const pipeline = await options.pipelineService.getById(pipelineId);
        return {
          status: 'ok',
          command: 'pipeline',
          pipeline,
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        return {
          status: 'error',
          command: 'pipeline',
          error: err instanceof Error ? err.message : 'Pipeline lookup failed',
          timestamp: new Date().toISOString(),
        };
      }
    });
    commandRouter.registerHandler('status', async (params: Record<string, unknown>) => {
      const pipelineId = params.pipelineId as string;
      if (pipelineId) {
        try {
          const pipeline = await options.pipelineService.getById(pipelineId);
          return {
            status: 'ok',
            command: 'status',
            resource: 'pipeline',
            data: pipeline,
            timestamp: new Date().toISOString(),
          };
        } catch (err) {
          return {
            status: 'error',
            command: 'status',
            error: err instanceof Error ? err.message : 'Status lookup failed',
            timestamp: new Date().toISOString(),
          };
        }
      }
      return {
        status: 'ok',
        command: 'status',
        system: 'healthy',
        timestamp: new Date().toISOString(),
      };
    });
  }

  // 本地初始化服务（若未注入则使用注入的服务）
  const deployService = options.deployService || (new DeployService(new DeployRepository(db)));
  const monitoringService = options.monitoringService || (new MonitoringService(new MonitoringRepository(db)));
  const diagnosticService = options.diagnosticService || (new DiagnosticService(new DiagnosticRepository(db)));
  const selfHealingService = options.selfHealingService || (new SelfHealingService(new SelfHealingRepository(db), undefined, db));

  // 统一注册服务 handler (本地初始化或注入的服务)
  // Deploy handlers - S-2: tenantId 从 params 获取, R-2: try-catch 错误处理
  commandRouter.registerHandler('deploy', async (params: Record<string, unknown>) => {
    const service = params.service as string;
    const environment = params.environment as string;
    const version = params.version as string;
    const tenantId = params.tenantId as string;
    if (!service || !environment) {
      return { status: 'error', command: 'deploy', error: 'service 和 environment 必填', timestamp: new Date().toISOString() };
    }
    try {
      const deployment = await deployService.createDeployment({
        tenant_id: tenantId,
        environment,
        config: { service, version },
        strategy: 'rolling',
      });
      return { status: 'ok', command: 'deploy', deploymentId: deployment.id, service, environment, timestamp: new Date().toISOString() };
    } catch (err) {
      return { status: 'error', command: 'deploy', error: err instanceof Error ? err.message : 'Deploy failed', timestamp: new Date().toISOString() };
    }
  });

  commandRouter.registerHandler('rollback', async (params: Record<string, unknown>) => {
    const deployment = params.deployment as string;
    const targetVersion = params.targetVersion as string;
    if (!deployment) {
      return { status: 'error', command: 'rollback', error: 'deployment 必填', timestamp: new Date().toISOString() };
    }
    try {
      const dep = await deployService.getDeployment(deployment);
      return { status: 'ok', command: 'rollback', deploymentId: deployment, targetVersion: targetVersion || 'previous', previousVersion: dep.config?.version || 'unknown', timestamp: new Date().toISOString() };
    } catch (err) {
      return { status: 'error', command: 'rollback', error: err instanceof Error ? err.message : 'Rollback lookup failed', timestamp: new Date().toISOString() };
    }
  });

  commandRouter.registerHandler('restart', async (params: Record<string, unknown>) => {
    const namespace = params.namespace as string;
    const pod = params.pod as string;
    if (!namespace || !pod) {
      return { status: 'error', command: 'restart', error: 'namespace 和 pod 必填', timestamp: new Date().toISOString() };
    }
    return { status: 'ok', command: 'restart', namespace, pod, message: `Pod ${pod} restart initiated`, timestamp: new Date().toISOString() };
  });

  // Monitoring handlers
  commandRouter.registerHandler('logs', async (params: Record<string, unknown>) => {
    const service = params.service as string;
    const lines = (params.lines as number) || 100;
    return { status: 'ok', command: 'logs', service: service || 'all', lines, output: 'Log streaming Phase 1b', timestamp: new Date().toISOString() };
  });

  commandRouter.registerHandler('alert', async (params: Record<string, unknown>) => {
    const severity = params.severity as string;
    const hours = (params.hours as number) || 24;
    try {
      const alerts = await monitoringService.listAlerts?.({ severity, limit: hours }) || [];
      return { status: 'ok', command: 'alert', severity: severity || 'all', hours, count: alerts.length, alerts: alerts.slice(0, 10), timestamp: new Date().toISOString() };
    } catch (err) {
      return { status: 'error', command: 'alert', error: err instanceof Error ? err.message : 'Alert lookup failed', timestamp: new Date().toISOString() };
    }
  });

  // Diagnostic handler
  commandRouter.registerHandler('diagnose', async (params: Record<string, unknown>) => {
    const target = params.target as string;
    const type = params.type as string;
    const tenantId = params.tenantId as string;
    if (!target) {
      return { status: 'error', command: 'diagnose', error: 'target 必填', timestamp: new Date().toISOString() };
    }
    try {
      const session = await diagnosticService.createSession?.({
        id: `diag-${Date.now()}`,
        tenantId,
        target,
        type: type || 'auto',
        status: 'running',
        startTime: new Date(),
      });
      return { status: 'ok', command: 'diagnose', sessionId: session?.id || `diag-${Date.now()}`, target, message: 'Diagnostic session started', timestamp: new Date().toISOString() };
    } catch (err) {
      return { status: 'error', command: 'diagnose', error: err instanceof Error ? err.message : 'Diagnostic start failed', timestamp: new Date().toISOString() };
    }
  });

  // SelfHealing handler
  commandRouter.registerHandler('selfhealing_trigger', async (params: Record<string, unknown>) => {
    const policy = params.policy as string;
    const target = params.target as string;
    if (!policy) {
      return { status: 'error', command: 'selfhealing_trigger', error: 'policy 必填', timestamp: new Date().toISOString() };
    }
    return { status: 'ok', command: 'selfhealing_trigger', policy, target: target || 'auto', message: 'Self-healing policy triggered', timestamp: new Date().toISOString() };
  });

  // Knowledge integration handler (Task 4.63)
  commandRouter.registerHandler('knowledge', async (params: Record<string, unknown>) => {
    const context = (params.context as string) || 'general';
    const limit = (params.limit as number) || 5;
    try {
      const recommendations = await knowledgeIntegration.search('', context, { limit });
      return {
        status: 'ok',
        command: 'knowledge',
        context,
        count: recommendations.length,
        recommendations,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        status: 'error',
        command: 'knowledge',
        error: err instanceof Error ? err.message : 'Knowledge search failed',
        timestamp: new Date().toISOString(),
      };
    }
  });

  const executionService = new ExecutionService({
    commandService,
    eventBus: options.eventBus,
    executionRepo,
    sessionRepo,
    auditRepo,
    commandRouter,
    inputValidator,
  });

  // ==================== Dashboard Service ====================
  const dashboardService = new DashboardService(executionRepo);

  // ==================== Phase 1a New Services ====================
  // Recommendations: RealDataProvider 查询真实数据库表 (Phase 1b 可添加租户过滤)
  const dataProvider = new RealDataProvider(db);
  const recommendationService = new RecommendationService(dataProvider);

  // Notification Preferences
  const notifPrefService = new NotificationPreferenceService(db);

  // DND Settings
  const dndService = new DNDService(db);

  // Alert States (with SE-9 ownership validation)
  const alertStateService = new AlertStateService(db);

  // Platform Config
  const platformConfigService = new PlatformConfigService(db);

  // Chat Config (Questions & Commands)
  const chatConfigService = new ChatConfigService(db);

  // Knowledge Integration (Task 4.63)
  const knowledgeIntegration = new KnowledgeIntegrationService(db);

  // ==================== Admin Services ====================
  // Capability Mapping Service (管理命令-Capability 映射)
  const capabilityMappingService = new CapabilityMappingService(db);
  // Permission Service (角色、命令权限、环境权限)
  const permissionService = new PermissionService(db);
  // Command Version Service (命令版本管理)
  const commandVersionService = new CommandVersionService(db);
  // Rate Limit Service (速率限制，带 Redis Sorted Set 滑动窗口)
  const rateLimitService = new RateLimitService(db, options.redis ?? null);
  // Webhook Service (Webhook 管理)
  const webhookService = new WebhookService(db);

  // ==================== EventBus + SSE (Phase 1a) ====================
  // 先初始化 eventSubscriber，以便注入到 controller
  let eventSubscriber: ChatOpsEventSubscriber | null = null;
  let connectionManager: SSEConnectionManager | null = null;

  if (options.eventBus) {
    eventSubscriber = new ChatOpsEventSubscriber(options.eventBus, db);
    await eventSubscriber.initialize().catch(err => {
      logger.warn('[ChatOpsRoutes] EventSubscriber initialization failed:', err);
    });

    connectionManager = new SSEConnectionManager(eventSubscriber!.getLocalBus(), db);

    // Register shutdown handler
    const gracefulShutdown = () => {
      connectionManager?.shutdown().catch(() => {});
      eventSubscriber?.cleanup().catch(() => {});
    };
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  // ==================== Controller ====================
  // 注入 eventSubscriber 以支持按角色过滤推荐面板
  // ARCH-005: 注入 eventBus 以支持健康检查
  const controller = new ChatOpsController({
    commandService,
    executionService,
    messageRepo,
    recommendationService,
    notifPrefService,
    dndService,
    alertStateService,
    platformConfigService,
    eventSubscriber,
    eventBus: options.eventBus,
    dashboardService,
    permissionService,
    rateLimitService,
    chatConfigService,
    knowledgeIntegration,
  });

  // Seed default commands
  await commandService.seedDefaults();

  // 注册命令 schema 到 InputValidator
  const allCommands = await commandService.getAllCommands();
  for (const cmd of allCommands) {
    // 将 schema 转换为 JSON Schema 格式
    const schema: Record<string, unknown> = {
      type: 'object',
      properties: cmd.schema,
      required: Object.entries(cmd.schema)
        .filter(([, def]) => (def as { required?: boolean }).required)
        .map(([key]) => key),
    };
    inputValidator.registerSchema(cmd.name, schema);
  }

  // ==================== Commands ====================

  app.get('/commands', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'List available ChatOps commands',
      tags: ['chatops', 'commands'],
      summary: '获取可用命令列表',
      querystring: {
        type: 'object',
        properties: {
          permissionLevel: { type: 'string', description: 'Filter by permission level' },
          name: { type: 'string', description: 'Search by command name or alias' },
          page: { type: 'integer', minimum: 1 },
          perPage: { type: 'integer', minimum: 1, maximum: 100 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
            total: { type: 'integer' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listCommands(request, reply);
  });

  app.get('/commands/:name/help', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'Get help for a specific command',
      tags: ['chatops', 'commands'],
      summary: '获取命令帮助信息',
      params: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Command name' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                subcommand: { type: 'string' },
                aliases: { type: 'array', items: { type: 'string' } },
                permissionLevel: { type: 'string' },
                schema: { type: 'object' },
                examples: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        404: { description: 'Command not found' },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCommandHelp(request, reply);
  });

  // ==================== Execution ====================

  app.post('/execute', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'execute' })],
    schema: {
      description: 'Execute a ChatOps command',
      tags: ['chatops', 'execution'],
      summary: '执行 ChatOps 命令',
      body: {
        type: 'object',
        required: ['command'],
        properties: {
          command: { type: 'string', description: 'Command name (e.g. deploy, status, logs)' },
          params: { type: 'object', description: 'Command parameters', additionalProperties: { type: 'object' } },
          channel: { type: 'string', description: 'Channel identifier' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                commandId: { type: 'string' },
                userId: { type: 'string' },
                status: { type: 'string', enum: ['running', 'completed', 'failed'] },
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time', nullable: true },
                result: { type: 'object' },
                milestones: { type: 'object' },
              },
            },
          },
        },
        400: { description: 'Invalid request body' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden - permission denied or rate limited' },
        404: { description: 'Command not found' },
        429: { description: 'Rate limit exceeded' },
        503: { description: 'Permission service unavailable' },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeCommand(request, reply);
  });

  app.get('/status/:commandId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'Get execution status by command/execution ID',
      tags: ['chatops', 'execution'],
      summary: '查询命令执行状态',
      params: {
        type: 'object',
        required: ['commandId'],
        properties: {
          commandId: { type: 'string', description: 'Execution ID or command ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                commandId: { type: 'string' },
                status: { type: 'string', enum: ['running', 'completed', 'failed'] },
                result: { type: 'object' },
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time', nullable: true },
              },
            },
          },
        },
        404: { description: 'Execution not found' },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.checkExecutionStatus(request, reply);
  });

  app.get('/executions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'List command executions with optional filters',
      tags: ['chatops', 'execution'],
      summary: '获取命令执行历史',
      querystring: {
        type: 'object',
        properties: {
          commandId: { type: 'string' },
          userId: { type: 'string' },
          status: { type: 'string', enum: ['running', 'completed', 'failed'] },
          platform: { type: 'string' },
          page: { type: 'integer', minimum: 1 },
          perPage: { type: 'integer', minimum: 1, maximum: 100 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
            total: { type: 'integer' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listExecutions(request, reply);
  });

  // ==================== Webhook ====================

  app.post('/message', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })],
    schema: {
      description: 'Receive webhook message from IM platform',
      tags: ['chatops', 'webhook'],
      summary: '接收 IM 平台 Webhook 消息',
      body: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Message text' },
          message: { type: 'string', description: 'Alternative message field' },
          platform: { type: 'string', description: 'Platform identifier' },
          channel: { type: 'string', description: 'Channel identifier' },
          environment: { type: 'string', description: 'Target environment' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            command: { type: 'object' },
          },
        },
        400: { description: 'Invalid request or unknown command' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden - permission denied' },
        429: { description: 'Rate limit exceeded' },
        503: { description: 'Permission service unavailable' },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.receiveMessage(request, reply);
  });

  // ==================== Recommendations (Phase 1a) ====================

  app.post('/recommendations', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })],
    schema: {
      description: 'Get AI-powered command recommendations',
      tags: ['chatops', 'recommendations'],
      summary: '获取智能命令推荐',
      body: {
        type: 'object',
        properties: {
          context: {
            type: 'object',
            properties: {
              currentPage: { type: 'string' },
              resourceId: { type: 'string' },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
            total: { type: 'integer' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRecommendations(request, reply);
  });

  // ==================== Knowledge Recommendations (Task 4.63) ====================

  app.get('/knowledge', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'Get knowledge base recommendations for ChatOps context',
      tags: ['chatops', 'knowledge'],
      summary: '获取知识库推荐',
      querystring: {
        type: 'object',
        properties: {
          context: { type: 'string', description: 'Knowledge context (e.g. deployment, incident, approval)' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
            total: { type: 'integer' },
          },
        },
        503: { description: 'Knowledge service not configured' },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getKnowledgeRecommendations(request, reply);
  });

  // ==================== Sessions / Messages (Phase 1a) ====================

  app.get('/sessions/:id/messages', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'Get messages for a ChatOps session',
      tags: ['chatops', 'sessions'],
      summary: '获取会话消息历史',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Session ID' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          cursor: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
            hasMore: { type: 'boolean' },
            nextCursor: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSessionMessages(request, reply);
  });

  // ==================== SSE Stream (Phase 1a) ====================

  app.get('/stream/recommendations', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'SSE stream for real-time recommendations',
      tags: ['chatops', 'sse'],
      summary: 'SSE 实时推荐流',
      response: {
        200: {
          type: 'string',
          description: 'SSE event stream',
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.streamRecommendations(request, reply, connectionManager, eventSubscriber);
  });

  // ==================== Notification Preferences (Phase 1a) ====================

  app.get('/settings/notification-preferences', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'Get user notification preferences',
      tags: ['chatops', 'settings'],
      summary: '获取通知偏好设置',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getNotificationPreferences(request, reply);
  });

  app.put('/settings/notification-preferences', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })],
    schema: {
      description: 'Update user notification preferences',
      tags: ['chatops', 'settings'],
      summary: '更新通知偏好设置',
      body: {
        type: 'object',
        properties: {
          alertLevel: { type: 'string', enum: ['critical', 'warning', 'info'] },
          channelChatops: { type: 'boolean' },
          channelEmail: { type: 'boolean' },
          channelSlack: { type: 'boolean' },
          channelFeishu: { type: 'boolean' },
          channelDingtalk: { type: 'boolean' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateNotificationPreferences(request, reply);
  });

  // ==================== DND Settings (Phase 1a) ====================

  app.get('/settings/dnd', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'Get user DND (Do Not Disturb) settings',
      tags: ['chatops', 'settings'],
      summary: '获取免打扰设置',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDNDSettings(request, reply);
  });

  app.put('/settings/dnd', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })],
    schema: {
      description: 'Update user DND settings',
      tags: ['chatops', 'settings'],
      summary: '更新免打扰设置',
      body: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          repeatDays: { type: 'array', items: { type: 'integer' } },
          allowCritical: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateDNDSettings(request, reply);
  });

  app.patch('/settings/dnd/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })],
    schema: {
      description: 'Toggle DND mode on/off',
      tags: ['chatops', 'settings'],
      summary: '切换免打扰模式',
      body: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.toggleDND(request, reply);
  });

  // ==================== Platform Config (Phase 1a) ====================

  app.get('/settings/platforms', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'Get user platform configurations',
      tags: ['chatops', 'settings'],
      summary: '获取平台配置',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPlatformConfigs(request, reply);
  });

  app.put('/settings/platforms', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })],
    schema: {
      description: 'Update user platform configurations',
      tags: ['chatops', 'settings'],
      summary: '更新平台配置',
      body: {
        type: 'object',
        required: ['platforms'],
        properties: {
          platforms: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                platform: { type: 'string' },
                enabled: { type: 'boolean' },
                webhook: { type: 'string' },
                token: { type: 'string' },
              },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updatePlatformConfigs(request, reply);
  });

  // ==================== Alert States (Phase 1a) ====================

  app.get('/alerts/states', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'Get user alert states',
      tags: ['chatops', 'alerts'],
      summary: '获取告警状态',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAlertStates(request, reply);
  });

  app.post('/alerts/:id/read', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })],
    schema: {
      description: 'Mark alert as read',
      tags: ['chatops', 'alerts'],
      summary: '标记告警为已读',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Alert ID' },
        },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.markAlertRead(request, reply);
  });

  app.post('/alerts/:id/acknowledge', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })],
    schema: {
      description: 'Acknowledge an alert',
      tags: ['chatops', 'alerts'],
      summary: '确认告警',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.markAlertAcknowledged(request, reply);
  });

  app.post('/alerts/:id/dismiss', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })],
    schema: {
      description: 'Dismiss an alert',
      tags: ['chatops', 'alerts'],
      summary: '关闭告警',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.markAlertDismissed(request, reply);
  });

  // ==================== Dashboard Stats ====================

  app.get('/dashboard/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })],
    schema: {
      description: 'Get ChatOps dashboard statistics',
      tags: ['chatops', 'dashboard'],
      summary: '获取 ChatOps 仪表盘统计',
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', description: 'Time range (e.g. 1h, 24h, 7d, 30d)' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
        400: { description: 'Invalid date range' },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDashboardStats(request, reply);
  });

  // ==================== Health Check (ARCH-005) ====================

  app.get('/health', {
    schema: {
      description: 'ChatOps service health check',
      tags: ['chatops', 'health'],
      summary: 'ChatOps 服务健康检查',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            eventBus: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down', 'fallback'] },
                state: { type: 'string' },
                message: { type: 'string' },
                natsAvailable: { type: 'boolean' },
                reconnectAttempts: { type: 'integer' },
              },
            },
            sse: {
              type: 'object',
              properties: {
                activeConnections: { type: 'integer' },
                fallbackMode: { type: 'boolean' },
              },
            },
            subscriptions: {
              type: 'object',
              properties: {
                failures: { type: 'integer' },
                details: { type: 'array', items: { type: 'object' } },
              },
            },
            metrics: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.healthCheck(request, reply);
  });

  // ==================== Audit ====================

  app.get('/audit/logs', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditLogs(request, reply);
  });

  app.get('/audit/stats', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditStats(request, reply);
  });

  app.post('/audit/export', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.exportAuditLogs(request, reply);
  });

  // ==================== Permission Check API ====================

  // GET /permissions/allowed-commands - 获取当前用户可执行的命令列表
  app.get('/permissions/allowed-commands', { onRequest: [authenticateUser] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as { userId: string } | undefined;
    if (!user) {
      return handleError(reply, new UnauthorizedError('UNAUTHORIZED'));
    }
    try {
      const allowedCommands = await permissionService.getUserAllowedCommands(user.userId);
      return reply.send({ success: true, data: allowedCommands });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch allowed commands', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Admin API (Capability Mappings & Approval Config) ====================

  // GET /admin/capability-mappings - 获取所有命令-Capability 映射
  app.get('/admin/capability-mappings', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { environment } = request.query as { environment?: string };
    try {
      const mappings = await capabilityMappingService.getAllMappings(environment);
      return reply.send({ success: true, data: mappings });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch capability mappings', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /admin/capability-mappings - 创建映射
  app.post('/admin/capability-mappings', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      command_id: string;
      capability_id: string;
      environment?: string;
      risk_level: number;
      requires_approval: boolean;
    };
    // 输入校验
    if (!body.command_id || !body.capability_id) {
      return handleError(reply, new ValidationError('command_id and capability_id are required'));
    }
    if (typeof body.risk_level !== 'number' || body.risk_level < 1 || body.risk_level > 4) {
      return handleError(reply, new ValidationError('risk_level must be a number between 1 and 4'));
    }
    try {
      const mapping = await capabilityMappingService.createMapping(body);
      return reply.status(201).send({ success: true, data: mapping });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to create capability mapping', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /admin/capability-mappings/:id - 更新映射
  app.put('/admin/capability-mappings/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      command_id: string;
      capability_id: string;
      environment?: string;
      risk_level: number;
      requires_approval: boolean;
    }>;
    try {
      const mapping = await capabilityMappingService.updateMapping(id, body);
      if (!mapping) {
        return handleError(reply, new NotFoundError('Mapping not found'));
      }
      return reply.send({ success: true, data: mapping });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to update capability mapping', ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /admin/capability-mappings/:id - 删除映射
  app.delete('/admin/capability-mappings/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await capabilityMappingService.deleteMapping(id);
      if (!deleted) {
        return handleError(reply, new NotFoundError('Mapping not found'));
      }
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to delete capability mapping', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /admin/approval-configs - 获取所有审批配置
  app.get('/admin/approval-configs', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const configs = await capabilityMappingService.getAllApprovalConfigs();
      return reply.send({ success: true, data: configs });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch approval configs', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /admin/approval-configs - 批量更新审批配置
  app.put('/admin/approval-configs', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      capability: string;
      enabled: boolean;
      approvers: string[];
      threshold: number;
    }[];
    try {
      const configs = await capabilityMappingService.updateApprovalConfigs(body);
      return reply.send({ success: true, data: configs });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to update approval configs', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /admin/approval-configs/:capability - 获取单个能力域配置
  app.get('/admin/approval-configs/:capability', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { capability } = request.params as { capability: string };
    try {
      const config = await capabilityMappingService.getApprovalConfigByCapability(capability);
      if (!config) {
        return handleError(reply, new NotFoundError('Approval config not found'));
      }
      return reply.send({ success: true, data: config });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch approval config', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /admin/approval-configs/:capability - 更新单个能力域配置
  app.put('/admin/approval-configs/:capability', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { capability } = request.params as { capability: string };
    const body = request.body as Partial<{
      enabled: boolean;
      approvers: string[];
      threshold: number;
    }>;
    try {
      const config = await capabilityMappingService.updateApprovalConfig(capability, body);
      if (!config) {
        return handleError(reply, new NotFoundError('Approval config not found'));
      }
      return reply.send({ success: true, data: config });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to update approval config', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /admin/approvers - 获取审批人列表
  app.get('/admin/approvers', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const approvers = await capabilityMappingService.getApprovers();
      return reply.send({ success: true, data: approvers });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch approvers', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /admin/approvers/schedule - 获取审批人值班表
  app.get('/admin/approvers/schedule', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schedule = await capabilityMappingService.getApproverSchedule();
      return reply.send({ success: true, data: schedule });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch approver schedule', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /admin/approvers/schedule - 更新审批人值班表
  app.put('/admin/approvers/schedule', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { user_id: string; start_time: string; end_time: string }[];
    try {
      await capabilityMappingService.updateApproverSchedule(body);
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to update approver schedule', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /admin/approval-global-config - 获取全局审批配置
  app.get('/admin/approval-global-config', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await capabilityMappingService.getGlobalApprovalConfig();
      return reply.send({ success: true, data: config });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch global approval config', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /admin/approval-global-config - 更新全局审批配置
  app.put('/admin/approval-global-config', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { enabled: boolean; mode: string };
    try {
      await capabilityMappingService.updateGlobalApprovalConfig(body);
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to update global approval config', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Permission Admin API ====================

  // ---- Role Management ----
  app.get('/admin/roles', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const roles = await permissionService.getAllRoles();
      return reply.send({ success: true, data: roles });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch roles', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.post('/admin/roles', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name: string; description?: string; permissions?: string[] };
    return handleError(reply, new ValidationError('name is required'));
    try {
      const role = await permissionService.createRole(body);
      return reply.status(201).send({ success: true, data: role });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to create role', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.put('/admin/roles/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; description?: string; permissions?: string[] };
    try {
      const role = await permissionService.updateRole(id, body);
      return handleError(reply, new NotFoundError('Role not found'));
      return reply.send({ success: true, data: role });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to update role', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.delete('/admin/roles/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await permissionService.deleteRole(id);
      return handleError(reply, new NotFoundError('Role not found'));
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to delete role', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ---- Command Permission Management ----
  app.get('/admin/command-permissions', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const perms = await permissionService.getAllCommandPermissions();
      return reply.send({ success: true, data: perms });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch command permissions', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.post('/admin/command-permissions', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { command: string; description?: string; capability: string; risk_level?: number; requires_approval?: boolean; role_ids?: string[] };
    return handleError(reply, new ValidationError('command and capability are required'));
    try {
      const perm = await permissionService.createCommandPermission(body);
      return reply.status(201).send({ success: true, data: perm });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to create command permission', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.put('/admin/command-permissions/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { description?: string; capability?: string; risk_level?: number; requires_approval?: boolean; role_ids?: string[] };
    try {
      const perm = await permissionService.updateCommandPermission(id, body);
      return handleError(reply, new NotFoundError('Command permission not found'));
      return reply.send({ success: true, data: perm });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to update command permission', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.delete('/admin/command-permissions/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await permissionService.deleteCommandPermission(id);
      return handleError(reply, new NotFoundError('Command permission not found'));
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to delete command permission', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ---- Environment Permission Management ----
  app.get('/admin/environment-permissions', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const perms = await permissionService.getAllEnvironmentPermissions();
      return reply.send({ success: true, data: perms });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch environment permissions', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.post('/admin/environment-permissions', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { environment: string; description?: string; rate_limit?: number; require_approval?: boolean; allowed_commands?: string[]; denied_commands?: string[]; role_ids?: string[] };
    return handleError(reply, new ValidationError('environment is required'));
    try {
      const perm = await permissionService.createEnvironmentPermission(body);
      return reply.status(201).send({ success: true, data: perm });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to create environment permission', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.put('/admin/environment-permissions/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { description?: string; rate_limit?: number; require_approval?: boolean; allowed_commands?: string[]; denied_commands?: string[]; role_ids?: string[] };
    try {
      const perm = await permissionService.updateEnvironmentPermission(id, body);
      return handleError(reply, new NotFoundError('Environment permission not found'));
      return reply.send({ success: true, data: perm });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to update environment permission', ErrorCode.INTERNAL_ERROR));
    }
  });

  app.delete('/admin/environment-permissions/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await permissionService.deleteEnvironmentPermission(id);
      return handleError(reply, new NotFoundError('Environment permission not found'));
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to delete environment permission', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Command Version Management API ====================

  // GET /admin/command-versions - 获取所有命令版本
  app.get('/admin/command-versions', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, perPage } = request.query as { page?: string; perPage?: string };
    try {
      const result = await commandVersionService.getAllVersions(
        parseInt(page || '1'),
        parseInt(perPage || '20')
      );
      return reply.send({ success: true, data: result.versions, total: result.total });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch command versions', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /admin/command-versions/:commandId - 获取指定命令的版本历史
  app.get('/admin/command-versions/:commandId', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { commandId } = request.params as { commandId: string };
    try {
      const versions = await commandVersionService.getVersionsByCommand(commandId);
      return reply.send({ success: true, data: versions });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch command versions', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /admin/command-versions - 创建新版本
  app.post('/admin/command-versions', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { command_id: string; command_text: string; parameters?: Record<string, unknown>; description?: string; changelog?: string };
    return handleError(reply, new ValidationError('command_id and command_text are required'));
    try {
      const user = (request as any).user;
      const version = await commandVersionService.createVersion({ ...body, created_by: user?.username || 'system' });
      return reply.status(201).send({ success: true, data: version });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to create command version', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /admin/command-versions/:commandId/rollback/:version - 回滚到指定版本
  app.post('/admin/command-versions/:commandId/rollback/:version', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { commandId, version } = request.params as { commandId: string; version: string };
    try {
      const newVersion = await commandVersionService.rollbackToVersion(commandId, parseInt(version));
      return handleError(reply, new NotFoundError('Version not found'));
      return reply.send({ success: true, data: newVersion });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to rollback command version', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /admin/command-versions/:versionId/tags - 添加标签
  app.post('/admin/command-versions/:versionId/tags', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { versionId } = request.params as { versionId: string };
    const body = request.body as { tag_name: string };
    return handleError(reply, new ValidationError('tag_name is required'));
    try {
      const user = (request as any).user;
      await commandVersionService.addTag(versionId, body.tag_name, user?.username || 'system');
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to add tag', ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /admin/command-versions/:versionId/tags/:tagName - 删除标签
  app.delete('/admin/command-versions/:versionId/tags/:tagName', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { versionId, tagName } = request.params as { versionId: string; tagName: string };
    try {
      await commandVersionService.removeTag(versionId, tagName);
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to remove tag', ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /admin/command-versions/:id - 删除版本
  app.delete('/admin/command-versions/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await commandVersionService.deleteVersion(id);
      return handleError(reply, new NotFoundError('Version not found'));
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to delete command version', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Rate Limit Management API ====================

  // GET /admin/rate-limits - 获取所有限流配置
  app.get('/admin/rate-limits', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const limits = await rateLimitService.getAll();
      return reply.send({ success: true, data: limits });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch rate limits', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /admin/rate-limits - 创建限流配置
  app.post('/admin/rate-limits', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { target_type: string; target_id?: string; command_name?: string; limit_type: string; limit_count: number; window_seconds: number; description?: string };
    return handleError(reply, new ValidationError('target_type, limit_type, limit_count, window_seconds are required'));
    try {
      const limit = await rateLimitService.create(body as any);
      return reply.status(201).send({ success: true, data: limit });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to create rate limit', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /admin/rate-limits/:id - 更新限流配置
  app.put('/admin/rate-limits/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
      const limit = await rateLimitService.update(id, body);
      return handleError(reply, new NotFoundError('Rate limit not found'));
      return reply.send({ success: true, data: limit });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to update rate limit', ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /admin/rate-limits/:id - 删除限流配置
  app.delete('/admin/rate-limits/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await rateLimitService.delete(id);
      return handleError(reply, new NotFoundError('Rate limit not found'));
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to delete rate limit', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Webhook Management API ====================

  // GET /admin/webhooks - 获取所有 Webhook
  app.get('/admin/webhooks', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const webhooks = await webhookService.getAll();
      return reply.send({ success: true, data: webhooks });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch webhooks', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /admin/webhooks - 创建 Webhook
  app.post('/admin/webhooks', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name: string; url: string; events: string[]; secret_key?: string; enabled?: boolean; retry_count?: number; timeout_seconds?: number; headers?: Record<string, string>; description?: string };
    return handleError(reply, new ValidationError('name, url, events are required'));
    try {
      const user = (request as any).user;
      const webhook = await webhookService.create({ ...body, created_by: user?.username || 'system' });
      return reply.status(201).send({ success: true, data: webhook });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to create webhook', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /admin/webhooks/:id - 更新 Webhook
  app.put('/admin/webhooks/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
      const webhook = await webhookService.update(id, body);
      return handleError(reply, new NotFoundError('Webhook not found'));
      return reply.send({ success: true, data: webhook });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to update webhook', ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /admin/webhooks/:id - 删除 Webhook
  app.delete('/admin/webhooks/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await webhookService.delete(id);
      return handleError(reply, new NotFoundError('Webhook not found'));
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to delete webhook', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /admin/webhooks/:id/test - 测试 Webhook
  app.post('/admin/webhooks/:id/test', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await webhookService.testWebhook(id);
      return reply.send({ success: result.success, data: result });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to test webhook', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /admin/webhooks/:id/logs - 获取 Webhook 执行日志
  app.get('/admin/webhooks/:id/logs', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { limit } = request.query as { limit?: string };
    try {
      const logs = await webhookService.getLogs(id, parseInt(limit || '20'));
      return reply.send({ success: true, data: logs });
    } catch (error) {
      request.log.error(error);
      return handleError(reply, new OrionError('Failed to fetch webhook logs', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Chat Config (Questions & Commands) ====================

  // GET /settings/questions - 获取问答卡片配置
  app.get('/settings/questions', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getQuestionConfigs(request, reply);
  });

  // PUT /settings/questions - 批量更新问答卡片配置
  app.put('/settings/questions', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateQuestionConfigs(request, reply);
  });

  // GET /settings/commands - 获取快捷命令配置
  app.get('/settings/commands', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCommandConfigs(request, reply);
  });

  // PUT /settings/commands - 批量更新快捷命令配置
  app.put('/settings/commands', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateCommandConfigs(request, reply);
  });
}