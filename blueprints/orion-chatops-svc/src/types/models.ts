/**
 * ChatOps Models
 *
 * Entity types and factory functions for ChatOps domain objects.
 */

// ==================== Command ====================

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
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    subcommand: input.subcommand ?? '',
    schema: input.schema ?? {},
    aliases: input.aliases ?? [],
    permissionLevel: input.permissionLevel ?? 'user',
    examples: input.examples ?? [],
  };
}

// ==================== Execution ====================

export type ChatOpsExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface ChatOpsExecution {
  id: string;
  commandId: string;
  userId: string;
  platform: string;
  channel: string;
  params?: Record<string, unknown>;
  status: ChatOpsExecutionStatus;
  startTime: Date;
  endTime: Date | null;
  result?: Record<string, unknown>;
  milestones?: Record<string, string>;
}

export interface ChatOpsExecutionCreateInput {
  commandId: string;
  userId: string;
  platform: string;
  channel?: string;
  params?: Record<string, unknown>;
}

export function createChatOpsExecution(input: ChatOpsExecutionCreateInput): ChatOpsExecution {
  return {
    id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    commandId: input.commandId,
    userId: input.userId,
    platform: input.platform,
    channel: input.channel ?? 'chatops',
    params: input.params,
    status: 'running',
    startTime: new Date(),
    endTime: null,
    result: {},
    milestones: {},
  };
}

// ==================== Session ====================

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

// ==================== Audit Log ====================

export interface ChatOpsAuditLog {
  id: string;
  traceId: string;
  actor: Record<string, unknown>;
  timestamp: Date;
  action: Record<string, unknown>;
  result: string;
  context?: Record<string, unknown>;
}

export interface ChatOpsAuditLogCreateInput {
  traceId: string;
  actor: Record<string, unknown>;
  action: Record<string, unknown>;
  result: string;
  context?: Record<string, unknown>;
}

export function createChatOpsAuditLog(input: ChatOpsAuditLogCreateInput): ChatOpsAuditLog {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    traceId: input.traceId,
    actor: input.actor,
    timestamp: new Date(),
    action: input.action,
    result: input.result,
    context: input.context,
  };
}

// ==================== Message ====================

export interface ChatOpsMessage {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: Date;
}

// ==================== Notification Preference ====================

export interface ChatOpsNotificationPreference {
  id: string;
  userId: string;
  alertLevel: 'critical' | 'warning' | 'info';
  channelChatops: boolean;
  channelEmail: boolean;
  channelSlack: boolean;
  channelFeishu: boolean;
  channelDingtalk: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== DND Settings ====================

export interface ChatOpsDNDSettings {
  id: string;
  userId: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  repeatDays: number[];
  allowCritical: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Alert State ====================

export interface ChatOpsAlertState {
  id: string;
  userId: string;
  alertId: string;
  state: 'unread' | 'read' | 'acknowledged' | 'dismissed';
  readAt: Date | null;
  dismissedAt: Date | null;
  escalationStopped: boolean;
  escalationCurrentLevel: number;
  createdAt: Date;
}

// ==================== Platform Config ====================

export interface ChatOpsPlatformConfig {
  id: string;
  userId: string;
  platform: 'dingtalk' | 'wecom' | 'feishu' | 'slack';
  enabled: boolean;
  webhook: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
}
