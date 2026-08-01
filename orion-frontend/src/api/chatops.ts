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
  commandId: string;
  userId: string;
  platform: string;
  channel?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  result?: Record<string, unknown>;
  milestones?: Record<string, unknown>;
}

export interface CommandExecutionInput {
  command: string;
  params?: Record<string, unknown>;
  platform?: string;
  userId?: string;
  channel?: string;
}

/** 后端 AuditLog 中 actor 字段的实际结构 */
export interface AuditLogActor {
  userId: string;
  platform?: string;
}

/** 后端 AuditLog 中 action 字段的实际结构 */
export interface AuditLogAction {
  command: string;
  params?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  actor: AuditLogActor | string;
  action: AuditLogAction | string;
  timestamp: string;
  result?: 'success' | 'failed';
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
  commandId?: string;
  platform?: string;
  status?: string;
  userId?: string;
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
  return api.get('/api/chatops/commands', { params });
}

export function getCommandHelp(name: string) {
  return api.get(`/api/chatops/commands/${name}/help`);
}

export function executeCommand(data: CommandExecutionInput) {
  return api.post('/api/chatops/execute', data);
}

export function getCommandStatus(id: string) {
  return api.get(`/api/chatops/status/${id}`);
}

export function getExecutions(params?: ExecutionListParams) {
  return api.get('/api/chatops/executions', { params });
}

// ---- Audit ----

export function getAuditLogs(params?: AuditLogListParams) {
  return api.get('/api/chatops/audit/logs', { params });
}

export function getAuditStats(params?: AuditStatsParams) {
  return api.get('/api/chatops/audit/stats', { params });
}

export function exportAuditLogs(data: { startDate: string; endDate: string; format?: string }) {
  return api.post('/api/chatops/audit/export', data);
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
  // 扩展字段：用于前端处理状态
  status?: 'pending' | 'dismissed' | 'resolved' | 'archived';
  assignee?: string;
}

export function fetchRecommendations(context?: { currentPage?: string; resourceId?: string }) {
  return api.post('/api/chatops/recommendations', { context });
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

export function getSessionMessages(
  sessionId: string,
  params?: { limit?: number; cursor?: string }
) {
  return api.get(`/api/chatops/sessions/${sessionId}/messages`, { params });
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
  return api.get('/api/chatops/settings/notification-preferences');
}

export function updateNotificationPreferences(data: {
  alertLevel: 'critical' | 'warning' | 'info';
  channelChatops?: boolean;
  channelEmail?: boolean;
  channelSlack?: boolean;
  channelFeishu?: boolean;
  channelDingtalk?: boolean;
}) {
  return api.put('/api/chatops/settings/notification-preferences', data);
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
  return api.get('/api/chatops/settings/dnd');
}

export function updateDNDSettings(
  data: Partial<{
    enabled: boolean;
    startTime: string;
    endTime: string;
    repeatDays: number[];
    allowCritical: boolean;
  }>
) {
  return api.put('/api/chatops/settings/dnd', data);
}

export function toggleDND(enabled: boolean) {
  return api.patch('/api/chatops/settings/dnd/toggle', { enabled });
}

// ---- Platform Config ----

export interface PlatformConfig {
  platform: 'dingtalk' | 'wecom' | 'feishu' | 'slack';
  enabled: boolean;
  webhook: string;
  token: string;
}

export function getPlatformConfigs() {
  return api.get('/api/chatops/settings/platforms');
}

export function updatePlatformConfigs(platforms: PlatformConfig[]) {
  return api.put('/api/chatops/settings/platforms', { platforms });
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
  return api.get('/api/chatops/alerts/states');
}

export function markAlertRead(alertId: string) {
  return api.post(`/api/chatops/alerts/${alertId}/read`);
}

export function markAlertAcknowledged(alertId: string) {
  return api.post(`/api/chatops/alerts/${alertId}/acknowledge`);
}

export function markAlertDismissed(alertId: string) {
  return api.post(`/api/chatops/alerts/${alertId}/dismiss`);
}

// ---- SSE Stream ----

/**
 * ARCH-005: SSE 连接配置
 * 与后端 EventBusService 配置对齐
 */
export interface SSEConnectionConfig {
  /** 最大重连次数（与后端 NATS maxReconnectAttempts 对齐） */
  maxReconnectAttempts: number;
  /** 初始延迟（与后端 reconnectTimeWait 对齐） */
  initialDelayMs: number;
  /** 最大延迟 */
  maxDelayMs: number;
  /** 健康检查间隔 */
  healthCheckIntervalMs: number;
}

/** ARCH-005: 默认 SSE 配置 */
const DEFAULT_SSE_CONFIG: SSEConnectionConfig = {
  maxReconnectAttempts: 20, // 与后端 NATS 默认对齐
  initialDelayMs: 2000, // 与后端 reconnectTimeWait 对齐
  maxDelayMs: 30000,
  healthCheckIntervalMs: 10000, // 每 10s 检查后端健康状态
};

export interface SSEConnectionOptions {
  onMessage: (data: unknown) => void;
  onReconnect?: (attempt: number) => void;
  onError?: (error: Error) => void;
  /** ARCH-005: 可选的配置覆盖 */
  config?: Partial<SSEConnectionConfig>;
  /** ARCH-005: 后端健康状态变化回调 */
  onHealthChange?: (healthy: boolean, fallback: boolean) => void;
}

interface SSEConnectionState {
  eventSource: EventSource | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  healthCheckTimer: ReturnType<typeof setInterval> | null;
  attempt: number;
  disposed: boolean;
  /** ARCH-005: 后端健康状态 */
  backendHealthy: boolean;
  backendFallback: boolean;
}

let sseState: SSEConnectionState | null = null;

/**
 * 计算指数退避延迟 (1s, 2s, 4s, 8s, ... 最大 30s)
 */
function getReconnectDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30_000);
}

/**
 * ARCH-005: 检查后端健康状态
 */
async function checkBackendHealth(): Promise<{ healthy: boolean; fallback: boolean }> {
  try {
    const response = await fetch('/api/chatops/health');
    if (!response.ok) {
      return { healthy: false, fallback: false };
    }
    const data = await response.json();
    const status = data?.eventBus?.status || 'down';
    return {
      healthy: status === 'up',
      fallback: status === 'fallback',
    };
  } catch {
    return { healthy: false, fallback: false };
  }
}

/**
 * 建立 SSE 连接，支持断线自动重连
 * ARCH-005: 添加健康检查感知，智能重连策略
 */
export function connectSSE(options: SSEConnectionOptions): void {
  // 如果已有连接，先断开
  disconnectSSE();

  const config = { ...DEFAULT_SSE_CONFIG, ...options.config };

  sseState = {
    eventSource: null,
    reconnectTimer: null,
    healthCheckTimer: null,
    attempt: 0,
    disposed: false,
    backendHealthy: true,
    backendFallback: false,
  };

  // ARCH-005: 启动健康检查定时器
  sseState.healthCheckTimer = setInterval(async () => {
    if (sseState?.disposed) return;

    const health = await checkBackendHealth();
    const prevHealthy = sseState?.backendHealthy;
    const prevFallback = sseState?.backendFallback;

    sseState!.backendHealthy = health.healthy;
    sseState!.backendFallback = health.fallback;

    // ARCH-005: 健康状态变化时通知调用方
    if (prevHealthy !== health.healthy || prevFallback !== health.fallback) {
      options.onHealthChange?.(health.healthy, health.fallback);
    }

    // ARCH-005: 后端恢复健康且有连接问题时立即重试
    if (health.healthy && !sseState?.eventSource && (sseState?.attempt ?? 0) > 0) {

      sseState!.attempt = 0; // 重置重试计数
      doConnect();
    }
  }, config.healthCheckIntervalMs);

  function doConnect(): void {
    if (sseState!.disposed) return;

    // ARCH-005: 后端处于 fallback 模式时降低重连频率
    if (sseState!.backendFallback) {

    }

    try {
      const es = new EventSource('/api/chatops/stream/recommendations');
      sseState!.eventSource = es;

      es.onopen = () => {
        // 连接成功，重置重试计数
        sseState!.attempt = 0;
        sseState!.backendHealthy = true;
        options.onHealthChange?.(true, false);
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

      // ARCH-005: 监听后端发送的 shutdown 事件
      es.addEventListener('shutdown', (event: MessageEvent) => {
        try {
          JSON.parse(event.data);
          // 后端主动关闭时等待健康检查触发重连
        } catch {
          // 忽略解析错误
        }
      });

      es.onerror = () => {
        es.close();
        sseState!.eventSource = null;

        if (sseState!.disposed) return;

        // 立即递增 attempt，确保退避延迟正确递增
        sseState!.attempt++;

        // ARCH-005: 使用配置中的最大重连次数
        if (sseState!.attempt >= config.maxReconnectAttempts) {
          options.onError?.(new Error('SSE 连接失败，已达最大重试次数'));
          sseState!.disposed = true;
          return;
        }

        // ARCH-005: 后端 fallback 时使用固定延迟而非指数退避
        const delay = sseState!.backendFallback
          ? config.initialDelayMs * 2 // Fallback 时使用固定较长延迟
          : getReconnectDelay(sseState!.attempt);

        options.onError?.(
          new Error(`SSE 连接断开，${delay}ms 后重试 (第 ${sseState!.attempt} 次)`)
        );

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
 * ARCH-005: 清理健康检查定时器
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

    // ARCH-005: 清理健康检查定时器
    if (sseState.healthCheckTimer) {
      clearInterval(sseState.healthCheckTimer);
      sseState.healthCheckTimer = null;
    }

    sseState = null;
  }
}

/**
 * 获取当前 SSE 连接状态
 * ARCH-005: 返回健康状态信息
 */
export function getSSEState(): {
  connected: boolean;
  attempt: number;
  backendHealthy: boolean;
  backendFallback: boolean;
} {
  if (!sseState) {
    return { connected: false, attempt: 0, backendHealthy: false, backendFallback: false };
  }
  return {
    connected:
      sseState.eventSource !== null && sseState.eventSource.readyState === EventSource.OPEN,
    attempt: sseState.attempt,
    backendHealthy: sseState.backendHealthy,
    backendFallback: sseState.backendFallback,
  };
}

// ---- ChatOps 对话工作台 (Phase 3) ----

export interface ChatRequest {
  message: string;
  context?: Record<string, string>;
}

export interface ChatResponse {
  message: string;
  intent: string;
  confidence: number;
  toolCalls?: Array<{
    tool: string;
    params: Record<string, unknown>;
    status: string;
    result?: unknown;
  }>;
  suggestions?: string[];
}

export interface ToolInfo {
  name: string;
  version: string;
  description: string;
  parameters: Array<{ name: string; type: string; required: boolean; description: string }>;
  requiresApproval: boolean;
}

export function sendChatMessage(data: ChatRequest) {
  return api.post('/api/chatops/chat', data);
}

export function getAvailableTools() {
  return api.get('/api/chatops/tools');
}

// ---- Dashboard Stats ----

export interface DashboardMetrics {
  totalExecutions: number;
  successRate: number;
  failedCount: number;
  avgResponseTime: number;
}

export interface DashboardTrend {
  date: string;
  executions: number;
  successRate: number;
}

export interface TopCommand {
  command: string;
  count: number;
  successRate: number;
}

export interface PlatformDist {
  platform: string;
  count: number;
}

export interface DashboardRecentExecution {
  id: string;
  commandId: string;
  userId: string;
  platform: string;
  status: string;
  startTime: string;
  endTime: string | null;
}

export interface MetricsComparison {
  totalExecutions: number;
  successRate: number;
  failedCount: number;
  avgResponseTime: number;
}

export interface DashboardStats {
  metrics: DashboardMetrics;
  trends: DashboardTrend[];
  topCommands: TopCommand[];
  platformDistribution: PlatformDist[];
  recentExecutions: DashboardRecentExecution[];
  comparison: MetricsComparison;
}

export type TimeRangeType = '7d' | '30d' | 'month' | 'custom';

export function getDashboardStats(params?: {
  range?: TimeRangeType;
  startDate?: string;
  endDate?: string;
}) {
  return api.get('/api/chatops/dashboard/stats', { params });
}

// ---- Chat Config (Questions & Commands) ----

export interface ChatQuestionConfig {
  key: string;
  icon: string;
  title: string;
  desc: string;
  question: string;
  enabled: boolean;
}

export interface ChatCommandConfig {
  key: string;
  label: string;
  command: string;
  enabled: boolean;
}

export function getQuestionConfigs() {
  return api.get('/api/chatops/settings/questions');
}

export function updateQuestionConfigs(data: { configs: ChatQuestionConfig[] }) {
  return api.put('/api/chatops/settings/questions', data);
}

export function getCommandConfigs() {
  return api.get('/api/chatops/settings/commands');
}

export function updateCommandConfigs(data: { configs: ChatCommandConfig[] }) {
  return api.put('/api/chatops/settings/commands', data);
}

