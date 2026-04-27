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
import { NotificationPreferenceService } from '../services/chatops/NotificationPreferenceService';
import { DNDService } from '../services/chatops/DNDService';
import { AlertStateService } from '../services/chatops/AlertStateService';
import { ChatOpsEventSubscriber } from '../services/chatops/EventSubscriber';
import { SSEConnectionManager } from '../services/chatops/SSEConnectionManager';

interface ChatOpsRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
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
    eventBus: options.eventBus,
    repository: commandRepo,
  });

  // CommandRouter: 空服务映射 (Phase 1 目标服务未就绪，使用内置 handler)
  const serviceMap = new Map<string, any>();
  const commandRouter = new CommandRouter(serviceMap);

  const executionService = new ExecutionService({
    commandService,
    eventBus: options.eventBus,
    executionRepo,
    sessionRepo,
    auditRepo,
    commandRouter,
  });

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
  const controller = new ChatOpsController({
    commandService,
    executionService,
    messageRepo,
    recommendationService,
    notifPrefService,
    dndService,
    alertStateService,
    eventSubscriber,
  });

  // Seed default commands
  await commandService.seedDefaults();

  // ==================== Commands ====================

  app.get('/commands', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listCommands(request, reply);
  });

  app.get('/commands/:name/help', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCommandHelp(request, reply);
  });

  // ==================== Execution ====================

  app.post('/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeCommand(request, reply);
  });

  app.get('/status/:commandId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.checkExecutionStatus(request, reply);
  });

  // ==================== Webhook ====================

  app.post('/message', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.receiveMessage(request, reply);
  });

  // ==================== Recommendations (Phase 1a) ====================

  app.post('/recommendations', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRecommendations(request, reply);
  });

  // ==================== Sessions / Messages (Phase 1a) ====================

  app.get('/sessions/:id/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSessionMessages(request, reply);
  });

  // ==================== SSE Stream (Phase 1a) ====================

  app.get('/stream/recommendations', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.streamRecommendations(request, reply, connectionManager, eventSubscriber);
  });

  // ==================== Notification Preferences (Phase 1a) ====================

  app.get('/settings/notification-preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getNotificationPreferences(request, reply);
  });

  app.put('/settings/notification-preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateNotificationPreferences(request, reply);
  });

  // ==================== DND Settings (Phase 1a) ====================

  app.get('/settings/dnd', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDNDSettings(request, reply);
  });

  app.put('/settings/dnd', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateDNDSettings(request, reply);
  });

  app.patch('/settings/dnd/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.toggleDND(request, reply);
  });

  // ==================== Alert States (Phase 1a) ====================

  app.get('/alerts/states', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAlertStates(request, reply);
  });

  app.post('/alerts/:id/read', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.markAlertRead(request, reply);
  });

  app.post('/alerts/:id/acknowledge', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.markAlertAcknowledged(request, reply);
  });

  app.post('/alerts/:id/dismiss', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.markAlertDismissed(request, reply);
  });

  // ==================== Audit ====================

  app.get('/audit/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditLogs(request, reply);
  });

  app.get('/audit/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditStats(request, reply);
  });

  app.post('/audit/export', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.exportAuditLogs(request, reply);
  });
}
