/**
 * ChatOps API Service
 * Command browsing, execution monitoring, audit logs, and settings
 */
import { api } from './client';

// ---- Types ----

export interface ChatOpsCommand {
  id: string;
  name: string;
  subcommand?: string;
  permissionLevel: 'admin' | 'maintainer' | 'developer' | 'viewer';
  description: string;
  examples: string[];
  parameters?: Record<string, { type: string; required: boolean; description: string }>;
}

export interface ChatOpsExecution {
  id: string;
  command: string;
  userId: string;
  platform: 'dingtalk' | 'wecom' | 'feishu' | 'slack' | 'cli';
  status: 'running' | 'success' | 'failed' | 'timeout';
  startTime: string;
  endTime?: string;
  result?: string;
  errorMessage?: string;
  durationMs?: number;
}

export interface CommandExecutionInput {
  command: string;
  args?: string[];
  platform?: string;
  userId?: string;
}

export interface AuditLog {
  id: string;
  command: string;
  userId: string;
  platform: string;
  action: string;
  timestamp: string;
  details?: string;
}

export interface AuditStats {
  totalExecutions: number;
  successRate: number;
  topCommands: { command: string; count: number }[];
  topUsers: { userId: string; count: number }[];
  platformBreakdown: { platform: string; count: number }[];
}

export interface CommandListParams {
  permissionLevel?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

export interface ExecutionListParams {
  command?: string;
  platform?: string;
  status?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
}

export interface AuditLogListParams {
  command?: string;
  userId?: string;
  platform?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
}

export interface AuditStatsParams {
  startDate?: string;
  endDate?: string;
}

// ---- Commands ----

export function getCommands(params?: CommandListParams) {
  return api.get('/v1/chatops/commands', { params });
}

export function getCommandHelp(name: string) {
  return api.get(`/v1/chatops/commands/${name}/help`);
}

export function executeCommand(data: CommandExecutionInput) {
  return api.post('/v1/chatops/execute', data);
}

export function getCommandStatus(id: string) {
  return api.get(`/v1/chatops/executions/${id}`);
}

// ---- Audit ----

export function getAuditLogs(params?: AuditLogListParams) {
  return api.get('/v1/chatops/audit/logs', { params });
}

export function getAuditStats(params?: AuditStatsParams) {
  return api.get('/v1/chatops/audit/stats', { params });
}

export function exportAuditLogs(data: { startDate: string; endDate: string; format?: string }) {
  return api.post('/v1/chatops/audit/export', data);
}

// ---- Settings ----

export function getChatOpsSettings() {
  return api.get('/v1/chatops/settings');
}

export function updateChatOpsSettings(data: Record<string, unknown>) {
  return api.put('/v1/chatops/settings', data);
}
