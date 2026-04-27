/**
 * ChatOps Controller - Fastify HTTP request/response handlers
 *
 * Phase 1a: Added recommendations, sessions/messages, settings, alerts, SSE
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { CommandService } from '../../services/chatops/CommandService';
import { ExecutionService } from '../../services/chatops/ExecutionService';
import { RecommendationService } from '../../services/chatops/RecommendationService';
import { NotificationPreferenceService } from '../../services/chatops/NotificationPreferenceService';
import { DNDService } from '../../services/chatops/DNDService';
import { AlertStateService } from '../../services/chatops/AlertStateService';
import { ChatOpsMessageRepository } from '../../repositories/ChatOpsRepository';
import { ChatOpsEventSubscriber } from '../../services/chatops/EventSubscriber';
import { SSEConnectionManager } from '../../services/chatops/SSEConnectionManager';
import {
  WebhookVerifier,
  isFeishuChallenge,
} from '../../services/chatops/WebhookVerifier';

export class ChatOpsController {
  private commandService: CommandService;
  private executionService: ExecutionService;
  private messageRepo: ChatOpsMessageRepository;
  private recommendationService: RecommendationService;
  private notifPrefService: NotificationPreferenceService;
  private dndService: DNDService;
  private alertStateService: AlertStateService;
  // 可选的 eventSubscriber，用于按角色过滤推荐面板
  private eventSubscriber: ChatOpsEventSubscriber | null;

  constructor(options: {
    commandService: CommandService;
    executionService: ExecutionService;
    messageRepo: ChatOpsMessageRepository;
    recommendationService: RecommendationService;
    notifPrefService: NotificationPreferenceService;
    dndService: DNDService;
    alertStateService: AlertStateService;
    eventSubscriber?: ChatOpsEventSubscriber | null;
  }) {
    this.commandService = options.commandService;
    this.executionService = options.executionService;
    this.messageRepo = options.messageRepo;
    this.recommendationService = options.recommendationService;
    this.notifPrefService = options.notifPrefService;
    this.dndService = options.dndService;
    this.alertStateService = options.alertStateService;
    this.eventSubscriber = options.eventSubscriber ?? null;
  }

  // ==================== Helpers ====================

  /**
   * P2-4: Unified JWT user extraction
   * All controller methods should use this instead of reading from body/query
   */
  protected getUser(request: FastifyRequest): { userId: string; username: string; role: string } | null {
    const user = (request as any).user as { userId: string; username: string; role: string } | undefined;
    if (!user) return null;
    return user;
  }

  // ==================== Commands ====================

  async listCommands(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string>;
      const { commands, total } = await this.commandService.list({
        permissionLevel: query.permissionLevel,
        name: query.name,
        page: query.page ? parseInt(query.page) : undefined,
        perPage: query.perPage ? parseInt(query.perPage) : undefined,
      });

      await reply.send({ success: true, data: commands, total });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getCommandHelp(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { name: string };
      const help = await this.commandService.getHelp(params.name);
      if (!help) {
        await reply.status(404).send({ success: false, error: 'Command not found' });
        return;
      }
      await reply.send({ success: true, data: help });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Execution ====================

  async executeCommand(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      // P2-4: Use unified getUser() helper
      const user = this.getUser(request);
      if (!user) {
        await reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
        return;
      }
      if (!body.command) {
        await reply.status(400).send({
          success: false,
          error: 'command 是必填字段',
        });
        return;
      }

      // Verify command exists
      const command = await this.commandService.getByName(body.command as string);
      if (!command) {
        await reply.status(404).send({ success: false, error: 'Command not found' });
        return;
      }

      const execution = await this.executionService.execute({
        commandId: body.command as string,
        userId: user.userId,
        platform: 'web',
        channel: body.channel as string ?? 'chatops-panel',
        params: body.params as Record<string, unknown> | undefined,
      });

      await reply.status(201).send({ success: true, data: execution });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to execute command',
      });
    }
  }

  async checkExecutionStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { commandId: string };
      const execution = await this.executionService.getById(params.commandId);
      if (!execution) {
        await reply.status(404).send({ success: false, error: 'Execution not found' });
        return;
      }
      await reply.send({ success: true, data: execution });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Webhook ====================

  /**
   * 接收 IM 平台 Webhook 消息
   *
   * 流程：
   * 1. 飞书 Challenge 验证：特殊处理，返回 challenge
   * 2. 签名验证：生产环境强制验证，开发环境可跳过
   * 3. 验证失败返回 403
   * 4. 验证成功后从签名上下文中提取 userId（而非从 body 读）
   */
  async receiveMessage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      const query = (request.query ?? {}) as Record<string, string | undefined>;
      const headers: Record<string, string | undefined> = {};
      // 提取关键请求头
      const headerKeys = ['x-im-platform', 'X-IM-Platform'];
      for (const key of headerKeys) {
        const value = (request.headers as Record<string, string | undefined>)[key];
        if (value) headers[key] = value;
      }

      // --- 飞书 Challenge 验证（URL 配置阶段） ---
      if (isFeishuChallenge(body)) {
        if (!WebhookVerifier.shouldVerify()) {
          // 开发/测试环境：直接返回 challenge
          await reply.send({ challenge: body.challenge });
          return;
        }
        // 生产环境：需通过 token 验证
        const result = WebhookVerifier.verifyFeishu(body);
        if (!result.valid) {
          await reply.status(403).send({
            success: false,
            error: result.error,
          });
          return;
        }
        await reply.send({ challenge: body.challenge });
        return;
      }

      // --- 签名验证 ---
      if (WebhookVerifier.shouldVerify()) {
        const result = WebhookVerifier.verify(body, query, headers);
        if (!result.valid) {
          await reply.status(403).send({
            success: false,
            error: `Webhook signature verification failed: ${result.error}`,
          });
          return;
        }

        // 验证成功，使用签名上下文中的 userId
        const userId = result.userId || 'webhook-anonymous';
        const platform = result.platform;
        const channel = (body.channel || 'default') as string;

        // Parse incoming IM message
        const text = (body.text || body.message || '') as string;
        const { command, params } = await this.commandService.parseCommand(text);

        if (!command) {
          await reply.status(400).send({
            success: false,
            error: 'Unknown command. Use /help for available commands.',
          });
          return;
        }

        const execution = await this.executionService.execute({
          commandId: command.name,
          userId,
          platform,
          channel,
          params: params as Record<string, unknown>,
        });

        await reply.status(201).send({ success: true, data: execution, command });
      } else {
        // 开发/测试环境：跳过签名验证
        const user = (request as any).user as { userId: string } | undefined;
        const userId = user?.userId || (body.user_id || body.userId || 'anonymous') as string;
        const platform = (body.platform || 'webhook') as string;
        const channel = (body.channel || 'default') as string;

        // Parse incoming IM message
        const text = (body.text || body.message || '') as string;
        const { command, params } = await this.commandService.parseCommand(text);

        if (!command) {
          await reply.status(400).send({
            success: false,
            error: 'Unknown command. Use /help for available commands.',
          });
          return;
        }

        const execution = await this.executionService.execute({
          commandId: command.name,
          userId,
          platform,
          channel,
          params: params as Record<string, unknown>,
        });

        await reply.status(201).send({ success: true, data: execution, command });
      }
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to process message',
      });
    }
  }

  // ==================== Audit ====================

  async getAuditLogs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string>;
      const { logs, total } = await this.executionService.getAuditLogs({
        traceId: query.traceId,
        actor: query.actor,
        result: query.result,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        page: query.page ? parseInt(query.page) : undefined,
        perPage: query.perPage ? parseInt(query.perPage) : undefined,
      });

      await reply.send({ success: true, data: logs, total });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getAuditStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const stats = await this.executionService.getAuditStats();
      await reply.send({ success: true, data: stats });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async exportAuditLogs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown> | undefined;
      const logs = await this.executionService.exportAuditLogs({
        traceId: body?.traceId as string | undefined,
        actor: body?.actor as string | undefined,
        result: body?.result as string | undefined,
        startDate: body?.startDate ? new Date(body.startDate as string) : undefined,
        endDate: body?.endDate ? new Date(body.endDate as string) : undefined,
      });

      await reply.send({ success: true, data: logs, total: logs.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Recommendations (Phase 1a) ====================

  async getRecommendations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = this.getUser(request);
      if (!user) {
        await reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
        return;
      }
      const body = request.body as { context?: { currentPage?: string; resourceId?: string } };
      // 优先使用 eventSubscriber 按角色过滤推荐（实时事件驱动）
      // 若无 eventSubscriber，回退到 recommendationService
      const recommendations = this.eventSubscriber
        ? this.eventSubscriber.getFilteredRecommendations(user.role)
        : await this.recommendationService.getRecommendations(user.userId, user.role);
      await reply.send({ success: true, data: recommendations, total: recommendations.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Sessions / Messages (Phase 1a) ====================

  async getSessionMessages(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const query = request.query as { limit?: string; cursor?: string };
      const { messages, hasMore } = await this.messageRepo.findBySession(params.id, {
        limit: query.limit ? parseInt(query.limit) : 50,
        cursor: query.cursor,
      });
      await reply.send({
        success: true,
        data: messages,
        hasMore,
        nextCursor: hasMore ? messages[messages.length - 1]?.createdAt.toISOString() : null,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== SSE Stream (Phase 1a) ====================

  async streamRecommendations(
    request: FastifyRequest,
    reply: FastifyReply,
    connectionManager: SSEConnectionManager | null,
    eventSubscriber: ChatOpsEventSubscriber | null,
  ): Promise<void> {
    const user = (request as any).user as { userId: string } | undefined;
    if (!user) {
      await reply.code(401).send({ error: 'UNAUTHORIZED' });
      return;
    }

    // SSE headers
    reply.header('Content-Type', 'text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');
    reply.header('X-Accel-Buffering', 'no');

    // Send connection confirmation
    try {
      reply.raw.write('event: connected\ndata: {"status":"ok"}\n\n');
    } catch {
      return;
    }

    // Send initial snapshot
    const initialRecs = eventSubscriber?.getActiveRecommendations() ?? [];
    try {
      reply.raw.write(
        `event: recommendations\ndata: ${JSON.stringify({ recommendations: initialRecs })}\n\n`,
      );
    } catch {
      return;
    }

    // Set up listener for updates
    const connId = `${user.userId}:${Date.now()}`;
    const listener = (data: Record<string, unknown>) => {
      const raw = (reply as any).raw;
      if (raw?.writableEnded) {
        connectionManager?.removeConnection(connId);
        return;
      }
      try {
        raw.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        connectionManager?.removeConnection(connId);
      }
    };

    // Register with connection manager for heartbeat + event forwarding
    connectionManager?.addConnection(
      { id: connId, userId: user.userId, listener, connectedAt: new Date() },
      reply,
    );
  }

  // ==================== Notification Preferences (Phase 1a) ====================

  async getNotificationPreferences(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = this.getUser(request);
      if (!user) {
        await reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
        return;
      }
      const prefs = await this.notifPrefService.listByUserId(user.userId);
      await reply.send({ success: true, data: prefs });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async updateNotificationPreferences(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = this.getUser(request);
      if (!user) {
        await reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
        return;
      }
      const body = request.body as {
        alertLevel: 'critical' | 'warning' | 'info';
        channelChatops?: boolean;
        channelEmail?: boolean;
        channelSlack?: boolean;
        channelFeishu?: boolean;
        channelDingtalk?: boolean;
      };
      const pref = await this.notifPrefService.upsert({ userId: user.userId, ...body });
      await reply.status(201).send({ success: true, data: pref });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== DND Settings (Phase 1a) ====================

  async getDNDSettings(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = this.getUser(request);
      if (!user) {
        await reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
        return;
      }
      const settings = await this.dndService.getSettings(user.userId);
      await reply.send({ success: true, data: settings });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async updateDNDSettings(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = this.getUser(request);
      if (!user) {
        await reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
        return;
      }
      const body = request.body as Partial<{
        enabled: boolean;
        startTime: string;
        endTime: string;
        repeatDays: number[];
        allowCritical: boolean;
      }>;
      const settings = await this.dndService.updateSettings(user.userId, body);
      await reply.send({ success: true, data: settings });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async toggleDND(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = this.getUser(request);
      if (!user) {
        await reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
        return;
      }
      const body = request.body as { enabled: boolean };
      const settings = await this.dndService.toggleDND(user.userId, body.enabled);
      await reply.send({ success: true, data: settings });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Alert States (Phase 1a) ====================

  async getAlertStates(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = this.getUser(request);
      if (!user) {
        await reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
        return;
      }
      const states = await this.alertStateService.listByUserId(user.userId);
      await reply.send({ success: true, data: states });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async markAlertRead(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = this.getUser(request);
      if (!user) {
        await reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
        return;
      }
      const params = request.params as { id: string };
      await this.alertStateService.markAsRead(user.userId, params.id);
      await reply.send({ success: true });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async markAlertAcknowledged(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = this.getUser(request);
      if (!user) {
        await reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
        return;
      }
      const params = request.params as { id: string };
      await this.alertStateService.markAsAcknowledged(user.userId, params.id);
      await reply.send({ success: true });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async markAlertDismissed(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = this.getUser(request);
      if (!user) {
        await reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
        return;
      }
      const params = request.params as { id: string };
      await this.alertStateService.markAsDismissed(user.userId, params.id);
      await reply.send({ success: true });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }
}
