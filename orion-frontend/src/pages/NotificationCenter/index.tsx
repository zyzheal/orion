/**
 * NotificationCenter Page
 * - Top stats row: Unread count, Critical alerts, Today's notifications, This week's total
 * - Tab navigation: All | Unread | Tickets | System | Read
 * - Notification list with expandable content, priority indicators, type icons
 * - Mark all as read, Clear read notifications actions
 * - Empty state for no notifications
 * - Admin broadcast modal (broadcast messages to multiple users)
 * - User notification settings drawer (toggle notification preferences)
 *
 * State + data fetching live here; presentation is delegated to
 * `columns.tsx` (list rows), `NotificationCenterModals.tsx` (stats/broadcast/
 * settings) and `config.ts` (constant definitions).
 */
import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Typography,
  Button,
  Tabs,
  List,
  Space,
  message,
  Popconfirm,
  Form,
  Pagination,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  BellOutlined,
  CheckOutlined,
  ClearOutlined,
  SettingOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
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
  tabDefinitions,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  broadcastPriorityToType,
  type SettingsKey,
} from './config';
import { createNotificationListRenderer, renderEmptyState } from './columns';
import {
  NotificationStatsRow,
  BroadcastModal,
  NotificationSettingsDrawer,
  type BroadcastAudience,
} from './NotificationCenterModals';
import type { NotificationItem, NotificationStats } from './types';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text } = Typography;

const NotificationCenter: React.FC = () => {
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  // Broadcast modal state (admin only)
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [broadcastForm] = Form.useForm();
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);
  const [broadcastAudience, setBroadcastAudience] = useState<BroadcastAudience>('all');
  const [selectedBroadcastUsers, setSelectedBroadcastUsers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Notification settings drawer state
  const [settingsDrawerVisible, setSettingsDrawerVisible] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(
    null
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Clear read notifications — P0 修复：调用后端 API 清除已读
  const handleClearRead = async () => {
    try {
      await clearReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.read));
      message.success('已清除已读通知');
      await fetchStats();
    } catch (error) {
      message.error('清除已读通知失败');
    }
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
      // Form validation errors are handled by Ant Design
      if (error && typeof error === 'object' && 'errorFields' in error) {
        // Ant Design form validation error
      } else {
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

  // Factory-built list renderer, memoised on the expanded-id set it closes over
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

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BellOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            通知中心
          </Title>
          <Text type="secondary">共 {notifications.length} 条通知</Text>
        </div>
        <Space>
          {isAdmin() && (
            <Button icon={<SoundOutlined />} onClick={openBroadcastModal}>
              广播通知
            </Button>
          )}
          <Button icon={<SettingOutlined />} onClick={openSettingsDrawer}>
            通知设置
          </Button>
          <Button
            type="primary"
            ghost
            icon={<CheckOutlined />}
            onClick={handleMarkAllAsRead}
            disabled={stats.unread === 0}
          >
            全部已读
          </Button>
          <Popconfirm
            title="确定清除所有已读通知？"
            onConfirm={handleClearRead}
            okText="确定"
            cancelText="取消"
          >
            <Button
              icon={<ClearOutlined />}
              disabled={notifications.filter((n) => n.read).length === 0}
            >
              清除已读
            </Button>
          </Popconfirm>
        </Space>
      </div>

      {/* Stats row */}
      <NotificationStatsRow stats={stats} />

      {/* Tab navigation */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabDefinitions.map((tab) => ({
          key: tab.key,
          label: tab.label,
        }))}
        style={{ marginBottom: spacing.md }}
      />

      {/* Pagination - Top */}
      {total > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
            padding: '8px 12px',
            background: colors.neutral[50],
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 13, color: colors.neutral[600] }}>
            共 {total} 条通知，第 {currentPage} 页
          </span>
          <Pagination
            current={currentPage}
            total={total}
            pageSize={pageSize}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onChange={handlePageChange}
            onShowSizeChange={handlePageChange}
            size="small"
          />
        </div>
      )}

      {/* Notification list */}
      <List
        dataSource={notifications}
        loading={loading}
        renderItem={(item: NotificationItem) => {
          const Item = NotificationListRenderer;
          return <Item item={item} />;
        }}
        locale={{ emptyText: renderEmptyState() }}
      />

      {/* Pagination - Bottom */}
      {total > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: spacing.lg,
            marginBottom: spacing.md,
            padding: '16px 0',
            borderTop: '1px solid colors.neutral[200]',
          }}
        >
          <Pagination
            current={currentPage}
            total={total}
            pageSize={pageSize}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            showTotal={(t) => `共 ${t} 条通知`}
            onChange={handlePageChange}
            onShowSizeChange={handlePageChange}
          />
        </div>
      )}

      {/* Broadcast Modal (admin only) */}
      {isAdmin() && (
        <BroadcastModal
          open={broadcastModalVisible}
          onClose={() => setBroadcastModalVisible(false)}
          form={broadcastForm}
          audience={broadcastAudience}
          onAudienceChange={setBroadcastAudience}
          selectedUsers={selectedBroadcastUsers}
          onSelectedUsersChange={setSelectedBroadcastUsers}
          availableUsers={availableUsers}
          usersLoading={usersLoading}
          submitLoading={broadcastSubmitting}
          onSubmit={handleBroadcastSubmit}
        />
      )}

      {/* Notification Settings Drawer */}
      <NotificationSettingsDrawer
        open={settingsDrawerVisible}
        onClose={() => setSettingsDrawerVisible(false)}
        loading={settingsLoading}
        saving={settingsSaving}
        settings={notificationSettings}
        onToggle={handleToggleSetting}
      />
    </div>
  );
};

export default NotificationCenter;
