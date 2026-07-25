/**
 * Notification Enhanced API Client
 * 高级通知管理 API: 策略、集成、订阅、历史、公告、矩阵
 * 后端基础路径: /api/v1/notification-enhanced
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface NotificationStrategyAction {
  type: 'notify' | 'escalate' | 'mute' | 'aggregate' | 'custom';
  delay_seconds?: number;
  target_template?: string;
  params?: Record<string, any>;
}

export interface NotificationStrategy {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  status: 'active' | 'disabled' | 'paused';
  priority: number;
  trigger_type: 'schedule' | 'event' | 'manual';
  trigger_conditions: Record<string, any>;
  actions: NotificationStrategyAction[];
  channels: string[];
  target_users?: string[];
  max_notifications_per_day?: number;
  cooldown_seconds?: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationStrategyInput {
  name: string;
  description?: string;
  status?: 'active' | 'disabled' | 'paused';
  priority?: number;
  trigger_type: 'schedule' | 'event' | 'manual';
  trigger_conditions: Record<string, any>;
  actions: NotificationStrategyAction[];
  channels: string[];
  target_users?: string[];
  max_notifications_per_day?: number;
  cooldown_seconds?: number;
}

export interface NotificationIntegration {
  id: string;
  tenant_id: string;
  name: string;
  channel_type: 'email' | 'sms' | 'webhook' | 'dingtalk' | 'wecom' | 'feishu' | 'telegram' | 'slack';
  description: string;
  config: Record<string, any>;
  secret_ref?: string;
  enabled: boolean;
  rate_limit_per_minute: number;
  last_test_at?: string;
  last_test_status: 'success' | 'failed' | 'never';
  created_at: string;
  updated_at: string;
}

export interface NotificationIntegrationInput {
  name: string;
  channel_type: 'email' | 'sms' | 'webhook' | 'dingtalk' | 'wecom' | 'feishu' | 'telegram' | 'slack';
  description?: string;
  config: Record<string, any>;
  rate_limit_per_minute?: number;
}

export interface NotificationSubscription {
  id: string;
  tenant_id: string;
  user_id: string;
  event_types: string[];
  channels: string[];
  silent_hours?: { start: string; end: string } | null;
  frequency: 'instant' | 'daily_digest' | 'weekly_digest' | 'critical_only';
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationSubscriptionInput {
  user_id: string;
  event_types: string[];
  channels: string[];
  silent_hours?: { start: string; end: string } | null;
  frequency?: 'instant' | 'daily_digest' | 'weekly_digest' | 'critical_only';
}

export interface UserSubscriptionPreference {
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  desktop_enabled: boolean;
  in_app_enabled: boolean;
  event_types: Record<string, { email: boolean; sms: boolean; in_app: boolean }>;
  critical_only: boolean;
  quiet_hours: { enabled: boolean; start: string; end: string } | null;
}

export interface NotificationHistoryItem {
  id: string;
  tenant_id: string;
  user_id: string;
  notification_id: string;
  strategy_id?: string;
  integration_id?: string;
  channel_type: string;
  title: string;
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  error_message?: string;
  sent_at?: string;
  read_at?: string;
  created_at: string;
}

export interface NotificationHistoryPage {
  items: NotificationHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Notice {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  type: 'system' | 'maintenance' | 'release' | 'urgent' | 'general';
  status: 'draft' | 'published' | 'withdrawn';
  target_users?: string[];
  target_channels?: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  publish_at?: string;
  expire_at?: string;
  published_by?: string;
  created_at: string;
  updated_at: string;
}

export interface NoticeInput {
  title: string;
  content: string;
  type?: 'system' | 'maintenance' | 'release' | 'urgent' | 'general';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  target_users?: string[];
  target_channels?: string[];
  publish_at?: string;
  expire_at?: string;
}

export interface DataMatrix {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  matrix_type: 'integration' | 'subscription' | 'channel' | 'custom';
  data: Record<string, any>;
  version: number;
  status: 'active' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DataMatrixView {
  id: string;
  matrix_id: string;
  name: string;
  description: string;
  view_type: 'table' | 'list' | 'tree' | 'custom';
  config: Record<string, any>;
  is_default: boolean;
  created_at: string;
}

export interface DataMatrixInput {
  name: string;
  description?: string;
  matrix_type: 'integration' | 'subscription' | 'channel' | 'custom';
  data: Record<string, any>;
}

// ============================================================================
// Constants
// ============================================================================

const BASE = '/api/v1/notification-enhanced';

/** 所有可用事件类型 */
export const EVENT_TYPES = [
  'pipeline.complete',
  'pipeline.failed',
  'pipeline.cancelled',
  'deployment.success',
  'deployment.failed',
  'alert.triggered',
  'alert.resolved',
  'selfhealing.triggered',
  'cost.anomaly',
  'ticket.created',
  'ticket.assigned',
  'ticket.escalated',
  'sla.warning',
  'sla.breached',
  'approval.required',
  'approval.rejected',
] as const;

/** 所有可用通知渠道 */
export const CHANNEL_TYPES = [
  { label: '邮件 (Email)', value: 'email' },
  { label: '短信 (SMS)', value: 'sms' },
  { label: 'Webhook', value: 'webhook' },
  { label: '钉钉 (DingTalk)', value: 'dingtalk' },
  { label: '企业微信 (WeCom)', value: 'wecom' },
  { label: '飞书 (Feishu)', value: 'feishu' },
  { label: 'Telegram', value: 'telegram' },
  { label: 'Slack', value: 'slack' },
] as const;

/** 渠道标签 */
export const CHANNEL_LABELS: Record<string, string> = {
  email: '邮件',
  sms: '短信',
  webhook: 'Webhook',
  dingtalk: '钉钉',
  wecom: '企业微信',
  feishu: '飞书',
  telegram: 'Telegram',
  slack: 'Slack',
};

/** 渠道品牌色 */
export const CHANNEL_COLORS: Record<string, string> = {
  email: '#3370E6',
  sms: '#faad14',
  webhook: '#7C5CFC',
  dingtalk: '#0089FF',
  wecom: '#2BAE67',
  feishu: '#3370FF',
  telegram: '#229ED9',
  slack: '#4A154B',
};

// ============================================================================
// Strategies API
// ============================================================================

export const getNotificationStrategies = async (): Promise<NotificationStrategy[]> => {
  const response = await api.get(`${BASE}/strategies`);
  return response.data as NotificationStrategy[];
};

export const getNotificationStrategy = async (id: string): Promise<NotificationStrategy> => {
  const response = await api.get(`${BASE}/strategies/${id}`);
  return response.data as NotificationStrategy;
};

export const createNotificationStrategy = async (
  input: NotificationStrategyInput
): Promise<NotificationStrategy> => {
  const response = await api.post(`${BASE}/strategies`, input);
  return response.data as NotificationStrategy;
};

export const updateNotificationStrategy = async (
  id: string,
  input: Partial<NotificationStrategyInput>
): Promise<NotificationStrategy> => {
  const response = await api.put(`${BASE}/strategies/${id}`, input);
  return response.data as NotificationStrategy;
};

export const deleteNotificationStrategy = async (id: string): Promise<void> => {
  await api.delete(`${BASE}/strategies/${id}`);
};

export const toggleNotificationStrategyStatus = async (
  id: string,
  status: 'active' | 'disabled' | 'paused'
): Promise<NotificationStrategy> => {
  const response = await api.put(`${BASE}/strategies/${id}/status`, { status });
  return response.data as NotificationStrategy;
};

// ============================================================================
// Integrations API
// ============================================================================

export const getNotificationIntegrations = async (): Promise<NotificationIntegration[]> => {
  const response = await api.get(`${BASE}/integrations`);
  return response.data as NotificationIntegration[];
};

export const getNotificationIntegration = async (id: string): Promise<NotificationIntegration> => {
  const response = await api.get(`${BASE}/integrations/${id}`);
  return response.data as NotificationIntegration;
};

export const createNotificationIntegration = async (
  input: NotificationIntegrationInput
): Promise<NotificationIntegration> => {
  const response = await api.post(`${BASE}/integrations`, input);
  return response.data as NotificationIntegration;
};

export const updateNotificationIntegration = async (
  id: string,
  input: Partial<NotificationIntegrationInput> & { enabled?: boolean }
): Promise<NotificationIntegration> => {
  const response = await api.put(`${BASE}/integrations/${id}`, input);
  return response.data as NotificationIntegration;
};

export const deleteNotificationIntegration = async (id: string): Promise<void> => {
  await api.delete(`${BASE}/integrations/${id}`);
};

export const testNotificationIntegration = async (
  id: string
): Promise<{ success: boolean; message: string; timestamp: string }> => {
  const response = await api.post(`${BASE}/integrations/${id}/test`);
  return response.data as { success: boolean; message: string; timestamp: string };
};

// ============================================================================
// Subscriptions API
// ============================================================================

export const getNotificationSubscriptions = async (): Promise<NotificationSubscription[]> => {
  const response = await api.get(`${BASE}/subscriptions`);
  return response.data as NotificationSubscription[];
};

export const createNotificationSubscription = async (
  input: NotificationSubscriptionInput
): Promise<NotificationSubscription> => {
  const response = await api.post(`${BASE}/subscriptions`, input);
  return response.data as NotificationSubscription;
};

export const updateNotificationSubscription = async (
  id: string,
  input: { event_types?: string[]; channels?: string[]; frequency?: string; enabled?: boolean }
): Promise<NotificationSubscription> => {
  const response = await api.put(`${BASE}/subscriptions/${id}`, input);
  return response.data as NotificationSubscription;
};

export const deleteNotificationSubscription = async (id: string): Promise<void> => {
  await api.delete(`${BASE}/subscriptions/${id}`);
};

export const getUserSubscriptionPreferences = async (): Promise<UserSubscriptionPreference> => {
  const response = await api.get(`${BASE}/subscriptions/preferences`);
  return response.data as UserSubscriptionPreference;
};

// ============================================================================
// History API
// ============================================================================

export const getNotificationHistory = async (
  params?: {
    strategyId?: string;
    integrationId?: string;
    userId?: string;
    channelType?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<NotificationHistoryPage> => {
  const response = await api.get(`${BASE}/history`, { params });
  return response.data as NotificationHistoryPage;
};

export const markNotificationHistoryAsRead = async (id: string): Promise<void> => {
  await api.put(`${BASE}/history/${id}/read`);
};

export const markAllNotificationHistoryAsRead = async (): Promise<{ marked: number }> => {
  const response = await api.put(`${BASE}/history/batch-read`);
  return response.data as { marked: number };
};

// ============================================================================
// Notices API
// ============================================================================

export const getNotices = async (status?: string): Promise<Notice[]> => {
  const response = await api.get(`${BASE}/notices`, { params: status ? { status } : undefined });
  return response.data as Notice[];
};

export const getNotice = async (id: string): Promise<Notice> => {
  const response = await api.get(`${BASE}/notices/${id}`);
  return response.data as Notice;
};

export const createNotice = async (input: NoticeInput): Promise<Notice> => {
  const response = await api.post(`${BASE}/notices`, input);
  return response.data as Notice;
};

export const updateNotice = async (id: string, input: Partial<NoticeInput>): Promise<Notice> => {
  const response = await api.put(`${BASE}/notices/${id}`, input);
  return response.data as Notice;
};

export const deleteNotice = async (id: string): Promise<void> => {
  await api.delete(`${BASE}/notices/${id}`);
};

export const publishNotice = async (id: string): Promise<Notice> => {
  const response = await api.post(`${BASE}/notices/${id}/publish`);
  return response.data as Notice;
};

export const withdrawNotice = async (id: string): Promise<Notice> => {
  const response = await api.post(`${BASE}/notices/${id}/withdraw`);
  return response.data as Notice;
};

// ============================================================================
// Data Matrix API
// ============================================================================

export const getDataMatrices = async (type?: string): Promise<DataMatrix[]> => {
  const response = await api.get(`${BASE}/matrices`, { params: type ? { type } : undefined });
  return response.data as DataMatrix[];
};

export const getDataMatrix = async (id: string): Promise<DataMatrix> => {
  const response = await api.get(`${BASE}/matrices/${id}`);
  return response.data as DataMatrix;
};

export const createDataMatrix = async (input: DataMatrixInput): Promise<DataMatrix> => {
  const response = await api.post(`${BASE}/matrices`, input);
  return response.data as DataMatrix;
};

export const updateDataMatrix = async (id: string, input: Partial<DataMatrixInput>): Promise<DataMatrix> => {
  const response = await api.put(`${BASE}/matrices/${id}`, input);
  return response.data as DataMatrix;
};

export const deleteDataMatrix = async (id: string): Promise<void> => {
  await api.delete(`${BASE}/matrices/${id}`);
};

export const getDataMatrixViews = async (matrixId: string): Promise<DataMatrixView[]> => {
  const response = await api.get(`${BASE}/matrices/${matrixId}/views`);
  return response.data as DataMatrixView[];
};

export const createDataMatrixView = async (
  matrixId: string,
  input: { name: string; description?: string; view_type?: string; config?: Record<string, any> }
): Promise<DataMatrixView> => {
  const response = await api.post(`${BASE}/matrices/${matrixId}/views`, input);
  return response.data as DataMatrixView;
};

export const deleteDataMatrixView = async (id: string): Promise<void> => {
  await api.delete(`${BASE}/views/${id}`);
};
