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
  params?: Record<string, unknown>;
  platform?: string;
  userId?: string;
  channel?: string;
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
  return api.get(`/v1/chatops/status/${id}`);
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

// ---- Recommendations ----

export interface Recommendation {
  id: string;
  type: 'alert' | 'blocked' | 'deploy_result' | 'selfhealing' | 'cost_anomaly';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actions: Array<{ label: string; command: string; params: Record<string, unknown> }>;
  createdAt: string;
  source: string;
}

export function fetchRecommendations(context?: { currentPage?: string; resourceId?: string }) {
  return api.post('/v1/chatops/recommendations', { context });
}

// ---- Sessions / Messages ----

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function getSessionMessages(sessionId: string, params?: { limit?: number; cursor?: string }) {
  return api.get(`/v1/chatops/sessions/${sessionId}/messages`, { params });
}

// ---- Notification Preferences ----

export interface NotificationPreference {
  id: string;
  userId: string;
  alertLevel: 'critical' | 'warning' | 'info';
  channelChatops: boolean;
  channelEmail: boolean;
  channelSlack: boolean;
  channelFeishu: boolean;
  channelDingtalk: boolean;
}

export function getNotificationPreferences() {
  return api.get('/v1/chatops/settings/notification-preferences');
}

export function updateNotificationPreferences(data: {
  alertLevel: 'critical' | 'warning' | 'info';
  channelChatops?: boolean;
  channelEmail?: boolean;
  channelSlack?: boolean;
  channelFeishu?: boolean;
  channelDingtalk?: boolean;
}) {
  return api.put('/v1/chatops/settings/notification-preferences', data);
}

// ---- DND Settings ----

export interface DNDSettings {
  id: string;
  userId: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  repeatDays: number[];
  allowCritical: boolean;
}

export function getDNDSettings() {
  return api.get('/v1/chatops/settings/dnd');
}

export function updateDNDSettings(data: Partial<{
  enabled: boolean;
  startTime: string;
  endTime: string;
  repeatDays: number[];
  allowCritical: boolean;
}>) {
  return api.put('/v1/chatops/settings/dnd', data);
}

export function toggleDND(enabled: boolean) {
  return api.patch('/v1/chatops/settings/dnd/toggle', { enabled });
}

// ---- Alert States ----

export interface AlertState {
  id: string;
  userId: string;
  alertId: string;
  status: 'unread' | 'read' | 'acknowledged' | 'dismissed';
  title: string;
  severity: 'critical' | 'warning' | 'info';
  createdAt: string;
  updatedAt: string;
}

export function getAlertStates() {
  return api.get('/v1/chatops/alerts/states');
}

export function markAlertRead(alertId: string) {
  return api.post(`/v1/chatops/alerts/${alertId}/read`);
}

export function markAlertAcknowledged(alertId: string) {
  return api.post(`/v1/chatops/alerts/${alertId}/acknowledge`);
}

export function markAlertDismissed(alertId: string) {
  return api.post(`/v1/chatops/alerts/${alertId}/dismiss`);
}

// ---- SSE Stream ----

export interface SSEConnectionOptions {
  onMessage: (data: unknown) => void;
  onReconnect?: (attempt: number) => void;
  onError?: (error: Error) => void;
}

interface SSEConnectionState {
  eventSource: EventSource | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  attempt: number;
  disposed: boolean;
}

let sseState: SSEConnectionState | null = null;

/**
 * 计算指数退避延迟 (1s, 2s, 4s, 8s, ... 最大 30s)
 */
function getReconnectDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30_000);
}

/**
 * 建立 SSE 连接，支持断线自动重连
 */
export function connectSSE(options: SSEConnectionOptions): void {
  // 如果已有连接，先断开
  disconnectSSE();

  sseState = {
    eventSource: null,
    reconnectTimer: null,
    attempt: 0,
    disposed: false,
  };

  function doConnect(): void {
    if (sseState!.disposed) return;

    try {
      const es = new EventSource('/api/v1/chatops/stream/recommendations');
      sseState!.eventSource = es;

      es.onopen = () => {
        // 连接成功，重置重试计数
        sseState!.attempt = 0;
      };

      es.addEventListener('recommendations', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          options.onMessage(data);
        } catch {
          // 忽略解析错误
        }
      });

      // 监听未命名事件 (data-only messages)
      es.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          options.onMessage(data);
        } catch {
          // 忽略解析错误
        }
      };

      es.onerror = () => {
        es.close();
        sseState!.eventSource = null;

        if (sseState!.disposed) return;

        // 立即递增 attempt，确保退避延迟正确递增
        sseState!.attempt++;
        const delay = getReconnectDelay(sseState!.attempt);
        options.onError?.(new Error(`SSE 连接断开，${delay}ms 后重试 (第 ${sseState!.attempt} 次)`));

        sseState!.reconnectTimer = setTimeout(() => {
          if (sseState!.disposed) return;
          options.onReconnect?.(sseState!.attempt);
          doConnect();
        }, delay);
      };
    } catch (err) {
      options.onError?.(err instanceof Error ? err : new Error('SSE 连接失败'));
    }
  }

  doConnect();
}

/**
 * 断开 SSE 连接并清理资源
 */
export function disconnectSSE(): void {
  if (sseState) {
    sseState.disposed = true;

    if (sseState.eventSource) {
      sseState.eventSource.close();
      sseState.eventSource = null;
    }

    if (sseState.reconnectTimer) {
      clearTimeout(sseState.reconnectTimer);
      sseState.reconnectTimer = null;
    }

    sseState = null;
  }
}

/**
 * 获取当前 SSE 连接状态
 */
export function getSSEState(): { connected: boolean; attempt: number } {
  if (!sseState) {
    return { connected: false, attempt: 0 };
  }
  return {
    connected: sseState.eventSource !== null && sseState.eventSource.readyState === EventSource.OPEN,
    attempt: sseState.attempt,
  };
}
