/**
 * NotificationCenter - state hook
 * 通知中心状态与逻辑抽取
 *
 * 从 index.tsx 拆分而来，管理通知列表、统计、广播、设置等所有状态与副作用。
 * 页面仅需消费返回值并渲染 JSX。
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats,
  getNotificationSettings,
  updateNotificationSettings,
  broadcastNotification,
  type NotificationSettings,
  type BroadcastInput,
} from '@/api/notifications';
import { listUsers, type User } from '@/api/users';
import type { NotificationItem } from './constants';

export function useNotificationCenterState() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ unread: 0, critical: 0, today: 0, thisWeek: 0 });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Broadcast modal state
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [broadcastForm] = Form.useForm();
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'specific'>('all');
  const [selectedBroadcastUsers, setSelectedBroadcastUsers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Notification settings drawer state
  const [settingsDrawerVisible, setSettingsDrawerVisible] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(
    null,
  );
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Check if current user is admin (from localStorage or auth store)
  const isAdmin = (): boolean => {
    const role = localStorage.getItem('user_role');
    return role === 'admin';
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // Map tab key to API type parameter
      let typeParam: string | undefined;
      let readParam: boolean | undefined;

      switch (activeTab) {
        case 'unread':
          readParam = false;
          break;
        case 'read':
          readParam = true;
          break;
        case 'tickets':
          typeParam = 'tickets';
          break;
        case 'system':
          typeParam = 'system';
          break;
        default:
          break;
      }

      const { data, total: totalCount } = await getNotifications({
        page: currentPage,
        pageSize,
        type: typeParam,
        read: readParam,
      });

      setNotifications(data);
      setTotal(totalCount || data.length);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`获取通知列表失败：${error.message}`);
      } else {
        message.error('获取通知列表失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const data = await getNotificationStats();
      setStats(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`获取统计数据失败：${error.message}`);
      }
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchStats();
  }, [activeTab, currentPage, pageSize]);

  // Toggle expand/collapse
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Mark as read
  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      fetchStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`标记已读失败：${error.message}`);
      }
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      message.success('已全部标记为已读');
      fetchStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`全部标记已读失败：${error.message}`);
      } else {
        message.error('操作失败');
      }
    }
  };

  // Delete notification
  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      message.success('通知已删除');
      fetchStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  // Clear read notifications
  const handleClearRead = () => {
    setNotifications((prev) => prev.filter((n) => !n.read));
    message.success('已清除已读通知');
    fetchStats();
  };

  // ---- Broadcast Handlers ----

  /** Load available users for broadcast targeting */
  const loadAvailableUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await listUsers({ limit: 200 });
      const users: User[] = res.data?.data || [];
      setAvailableUsers(users);
    } catch (error: unknown) {
      setAvailableUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  /** Open broadcast modal */
  const openBroadcastModal = () => {
    setBroadcastModalVisible(true);
    setBroadcastAudience('all');
    setSelectedBroadcastUsers([]);
    broadcastForm.resetFields();
    loadAvailableUsers();
  };

  /** Submit broadcast */
  const handleBroadcastSubmit = async () => {
    try {
      const values = await broadcastForm.validateFields();
      setBroadcastSubmitting(true);

      const tenantId = localStorage.getItem('tenant_id') || 'default';
      const userIds =
        broadcastAudience === 'all' ? availableUsers.map((u) => u.id) : selectedBroadcastUsers;

      if (userIds.length === 0) {
        message.warning('没有可选用户');
        return;
      }

      // Map priority to notification type
      const typeMap: Record<string, string> = {
        critical: 'system_alert',
        high: 'system_alert',
        medium: 'system_alert',
        low: 'system_alert',
      };

      const payload: BroadcastInput = {
        tenantId,
        userIds,
        type: typeMap[values.priority] || 'system_alert',
        title: values.title,
        message: values.message,
      };

      const result = await broadcastNotification(payload);
      message.success(`广播发送成功，已发送至 ${result.sent} 个用户`);
      setBroadcastModalVisible(false);
      broadcastForm.resetFields();
    } catch (error: unknown) {
      // Form validation errors are handled by Ant Design
      if (!(error instanceof Error && (error as { errorFields?: unknown }).errorFields)) {
        message.error('广播发送失败');
      }
    } finally {
      setBroadcastSubmitting(false);
    }
  };

  // ---- Notification Settings Handlers ----

  /** Open settings drawer and load current settings */
  const openSettingsDrawer = async () => {
    setSettingsDrawerVisible(true);
    setSettingsLoading(true);
    try {
      const settings = await getNotificationSettings();
      setNotificationSettings(settings);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`获取通知设置失败：${error.message}`);
      } else {
        message.error('获取通知设置失败');
      }
    } finally {
      setSettingsLoading(false);
    }
  };

  /** Toggle a specific notification setting */
  const handleToggleSetting = async (key: keyof NotificationSettings) => {
    if (!notificationSettings) return;
    setSettingsSaving(true);
    try {
      const newSettings = {
        ...notificationSettings,
        [key]: !notificationSettings[key],
      };
      const result = await updateNotificationSettings({ [key]: newSettings[key] });
      setNotificationSettings(result);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`保存设置失败：${error.message}`);
      } else {
        message.error('保存设置失败');
      }
    } finally {
      setSettingsSaving(false);
    }
  };

  // Tab change handler
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setExpandedIds(new Set());
    setCurrentPage(1);
  };

  // Pagination change handlers
  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(page);
    if (size && size !== pageSize) {
      setPageSize(size);
      setCurrentPage(1);
    }
    setExpandedIds(new Set());
  };

  return {
    notifications,
    loading,
    activeTab,
    expandedIds,
    stats,
    currentPage,
    pageSize,
    total,
    broadcastModalVisible,
    broadcastForm,
    broadcastSubmitting,
    broadcastAudience,
    selectedBroadcastUsers,
    availableUsers,
    usersLoading,
    settingsDrawerVisible,
    notificationSettings,
    settingsLoading,
    settingsSaving,
    isAdmin,
    toggleExpand,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDelete,
    handleClearRead,
    openBroadcastModal,
    handleBroadcastSubmit,
    openSettingsDrawer,
    handleToggleSetting,
    handleTabChange,
    handlePageChange,
    setBroadcastModalVisible,
    setBroadcastAudience,
    setSelectedBroadcastUsers,
    setSettingsDrawerVisible,
  };
}
