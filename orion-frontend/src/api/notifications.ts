/**
 * Notification API Service
 * - Fetch, read, delete notifications
 * - Get notification stats and settings
 */
import { api } from './client';
import {
  mockNotifications,
  mockNotificationStats,
  type MockNotification,
} from '@/pages/__mocks__/mockNotificationData';

// In-memory store for mock state
let notificationsState: MockNotification[] = [...mockNotifications];

export interface NotificationListParams {
  page?: number;
  pageSize?: number;
  type?: string;
  read?: boolean;
  priority?: string;
}

export interface NotificationStats {
  unread: number;
  critical: number;
  today: number;
  thisWeek: number;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  soundEnabled: boolean;
  desktopEnabled: boolean;
  ticketAssigned: boolean;
  ticketEscalated: boolean;
  slaWarning: boolean;
  slaBreached: boolean;
  pipelineCompleted: boolean;
  systemAlert: boolean;
  commentMention: boolean;
  transferRequest: boolean;
}

/**
 * 获取通知列表
 */
export const getNotifications = async (
  params?: NotificationListParams
): Promise<{ data: MockNotification[]; total: number }> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  let filtered = [...notificationsState];

  if (params) {
    if (params.type) {
      const typeMap: Record<string, string[]> = {
        all: [],
        unread: [],
        tickets: ['ticket_assigned', 'ticket_escalated', 'transfer_request'],
        system: ['system_alert', 'sla_warning', 'sla_breached', 'pipeline_completed'],
        read: [],
      };
      const types = typeMap[params.type];
      if (types && types.length > 0) {
        filtered = filtered.filter((n) => types.includes(n.type));
      }
    }
    if (params.read !== undefined) {
      filtered = filtered.filter((n) => n.read === params.read);
    }
    if (params.priority) {
      filtered = filtered.filter((n) => n.priority === params.priority);
    }
  }

  // Sort by createdAt descending
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return { data: paged, total: filtered.length };
};

/**
 * 获取单个通知详情
 */
export const getNotification = async (id: string): Promise<MockNotification> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const notification = notificationsState.find((n) => n.id === id);
  if (!notification) {
    throw new Error('Notification not found');
  }
  return notification;
};

/**
 * 标记通知为已读
 */
export const markAsRead = async (id: string): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  notificationsState = notificationsState.map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
};

/**
 * 标记所有通知为已读
 */
export const markAllAsRead = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  notificationsState = notificationsState.map((n) => ({ ...n, read: true }));
};

/**
 * 删除通知
 */
export const deleteNotification = async (id: string): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  notificationsState = notificationsState.filter((n) => n.id !== id);
};

/**
 * 获取通知统计
 */
export const getNotificationStats = async (): Promise<NotificationStats> => {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  return {
    unread: notificationsState.filter((n) => !n.read).length,
    critical: notificationsState.filter((n) => n.priority === 'critical' && !n.read).length,
    today: notificationsState.filter((n) => new Date(n.createdAt) >= todayStart).length,
    thisWeek: notificationsState.filter((n) => new Date(n.createdAt) >= weekStart).length,
  };
};

/**
 * 获取通知设置
 */
export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return {
    emailEnabled: true,
    soundEnabled: true,
    desktopEnabled: false,
    ticketAssigned: true,
    ticketEscalated: true,
    slaWarning: true,
    slaBreached: true,
    pipelineCompleted: true,
    systemAlert: true,
    commentMention: true,
    transferRequest: true,
  };
};

/**
 * 更新通知设置
 */
export const updateNotificationSettings = async (
  settings: Partial<NotificationSettings>
): Promise<NotificationSettings> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const current = await getNotificationSettings();
  return { ...current, ...settings };
};
