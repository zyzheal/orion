/**
 * ChatOps 数据模型
 *
 * M35: ChatOps Command, Execution, Session, Audit Log
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== ChatOpsCommand ====================

export interface ChatOpsCommand {
  id: string;
  name: string;
  subcommand: string;
  schema: Record<string, unknown>;
  aliases: string[];
  permissionLevel: string;
  examples: string[];
}

export interface ChatOpsCommandCreateInput {
  name: string;
  subcommand?: string;
  schema?: Record<string, unknown>;
  aliases?: string[];
  permissionLevel?: string;
  examples?: string[];
}

export function createChatOpsCommand(input: ChatOpsCommandCreateInput): ChatOpsCommand {
  return {
    id: uuidv4(),
    name: input.name,
    subcommand: input.subcommand ?? '',
    schema: input.schema ?? {},
    aliases: input.aliases ?? [],
    permissionLevel: input.permissionLevel ?? 'user',
    examples: input.examples ?? [],
  };
}

// ==================== ChatOpsExecution ====================

export type ChatOpsExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ChatOpsExecution {
  id: string;
  commandId: string;
  userId: string;
  platform: string;
  channel: string;
  params: Record<string, unknown>;
  status: ChatOpsExecutionStatus;
  startTime: Date;
  endTime: Date | null;
  result: Record<string, unknown>;
  milestones: Record<string, unknown>;
}

export interface ChatOpsExecutionCreateInput {
  commandId: string;
  userId: string;
  platform: string;
  channel: string;
  params?: Record<string, unknown>;
}

export function createChatOpsExecution(input: ChatOpsExecutionCreateInput): ChatOpsExecution {
  return {
    id: uuidv4(),
    commandId: input.commandId,
    userId: input.userId,
    platform: input.platform,
    channel: input.channel,
    params: input.params ?? {},
    status: 'pending',
    startTime: new Date(),
    endTime: null,
    result: {},
    milestones: {},
  };
}

// ==================== ChatOpsSession ====================

export interface ChatOpsSession {
  key: string;
  userId: string;
  channelId: string;
  history: Record<string, unknown>[];
  state: Record<string, unknown>;
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

// ==================== ChatOpsAuditLog ====================

export interface ChatOpsAuditLog {
  id: string;
  traceId: string;
  actor: Record<string, unknown>;
  timestamp: Date;
  action: Record<string, unknown>;
  result: string;
  context: Record<string, unknown>;
}

export interface ChatOpsAuditLogCreateInput {
  traceId: string;
  actor: Record<string, unknown>;
  action: Record<string, unknown>;
  result?: string;
  context?: Record<string, unknown>;
}

export function createChatOpsAuditLog(input: ChatOpsAuditLogCreateInput): ChatOpsAuditLog {
  return {
    id: uuidv4(),
    traceId: input.traceId,
    actor: input.actor,
    timestamp: new Date(),
    action: input.action,
    result: input.result ?? 'unknown',
    context: input.context ?? {},
  };
}
