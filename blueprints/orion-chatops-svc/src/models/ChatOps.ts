/**
 * ChatOps Domain Models
 *
 * Domain types and factory functions for ChatOps entities.
 */

export type ChatOpsExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ChatOpsExecution {
  id: string;
  commandId: string;
  userId: string;
  platform: string;
  channel: string;
  params: Record<string, any>;
  status: ChatOpsExecutionStatus;
  startTime: Date;
  endTime: Date | null;
  result: Record<string, any>;
  milestones: Record<string, any>;
}

export interface ChatOpsExecutionCreateInput {
  commandId: string;
  userId: string;
  platform: string;
  channel: string;
  params?: Record<string, any>;
}

export function createChatOpsExecution(input: ChatOpsExecutionCreateInput): ChatOpsExecution {
  return {
    id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    commandId: input.commandId,
    userId: input.userId,
    platform: input.platform,
    channel: input.channel,
    params: input.params ?? {},
    status: 'running',
    startTime: new Date(),
    endTime: null,
    result: {},
    milestones: {},
  };
}

export interface ChatOpsSession {
  key: string;
  userId: string;
  channelId: string;
  history: Record<string, any>[];
  state: Record<string, any>;
}

export interface ChatOpsSessionCreateInput {
  key: string;
  userId: string;
  channelId: string;
}

export function createChatOpsSession(input: ChatOpsSessionCreateInput): ChatOpsSession {
  return {
    key: input.key,
    userId: input.userId,
    channelId: input.channelId,
    history: [],
    state: {},
  };
}

export interface ChatOpsAuditLog {
  id: string;
  traceId: string;
  actor: Record<string, any>;
  timestamp: Date;
  action: Record<string, any>;
  result: string;
  context: Record<string, any>;
}

export interface ChatOpsAuditLogCreateInput {
  traceId: string;
  actor: Record<string, any>;
  action: Record<string, any>;
  result: string;
  context?: Record<string, any>;
}

export function createChatOpsAuditLog(input: ChatOpsAuditLogCreateInput): ChatOpsAuditLog {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    traceId: input.traceId,
    actor: input.actor,
    timestamp: new Date(),
    action: input.action,
    result: input.result,
    context: input.context ?? {},
  };
}
