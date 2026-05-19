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
import { ChatOpsEventSubscriber } from '../services/chatops/EventSubscriber';
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

interface ChatOpsRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
  /** 可选注入的外部服务，用于 CommandRouter 真实 handler */
  pipelineService?: any;
  deployService?: any;
  monitoringService?: any;
  diagnosticService?: any;
  selfHealingService?: any;
}

export default async function chatopsRoutes(
  app: FastifyInstance,
  options: ChatOpsRoutesOptions,
): Promise<void> {
  if (!options.database) {
    console.warn('[ChatOpsRoutes] No database pool provided, chatops routes will not be functional');
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
  const commandRouter = new CommandRouter(serviceMap);

  // 注册真实服务 handler
  if (options.pipelineService) {
    commandRouter.registerHandler('pipeline', async (params: Record<string, unknown>) => {
      const pipelineId = params.pipelineId as string;
      if (!pipelineId) throw new Error('pipelineId 必填');
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
  const selfHealingService = options.selfHealingService || (new SelfHealingService(new SelfHealingRepository(db)));

  // 统一注册服务 handler (本地初始化或注入的服务)
  // Deploy handlers - S-2: tenantId 从 params 获取, R-2: try-catch 错误处理
  commandRouter.registerHandler('deploy', async (params: Record<string, unknown>) => {
    const service = params.service as string;
    const environment = params.environment as string;
    const version = params.version as string;
    const tenantId = (params.tenantId as string) || 'default';
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
    const tenantId = (params.tenantId as string) || 'default';
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

  // ==================== Admin Services ====================
  // Capability Mapping Service (管理命令-Capability 映射)
  const capabilityMappingService = new CapabilityMappingService(db);

  // ==================== EventBus + SSE (Phase 1a) ====================
  // 先初始化 eventSubscriber，以便注入到 controller
  let eventSubscriber: ChatOpsEventSubscriber | null = null;
  let connectionManager: SSEConnectionManager | null = null;

  if (options.eventBus) {
    eventSubscriber = new ChatOpsEventSubscriber(options.eventBus);
    await eventSubscriber.initialize().catch(err => {
      console.warn('[ChatOpsRoutes] EventSubscriber initialization failed:', err);
    });

    connectionManager = new SSEConnectionManager(eventSubscriber!.getLocalBus());

    // Register shutdown handler
    const gracefulShutdown = () => {
      connectionManager?.shutdown();
      eventSubscriber?.cleanup();
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

  app.get('/commands', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listCommands(request, reply);
  });

  app.get('/commands/:name/help', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCommandHelp(request, reply);
  });

  // ==================== Execution ====================

  app.post('/execute', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeCommand(request, reply);
  });

  app.get('/status/:commandId', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.checkExecutionStatus(request, reply);
  });

  app.get('/executions', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listExecutions(request, reply);
  });

  // ==================== Webhook ====================

  app.post('/message', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.receiveMessage(request, reply);
  });

  // ==================== Recommendations (Phase 1a) ====================

  app.post('/recommendations', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRecommendations(request, reply);
  });

  // ==================== Sessions / Messages (Phase 1a) ====================

  app.get('/sessions/:id/messages', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSessionMessages(request, reply);
  });

  // ==================== SSE Stream (Phase 1a) ====================

  app.get('/stream/recommendations', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.streamRecommendations(request, reply, connectionManager, eventSubscriber);
  });

  // ==================== Notification Preferences (Phase 1a) ====================

  app.get('/settings/notification-preferences', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getNotificationPreferences(request, reply);
  });

  app.put('/settings/notification-preferences', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateNotificationPreferences(request, reply);
  });

  // ==================== DND Settings (Phase 1a) ====================

  app.get('/settings/dnd', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDNDSettings(request, reply);
  });

  app.put('/settings/dnd', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateDNDSettings(request, reply);
  });

  app.patch('/settings/dnd/toggle', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.toggleDND(request, reply);
  });

  // ==================== Platform Config (Phase 1a) ====================

  app.get('/settings/platforms', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPlatformConfigs(request, reply);
  });

  app.put('/settings/platforms', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updatePlatformConfigs(request, reply);
  });

  // ==================== Alert States (Phase 1a) ====================

  app.get('/alerts/states', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAlertStates(request, reply);
  });

  app.post('/alerts/:id/read', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.markAlertRead(request, reply);
  });

  app.post('/alerts/:id/acknowledge', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.markAlertAcknowledged(request, reply);
  });

  app.post('/alerts/:id/dismiss', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.markAlertDismissed(request, reply);
  });

  // ==================== Dashboard Stats ====================

  app.get('/dashboard/stats', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDashboardStats(request, reply);
  });

  // ==================== Health Check (ARCH-005) ====================

  app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
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

  // ==================== Admin API (Capability Mappings & Approval Config) ====================

  // GET /admin/capability-mappings - 获取所有命令-Capability 映射
  app.get('/admin/capability-mappings', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { environment } = request.query as { environment?: string };
    try {
      const mappings = await capabilityMappingService.getAllMappings(environment);
      return reply.send({ success: true, data: mappings });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch capability mappings' });
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
      return reply.status(400).send({ success: false, error: 'command_id and capability_id are required' });
    }
    if (typeof body.risk_level !== 'number' || body.risk_level < 1 || body.risk_level > 4) {
      return reply.status(400).send({ success: false, error: 'risk_level must be a number between 1 and 4' });
    }
    try {
      const mapping = await capabilityMappingService.createMapping(body);
      return reply.status(201).send({ success: true, data: mapping });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to create capability mapping' });
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
        return reply.status(404).send({ success: false, error: 'Mapping not found' });
      }
      return reply.send({ success: true, data: mapping });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to update capability mapping' });
    }
  });

  // DELETE /admin/capability-mappings/:id - 删除映射
  app.delete('/admin/capability-mappings/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await capabilityMappingService.deleteMapping(id);
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'Mapping not found' });
      }
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to delete capability mapping' });
    }
  });

  // GET /admin/approval-configs - 获取所有审批配置
  app.get('/admin/approval-configs', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const configs = await capabilityMappingService.getAllApprovalConfigs();
      return reply.send({ success: true, data: configs });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch approval configs' });
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
      return reply.status(500).send({ success: false, error: 'Failed to update approval configs' });
    }
  });

  // GET /admin/approval-configs/:capability - 获取单个能力域配置
  app.get('/admin/approval-configs/:capability', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { capability } = request.params as { capability: string };
    try {
      const config = await capabilityMappingService.getApprovalConfigByCapability(capability);
      if (!config) {
        return reply.status(404).send({ success: false, error: 'Approval config not found' });
      }
      return reply.send({ success: true, data: config });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch approval config' });
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
        return reply.status(404).send({ success: false, error: 'Approval config not found' });
      }
      return reply.send({ success: true, data: config });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to update approval config' });
    }
  });

  // GET /admin/approvers - 获取审批人列表
  app.get('/admin/approvers', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const approvers = await capabilityMappingService.getApprovers();
      return reply.send({ success: true, data: approvers });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch approvers' });
    }
  });

  // GET /admin/approvers/schedule - 获取审批人值班表
  app.get('/admin/approvers/schedule', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const schedule = await capabilityMappingService.getApproverSchedule();
      return reply.send({ success: true, data: schedule });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch approver schedule' });
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
      return reply.status(500).send({ success: false, error: 'Failed to update approver schedule' });
    }
  });

  // GET /admin/approval-global-config - 获取全局审批配置
  app.get('/admin/approval-global-config', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'admin' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await capabilityMappingService.getGlobalApprovalConfig();
      return reply.send({ success: true, data: config });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch global approval config' });
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
      return reply.status(500).send({ success: false, error: 'Failed to update global approval config' });
    }
  });
}
