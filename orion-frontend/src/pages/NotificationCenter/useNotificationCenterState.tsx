/**
 * useNotificationCenterState - NotificationCenter 状态 hook
 * 抽取自 index.tsx (P2-9 Phase 121)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  getNotificationStats,
  getNotificationSettings,
  updateNotificationSettings,
  broadcastNotification,
  type NotificationSettings,
  type BroadcastInput,
} from '@/api/notifications';
import { listUsers, type User } from '@/api/users';
import {
  DEFAULT_PAGE_SIZE,
  broadcastPriorityToType,
  type SettingsKey,
} from './config';
import { createNotificationListRenderer, renderEmptyState } from './columns';
import type { NotificationItem, NotificationStats } from './types';
import type { BroadcastAudience } from './NotificationCenterModals';

export const useNotificationCenterState = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<NotificationStats>({
    unread: 0,
    critical: 0,
    today: 0,
    thisWeek: 0,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [broadcastForm] = Form.useForm();
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);
  const [broadcastAudience, setBroadcastAudience] = useState<BroadcastAudience>('all');
  const [selectedBroadcastUsers, setSelectedBroadcastUsers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [settingsDrawerVisible, setSettingsDrawerVisible] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(
    null
  );
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const isAdmin = (): boolean => {
    const role = localStorage.getItem('user_role');
    return role === 'admin';
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, pageSize]);

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

  const handleClearRead = async () => {
    try {
      await clearReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.read));
      message.success('已清除已读通知');
      await fetchStats();
    } catch {
      message.error('清除已读通知失败');
    }
  };

  const loadAvailableUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await listUsers({ limit: 200 });
      const users: User[] = res.data?.data || [];
      setAvailableUsers(users);
    } catch {
      setAvailableUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const openBroadcastModal = () => {
    setBroadcastModalVisible(true);
    setBroadcastAudience('all');
    setSelectedBroadcastUsers([]);
    broadcastForm.resetFields();
    loadAvailableUsers();
  };

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

      const payload: BroadcastInput = {
        tenantId,
        userIds,
        type: broadcastPriorityToType[values.priority] || 'system_alert',
        title: values.title,
        message: values.message,
      };

      const result = await broadcastNotification(payload);
      message.success(`广播发送成功，已发送至 ${result.sent} 个用户`);
      setBroadcastModalVisible(false);
      broadcastForm.resetFields();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        // Ant Design form validation error
      } else {
        message.error('广播发送失败');
      }
    } finally {
      setBroadcastSubmitting(false);
    }
  };

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

  const handleToggleSetting = async (key: SettingsKey) => {
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

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setExpandedIds(new Set());
    setCurrentPage(1);
  };

  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(page);
    if (size && size !== pageSize) {
      setPageSize(size);
      setCurrentPage(1);
    }
    setExpandedIds(new Set());
  };

  const isExpanded = useCallback((id: string) => expandedIds.has(id), [expandedIds]);

  const NotificationListRenderer = useMemo(
    () =>
      createNotificationListRenderer({
        isExpanded,
        handleMarkAsRead,
        handleDelete,
        toggleExpand,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isExpanded]
  );

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
    handleTabChange,
    handlePageChange,
    handleMarkAllAsRead,
    handleClearRead,
    handleDelete,
    handleToggleSetting,
    openBroadcastModal,
    openSettingsDrawer,
    handleBroadcastSubmit,
    setBroadcastModalVisible,
    setBroadcastAudience,
    setSelectedBroadcastUsers,
    setSettingsDrawerVisible,
    NotificationListRenderer,
    renderEmptyState,
  };
};

export type NotificationCenterState = ReturnType<typeof useNotificationCenterState>;
