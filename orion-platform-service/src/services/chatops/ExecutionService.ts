/**
 * ChatOps Execution Service - Command execution, tracking, audit
 *
 * Migrated to PostgreSQL Repository pattern.
 * All state is persisted to database; no in-memory Map storage.
 *
 * ARCH-004: 事件发布添加完整错误处理
 */

import { EventBusService, EventBusError } from '../event-bus-service';
import {
  ChatOpsExecution,
  ChatOpsExecutionCreateInput,
  ChatOpsExecutionStatus,
  createChatOpsExecution,
  ChatOpsSession,
  ChatOpsSessionCreateInput,
  createChatOpsSession,
  ChatOpsAuditLog,
  ChatOpsAuditLogCreateInput,
  createChatOpsAuditLog,
} from '../../models/ChatOps';
import { CommandService } from './CommandService';
import { CommandRouter } from './CommandRouter';
import { InputValidator, ParsedCommand } from './InputValidator';
import pino from 'pino';
import { OrionError } from '../../errors';

const logger = pino({ name: 'LExecution-LService' });
import {
  ChatOpsExecutionRepository,
  ChatOpsSessionRepository,
  ChatOpsAuditLogRepository,
  ChatOpsExecutionEntity,
  ChatOpsAuditLogEntity,
} from '../../repositories/ChatOpsRepository';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

/** ARCH-004: 事件发布结果 */
interface EventPublishResult {
  success: boolean;
  eventId?: string;
  fallback?: boolean;
  error?: string;
}

export interface ChatOpsExecutionListFilter {
  commandId?: string;
  userId?: string;
  status?: ChatOpsExecutionStatus;
  platform?: string;
  page?: number;
  perPage?: number;
}

export interface ChatOpsAuditLogFilter {
  traceId?: string;
  actor?: string;
  action?: string;
  result?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  perPage?: number;
}

export class ExecutionService {
  private executionRepo: ChatOpsExecutionRepository;
  private sessionRepo: ChatOpsSessionRepository;
  private auditRepo: ChatOpsAuditLogRepository;
  private commandService: CommandService;
  private eventBus?: EventBusService;
  /** 命令路由器 (可选，用于路由到真实命令处理器) */
  private commandRouter?: CommandRouter;
  /** 输入校验器 (可选，用于安全校验) */
  private inputValidator?: InputValidator;

  constructor(options: {
    commandService: CommandService;
    eventBus?: EventBusService;
    executionRepo: ChatOpsExecutionRepository;
    sessionRepo: ChatOpsSessionRepository;
    auditRepo: ChatOpsAuditLogRepository;
    commandRouter?: CommandRouter;
    inputValidator?: InputValidator;
  }) {
    this.commandService = options.commandService;
    this.eventBus = options.eventBus;
    this.executionRepo = options.executionRepo;
    this.sessionRepo = options.sessionRepo;
    this.auditRepo = options.auditRepo;
    this.commandRouter = options.commandRouter;
    this.inputValidator = options.inputValidator;
  }

  // ==================== Entity -> Model mapping ====================

  private entityToExecution(entity: ChatOpsExecutionEntity): ChatOpsExecution {
    return {
      id: entity.id,
      commandId: entity.commandId,
      userId: entity.userId,
      platform: entity.platform,
      channel: entity.channel,
      params: entity.params,
      status: entity.status as ChatOpsExecutionStatus,
      startTime: entity.startTime,
      endTime: entity.endTime,
      result: entity.result,
      milestones: entity.milestones,
    };
  }

  private entityToAuditLog(entity: ChatOpsAuditLogEntity): ChatOpsAuditLog {
    return {
      id: entity.id,
      traceId: entity.traceId,
      actor: entity.actor,
      timestamp: entity.timestamp,
      action: entity.action,
      result: entity.result,
      context: entity.context,
    };
  }

  // ==================== Execution ====================

  async execute(input: ChatOpsExecutionCreateInput): Promise<ChatOpsExecution> {
    // SE-1: 输入安全校验 (若有 InputValidator)
    if (this.inputValidator) {
      const parsed: ParsedCommand = {
        command: input.commandId,
        params: input.params ?? {},
      };
      // 构造原始输入字符串用于危险字符检查
      const rawInput = `/${input.commandId} ${Object.entries(input.params ?? {})
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(' ')}`;

      const validation = this.inputValidator.validate(rawInput, parsed);
      if (!validation.valid) {
        throw new OrionError(`输入校验失败: ${validation.error}`, 'OPERATION_FAILED')
      }
    }

    const execution = createChatOpsExecution(input);

    // Persist initial state
    await this.executionRepo.insert({
      command_id: execution.commandId,
      user_id: execution.userId,
      platform: execution.platform,
      channel: execution.channel,
      params: execution.params,
      status: 'running',
      start_time: execution.startTime,
      end_time: null,
      result: {},
      milestones: { started: new Date().toISOString() },
    });

    // Look up command for additional context
    const command = await this.commandService.getByName(input.commandId);

    const endTime = new Date();
    try {
      let executionResult: Record<string, unknown>;

      // 如果有 commandRouter，通过路由器执行命令；否则使用 mock 行为 (向后兼容)
      if (this.commandRouter) {
        executionResult = await this.commandRouter.routeAndExecute(
          input.commandId,
          input.params ?? {},
        );
      } else {
        // 向后兼容: 保持原有 mock 行为
        executionResult = {
          output: `Command ${input.commandId} executed successfully`,
          exitCode: 0,
          durationMs: endTime.getTime() - execution.startTime.getTime(),
        };
      }

      await this.executionRepo.updateStatus(
        execution.id,
        'completed',
        endTime,
        executionResult,
      );

      await this.executionRepo.update(execution.id, {
        milestones: {
          started: execution.startTime.toISOString(),
          completed: endTime.toISOString(),
        },
      } as any);

      // Create audit log
      await this.createAuditLog({
        traceId: execution.id,
        actor: { userId: input.userId, platform: input.platform },
        action: { command: input.commandId, params: input.params, channel: input.channel },
        result: 'success',
        context: { executionId: execution.id },
      });
    } catch (err) {
      await this.executionRepo.updateStatus(
        execution.id,
        'failed',
        endTime,
        {
          error: err instanceof Error ? err.message : 'Unknown error',
          exitCode: 1,
        },
      );

      await this.createAuditLog({
        traceId: execution.id,
        actor: { userId: input.userId, platform: input.platform },
        action: { command: input.commandId, params: input.params },
        result: 'failed',
        context: { executionId: execution.id, error: err instanceof Error ? err.message : 'Unknown' },
      });
    }

    // ARCH-004: 事件发布添加完整错误处理
    const eventResult = await this.publishExecutionEvent('chatops.execution.completed', {
      executionId: execution.id,
      commandId: execution.commandId,
      status: 'completed',
      userId: input.userId,
      platform: input.platform,
    });

    // ARCH-004: 记录事件发布失败（但不阻塞执行）
    if (!eventResult.success) {
      logger.warn('[ExecutionService] Event publish failed:', eventResult.error);
      if (eventResult.fallback) {
        logger.info('[ExecutionService] Event persisted for fallback retry, eventId:', eventResult.eventId);
      }
    }

    // Return updated execution from DB
    const updated = await this.executionRepo.findById(execution.id);
    return this.entityToExecution(updated!);
  }

  /**
   * ARCH-004: 安全发布事件，支持 fallback 模式
   */
  private async publishExecutionEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<EventPublishResult> {
    if (!this.eventBus) {
      return {
        success: false,
        error: 'EventBus not available',
      };
    }

    try {
      const eventId = await this.eventBus.publish(eventType, payload, {
        source: 'execution-service',
        publishedBy: 'ExecutionService',
      });

      // ARCH-004: 检查是否为 fallback 发布
      const isFallback = eventId.startsWith('fallback:');
      return {
        success: true,
        eventId,
        fallback: isFallback,
      };
    } catch (err: unknown) {
      // ARCH-004: 区分错误类型
      const errorMsg = err instanceof EventBusError
        ? `${err.code}: ${err.message}`
        : (err instanceof Error ? err.message : 'Unknown error');

      return {
        success: false,
        error: errorMsg,
        fallback: err instanceof EventBusError && err.recoverable,
      };
    }
  }

  async getById(id: string): Promise<ChatOpsExecution | undefined> {
    const entity = await this.executionRepo.findById(id);
    return entity ? this.entityToExecution(entity) : undefined;
  }

  async list(filter: ChatOpsExecutionListFilter = {}): Promise<{ executions: ChatOpsExecution[]; total: number }> {
    let entities: ChatOpsExecutionEntity[];

    if (filter.commandId) {
      entities = await this.executionRepo.findByCommandId(filter.commandId);
    } else if (filter.userId) {
      entities = await this.executionRepo.findByUser(filter.userId);
    } else if (filter.status) {
      entities = await this.executionRepo.findByStatus(filter.status);
    } else {
      const result = await this.executionRepo.findAll({ limit: 1000 });
      entities = result.entities;
    }

    if (filter.platform) {
      entities = entities.filter(e => e.platform === filter.platform);
    }

    const total = entities.length;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    const start = (page - 1) * perPage;
    const paginated = entities.slice(start, start + perPage);

    return { executions: paginated.map(e => this.entityToExecution(e)), total };
  }

  // ==================== Session ====================

  async createSession(input: ChatOpsSessionCreateInput): Promise<ChatOpsSession> {
    const session = createChatOpsSession(input);

    await this.sessionRepo.insert({
      key: session.key,
      user_id: session.userId,
      channel_id: session.channelId,
      history: [],
      state: {},
    });

    return session;
  }

  async getSession(key: string): Promise<ChatOpsSession | undefined> {
    const entity = await this.sessionRepo.findByKey(key);
    if (!entity) return undefined;
    return {
      key: entity.key,
      userId: entity.userId,
      channelId: entity.channelId,
      history: entity.history,
      state: entity.state,
    };
  }

  async updateSession(key: string, updates: { history?: Record<string, unknown>[]; state?: Record<string, unknown> }): Promise<ChatOpsSession | undefined> {
    const entity = await this.sessionRepo.findByKey(key);
    if (!entity) return undefined;

    await this.sessionRepo.updateState(key, updates.state ?? entity.state, updates.history ?? entity.history);

    return {
      key,
      userId: entity.userId,
      channelId: entity.channelId,
      history: updates.history ?? entity.history,
      state: updates.state ?? entity.state,
    };
  }

  // ==================== Audit ====================

  private async createAuditLog(input: ChatOpsAuditLogCreateInput): Promise<ChatOpsAuditLog> {
    const log = createChatOpsAuditLog(input);

    const entity = await this.auditRepo.insert({
      trace_id: log.traceId,
      actor: log.actor,
      timestamp: log.timestamp,
      action: log.action,
      result: log.result,
      context: log.context,
    });

    return this.entityToAuditLog(entity);
  }

  async getAuditLogs(filter: ChatOpsAuditLogFilter = {}): Promise<{ logs: ChatOpsAuditLog[]; total: number }> {
    const result = await this.auditRepo.findAll({ limit: 1000, orderBy: 'timestamp', orderDir: 'DESC' });
    let items = result.entities;

    if (filter.traceId) {
      items = items.filter(l => l.traceId === filter.traceId);
    }
    if (filter.actor) {
      items = items.filter(l =>
        (l.actor as Record<string, string>).userId?.includes(filter.actor!) ||
        JSON.stringify(l.actor).includes(filter.actor!)
      );
    }
    if (filter.result) {
      items = items.filter(l => l.result === filter.result);
    }
    if (filter.startDate) {
      items = items.filter(l => l.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      items = items.filter(l => l.timestamp <= filter.endDate!);
    }

    const total = items.length;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    const start = (page - 1) * perPage;
    const paginated = items.slice(start, start + perPage);

    return { logs: paginated.map(e => this.entityToAuditLog(e)), total };
  }

  async getAuditStats(): Promise<Record<string, unknown>> {
    const totalCount = await this.auditRepo.countAll();
    const successCount = await this.auditRepo.countByResult('success');
    const failedCount = await this.auditRepo.countByResult('failed');

    // Count by action type - fetch recent logs for action breakdown
    const recentLogs = await this.auditRepo.findRecent(24);
    const actionCounts: Record<string, number> = {};
    for (const log of recentLogs) {
      const action = log.action as Record<string, string>;
      const cmd = action.command || 'unknown';
      actionCounts[cmd] = (actionCounts[cmd] || 0) + 1;
    }

    // Count by platform
    const platformCounts: Record<string, number> = {};
    for (const log of recentLogs) {
      const actor = log.actor as Record<string, string>;
      const platform = actor.platform || 'unknown';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    }

    return {
      totalExecutions: totalCount,
      successCount,
      failedCount,
      successRate: totalCount > 0 ? (successCount / totalCount * 100).toFixed(2) + '%' : '0%',
      actionCounts,
      platformCounts,
    };
  }

  async exportAuditLogs(filter: ChatOpsAuditLogFilter = {}): Promise<ChatOpsAuditLog[]> {
    const { logs } = await this.getAuditLogs(filter);
    return logs;
  }
}
