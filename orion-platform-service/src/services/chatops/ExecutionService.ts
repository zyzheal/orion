/**
 * ChatOps Execution Service - Command execution, tracking, audit
 */

import { v4 as uuidv4 } from 'uuid';
import { EventBusService } from '../event-bus-service';
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
  private executions: Map<string, ChatOpsExecution> = new Map();
  private sessions: Map<string, ChatOpsSession> = new Map();
  private auditLogs: Map<string, ChatOpsAuditLog> = new Map();
  private commandService: CommandService;
  private eventBus?: EventBusService;

  constructor(options: { commandService: CommandService; eventBus?: EventBusService }) {
    this.commandService = options.commandService;
    this.eventBus = options.eventBus;
  }

  // ==================== Execution ====================

  async execute(input: ChatOpsExecutionCreateInput): Promise<ChatOpsExecution> {
    const execution = createChatOpsExecution(input);
    this.executions.set(execution.id, execution);

    // Simulate execution
    execution.status = 'running';
    execution.milestones = { started: new Date().toISOString() };
    this.executions.set(execution.id, execution);

    // Look up command for additional context
    const command = await this.commandService.getByName(input.commandId);

    // Simulate completion
    try {
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.result = {
        output: `Command ${input.commandId} executed successfully`,
        exitCode: 0,
        durationMs: execution.endTime.getTime() - execution.startTime.getTime(),
      };
      execution.milestones = {
        started: execution.startTime.toISOString(),
        completed: execution.endTime.toISOString(),
      };
      this.executions.set(execution.id, execution);

      // Create audit log
      await this.createAuditLog({
        traceId: execution.id,
        actor: { userId: input.userId, platform: input.platform },
        action: { command: input.commandId, params: input.params, channel: input.channel },
        result: 'success',
        context: { executionId: execution.id },
      });
    } catch (err) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.result = {
        error: err instanceof Error ? err.message : 'Unknown error',
        exitCode: 1,
      };
      execution.milestones = {
        started: execution.startTime.toISOString(),
        failed: execution.endTime.toISOString(),
      };
      this.executions.set(execution.id, execution);

      await this.createAuditLog({
        traceId: execution.id,
        actor: { userId: input.userId, platform: input.platform },
        action: { command: input.commandId, params: input.params },
        result: 'failed',
        context: { executionId: execution.id, error: err instanceof Error ? err.message : 'Unknown' },
      });
    }

    await this.eventBus?.publish('chatops.execution.completed', {
      executionId: execution.id,
      commandId: execution.commandId,
      status: execution.status,
    });

    return execution;
  }

  async getById(id: string): Promise<ChatOpsExecution | undefined> {
    return this.executions.get(id);
  }

  async list(filter: ChatOpsExecutionListFilter = {}): Promise<{ executions: ChatOpsExecution[]; total: number }> {
    let items = Array.from(this.executions.values());

    if (filter.commandId) {
      items = items.filter(e => e.commandId === filter.commandId);
    }
    if (filter.userId) {
      items = items.filter(e => e.userId === filter.userId);
    }
    if (filter.status) {
      items = items.filter(e => e.status === filter.status);
    }
    if (filter.platform) {
      items = items.filter(e => e.platform === filter.platform);
    }

    const total = items.length;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    const start = (page - 1) * perPage;
    items = items.slice(start, start + perPage);

    return { executions: items, total };
  }

  // ==================== Session ====================

  async createSession(input: ChatOpsSessionCreateInput): Promise<ChatOpsSession> {
    const session = createChatOpsSession(input);
    this.sessions.set(session.key, session);
    return session;
  }

  async getSession(key: string): Promise<ChatOpsSession | undefined> {
    return this.sessions.get(key);
  }

  async updateSession(key: string, updates: { history?: Record<string, unknown>[]; state?: Record<string, unknown> }): Promise<ChatOpsSession | undefined> {
    const session = this.sessions.get(key);
    if (!session) return undefined;

    if (updates.history) session.history = updates.history;
    if (updates.state) session.state = updates.state;
    this.sessions.set(key, session);
    return session;
  }

  // ==================== Audit ====================

  private async createAuditLog(input: ChatOpsAuditLogCreateInput): Promise<ChatOpsAuditLog> {
    const log = createChatOpsAuditLog(input);
    this.auditLogs.set(log.id, log);
    return log;
  }

  async getAuditLogs(filter: ChatOpsAuditLogFilter = {}): Promise<{ logs: ChatOpsAuditLog[]; total: number }> {
    let items = Array.from(this.auditLogs.values());

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
    items = items.slice(start, start + perPage);

    return { logs: items, total };
  }

  async getAuditStats(): Promise<Record<string, unknown>> {
    const allLogs = Array.from(this.auditLogs.values());

    const totalCount = allLogs.length;
    const successCount = allLogs.filter(l => l.result === 'success').length;
    const failedCount = allLogs.filter(l => l.result === 'failed').length;

    // Count by action type
    const actionCounts: Record<string, number> = {};
    for (const log of allLogs) {
      const action = log.action as Record<string, string>;
      const cmd = action.command || 'unknown';
      actionCounts[cmd] = (actionCounts[cmd] || 0) + 1;
    }

    // Count by platform
    const platformCounts: Record<string, number> = {};
    for (const log of allLogs) {
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
