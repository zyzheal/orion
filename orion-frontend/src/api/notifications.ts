/**
 * Notification API Service
 * - Real backend API calls for notifications
 * - Maps backend Notification schema to frontend MockNotification format
 */
import { api } from './client';
import { mockNotifications, type MockNotification } from '@/pages/__mocks__/mockNotificationData';

// ============================================================================
// Types
// ============================================================================

export interface BackendNotification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

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

// ============================================================================
// Mapping: Backend -> Frontend
// ============================================================================

const typeToPriority: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  sla_breached: 'critical',
  sla_warning: 'high',
  ticket_escalated: 'high',
  system_alert: 'high',
  ticket_assigned: 'medium',
  pipeline_completed: 'medium',
  comment_mention: 'medium',
  transfer_request: 'low',
};

const typeToSender: Record<string, string> = {
  ticket_assigned: '工单系统',
  ticket_escalated: '工单系统',
  sla_warning: 'SLA 监控',
  sla_breached: 'SLA 监控',
  pipeline_completed: 'Pipeline 引擎',
  system_alert: '系统监控',
  comment_mention: '协作中心',
  transfer_request: '工单系统',
};

function mapBackendToNotification(n: BackendNotification): MockNotification {
  return {
    id: n.id,
    title: n.title,
    content: n.message,
    type: n.type as MockNotification['type'],
    priority: typeToPriority[n.type] || 'medium',
    read: n.status === 'read' || !!n.read_at,
    createdAt: n.created_at,
    relatedId: undefined,
    sender: typeToSender[n.type] || '系统',
    actions: [],
  };
}

// ============================================================================
// Real Backend API Calls
// ============================================================================

/**
 * Get current user ID from localStorage (fallback for demo)
 */
function getCurrentUserId(): string {
  return localStorage.getItem('user_id') || 'demo-user';
}

function getCurrentTenantId(): string {
  return localStorage.getItem('tenant_id') || 'default';
}

/**
 * 获取通知列表 - 从真实后端获取
 */
export const getNotifications = async (
  params?: NotificationListParams
): Promise<{ data: MockNotification[]; total: number }> => {
  const userId = getCurrentUserId();

  try {
    const response = await api.get(`/v1/notifications/${userId}`, {
      params: {
        limit: params?.pageSize || 20,
        page: params?.page || 1,
      },
    });

    const result = response.data;
    console.log('[Notifications API] Response:', result);

    // Backend returns { data: [...], total: N } or just [...]
    const backendNotifications: BackendNotification[] = result?.data || result || [];
    let notifications: MockNotification[] = Array.isArray(backendNotifications)
      ? backendNotifications.map(mapBackendToNotification)
      : [];
    let total = result?.total ?? notifications.length;

    // Apply client-side filtering for tabs that backend doesn't support directly
    if (params?.type) {
      const typeMap: Record<string, string[]> = {
        tickets: ['ticket_assigned', 'ticket_escalated', 'transfer_request'],
        system: ['system_alert', 'sla_warning', 'sla_breached', 'pipeline_completed'],
      };
      const types = typeMap[params.type];
      if (types?.length) {
        notifications = notifications.filter((n) => types.includes(n.type));
      }
    }

    if (params?.read !== undefined) {
      notifications = notifications.filter((n) => n.read === params.read);
    }

    if (params?.priority) {
      notifications = notifications.filter((n) => n.priority === params.priority);
    }

    // Sort by date descending
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // If backend returned 0 items, use mock fallback
    if (notifications.length === 0) {
      throw new Error('No notifications from backend');
    }

    // Backend already handles pagination - just return the data with total
    return { data: notifications, total: total || notifications.length };
  } catch (error) {
    console.warn('[Notifications API] Backend unavailable, using mock data:', error);
    console.warn('Backend notification API unavailable, using mock data:', error);
    // Fallback to mock data when backend is not available
    let filtered = [...mockNotifications];

    if (params?.type) {
      const typeMap: Record<string, string[]> = {
        all: [],
        unread: [],
        tickets: ['ticket_assigned', 'ticket_escalated', 'transfer_request'],
        system: ['system_alert', 'sla_warning', 'sla_breached', 'pipeline_completed'],
        read: [],
      };
      const types = typeMap[params.type];
      if (types?.length) {
        filtered = filtered.filter((n) => types.includes(n.type));
      }
    }
    if (params?.read !== undefined) {
      filtered = filtered.filter((n) => n.read === params.read);
    }
    if (params?.priority) {
      filtered = filtered.filter((n) => n.priority === params.priority);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return { data: paged, total: filtered.length };
  }
};

/**
 * 获取单个通知详情
 */
export const getNotification = async (id: string): Promise<MockNotification> => {
  try {
    const response = await api.get(`/v1/notifications/${id}`);
    return mapBackendToNotification(response.data?.data as BackendNotification);
  } catch (error) {
    const notification = mockNotifications.find((n) => n.id === id);
    if (!notification) throw new Error('Notification not found');
    return notification;
  }
};

/**
 * 标记通知为已读
 */
export const markAsRead = async (id: string): Promise<void> => {
  try {
    await api.put(`/v1/notifications/${id}/read`);
  } catch (error) {
    console.warn('Backend markAsRead failed, using mock fallback:', error);
  }
};

/**
 * 标记所有通知为已读
 */
export const markAllAsRead = async (): Promise<void> => {
  try {
    const userId = getCurrentUserId();
    const response = await api.get(`/v1/notifications/${userId}`, { params: { limit: 100 } });
    const notifications: BackendNotification[] =
      (response.data?.data as BackendNotification[]) || [];

    // Mark each unread notification as read
    for (const n of notifications) {
      if (n.status !== 'read' && !n.read_at) {
        await api.put(`/v1/notifications/${n.id}/read`);
      }
    }
  } catch (error) {
    console.warn('Backend markAllAsRead failed, using mock fallback:', error);
  }
};

/**
 * 删除通知
 */
export const deleteNotification = async (id: string): Promise<void> => {
  try {
    // Backend doesn't have a delete endpoint yet, mark as read for now
    await api.put(`/v1/notifications/${id}/read`);
  } catch (error) {
    console.warn('Backend deleteNotification failed, using mock fallback:', error);
  }
};

/**
 * 获取通知统计
 */
export const getNotificationStats = async (): Promise<NotificationStats> => {
  try {
    const userId = getCurrentUserId();

    // Get unread count from backend
    const unreadRes = await api.get(`/v1/notifications/${userId}/unread-count`);
    const unreadCount =
      Number((unreadRes.data as unknown as Record<string, unknown>)?.unreadCount) || 0;

    // Fetch recent notifications for other stats
    const response = await api.get(`/v1/notifications/${userId}`, { params: { limit: 100 } });
    const backendNotifications: BackendNotification[] =
      (response.data?.data as BackendNotification[]) || [];
    const notifications: MockNotification[] = backendNotifications.map(mapBackendToNotification);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    return {
      unread: unreadCount,
      critical: notifications.filter((n) => n.priority === 'critical' && !n.read).length,
      today: notifications.filter((n) => new Date(n.createdAt) >= todayStart).length,
      thisWeek: notifications.filter((n) => new Date(n.createdAt) >= weekStart).length,
    };
  } catch (error) {
    console.warn('Backend getNotificationStats failed, using mock data:', error);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    return {
      unread: mockNotifications.filter((n) => !n.read).length,
      critical: mockNotifications.filter((n) => n.priority === 'critical' && !n.read).length,
      today: mockNotifications.filter((n) => new Date(n.createdAt) >= todayStart).length,
      thisWeek: mockNotifications.filter((n) => new Date(n.createdAt) >= weekStart).length,
    };
  }
};

/**
 * 获取通知设置
 */
export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  try {
    const userId = getCurrentUserId();
    const tenantId = getCurrentTenantId();
    const response = await api.get(`/v1/notifications/settings/${userId}`, {
      params: { tenantId },
    });
    const data =
      (response.data?.data as unknown as Record<string, unknown>) ||
      (response.data as unknown as Record<string, unknown>) ||
      {};

    return {
      emailEnabled: Boolean(data?.email_enabled ?? true),
      soundEnabled: Boolean(data?.sms_enabled ?? false),
      desktopEnabled: Boolean(data?.webhook_enabled ?? false),
      ticketAssigned: Boolean(data?.ticket_assigned ?? true),
      ticketEscalated: Boolean(data?.ticket_escalated ?? true),
      slaWarning: Boolean(data?.sla_warning ?? true),
      slaBreached: Boolean(data?.sla_breached ?? true),
      pipelineCompleted: Boolean(data?.pipeline_completed ?? true),
      systemAlert: Boolean(data?.system_alert ?? true),
      commentMention: Boolean(data?.comment_mention ?? true),
      transferRequest: Boolean(data?.transfer_request ?? true),
    };
  } catch (error) {
    console.warn('Backend getNotificationSettings failed, using default:', error);
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
  }
};

/**
 * 更新通知设置
 */
export const updateNotificationSettings = async (
  settings: Partial<NotificationSettings>
): Promise<NotificationSettings> => {
  try {
    const userId = getCurrentUserId();
    const tenantId = getCurrentTenantId();

    const backendMapping: Record<string, string> = {
      emailEnabled: 'email_enabled',
      soundEnabled: 'sms_enabled',
      desktopEnabled: 'webhook_enabled',
      ticketAssigned: 'ticket_assigned',
      ticketEscalated: 'ticket_escalated',
      slaWarning: 'sla_warning',
      slaBreached: 'sla_breached',
      pipelineCompleted: 'pipeline_completed',
      systemAlert: 'system_alert',
      commentMention: 'comment_mention',
      transferRequest: 'transfer_request',
    };

    const backendUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(settings)) {
      const backendKey = backendMapping[key];
      if (backendKey) {
        backendUpdates[backendKey] = value;
      }
    }

    const response = await api.put(`/v1/notifications/settings/${userId}`, backendUpdates, {
      params: { tenantId },
    });
    const data =
      (response.data?.data as unknown as Record<string, unknown>) ||
      (response.data as unknown as Record<string, unknown>) ||
      {};

    return {
      emailEnabled: Boolean(data?.email_enabled ?? true),
      soundEnabled: Boolean(data?.sms_enabled ?? false),
      desktopEnabled: Boolean(data?.webhook_enabled ?? false),
      ticketAssigned: Boolean(data?.ticket_assigned ?? true),
      ticketEscalated: Boolean(data?.ticket_escalated ?? true),
      slaWarning: Boolean(data?.sla_warning ?? true),
      slaBreached: Boolean(data?.sla_breached ?? true),
      pipelineCompleted: Boolean(data?.pipeline_completed ?? true),
      systemAlert: Boolean(data?.system_alert ?? true),
      commentMention: Boolean(data?.comment_mention ?? true),
      transferRequest: Boolean(data?.transfer_request ?? true),
    };
  } catch (error) {
    console.warn('Backend updateNotificationSettings failed:', error);
    throw error;
  }
};

/**
 * 广播通知给多个用户
 * POST /v1/notifications/broadcast
 */
export interface BroadcastInput {
  tenantId: string;
  userIds: string[];
  type: string;
  title: string;
  message: string;
}

export interface BroadcastResult {
  sent: number;
}

export const broadcastNotification = async (input: BroadcastInput): Promise<BroadcastResult> => {
  const response = await api.post('/v1/notifications/broadcast', {
    tenant_id: input.tenantId,
    user_ids: input.userIds,
    type: input.type,
    title: input.title,
    message: input.message,
  });
  const data = (response.data?.data as unknown as Record<string, unknown>) || {};
  return {
    sent: Number(data?.sent ?? 0),
  };
};
