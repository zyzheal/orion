/**
 * NotificationCenter Page
 * - Top stats row: Unread count, Critical alerts, Today's notifications, This week's total
 * - Tab navigation: All | Unread | Tickets | System | Read
 * - Notification list with expandable content, priority indicators, type icons
 * - Mark all as read, Clear read notifications actions
 * - Empty state for no notifications
 * - Admin broadcast modal (broadcast messages to multiple users)
 * - User notification settings drawer (toggle notification preferences)
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Tabs,
  List,
  Tag,
  Space,
  Card,
  Statistic,
  Row,
  Col,
  Empty,
  message,
  Popconfirm,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Drawer,
  Divider,
  Spin,
  Pagination,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  BellOutlined,
  UserAddOutlined,
  ArrowUpOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  SwapOutlined,
  AlertOutlined,
  DeleteOutlined,
  CheckOutlined,
  ClearOutlined,
  SoundOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
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

// ============================================================================
// Local type for notification data (matches API response shape)
// ============================================================================

interface NotificationItem {
  id: string;
  title: string;
  content: string;
  type:
    | 'ticket_assigned'
    | 'ticket_escalated'
    | 'sla_warning'
    | 'sla_breached'
    | 'pipeline_completed'
    | 'system_alert'
    | 'comment_mention'
    | 'transfer_request';
  priority: 'critical' | 'high' | 'medium' | 'low';
  read: boolean;
  createdAt: string;
  relatedId?: string;
  sender: string;
  actions?: Array<{ label: string; type: string }>;
}

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Configuration
// ============================================================================

// Icon mapping for notification types
const typeIconMap: Record<string, React.ReactElement> = {
  ticket_assigned: <UserAddOutlined style={{ color: colors.primary[500], fontSize: spacing[5] }} />,
  ticket_escalated: (
    <ArrowUpOutlined style={{ color: colors.warning[500], fontSize: spacing[5] }} />
  ),
  sla_warning: <WarningOutlined style={{ color: colors.warning[500], fontSize: spacing[5] }} />,
  sla_breached: (
    <ExclamationCircleOutlined style={{ color: colors.error[500], fontSize: spacing[5] }} />
  ),
  pipeline_completed: (
    <CheckCircleOutlined style={{ color: colors.success[500], fontSize: spacing[5] }} />
  ),
  comment_mention: <MessageOutlined style={{ color: colors.purple[500], fontSize: spacing[5] }} />,
  transfer_request: <SwapOutlined style={{ color: colors.info[500], fontSize: spacing[5] }} />,
  system_alert: <AlertOutlined style={{ color: colors.error[500], fontSize: spacing[5] }} />,
};

// Type label mapping
const typeLabelMap: Record<string, string> = {
  ticket_assigned: '工单分配',
  ticket_escalated: '工单升级',
  sla_warning: 'SLA 警告',
  sla_breached: 'SLA 违约',
  pipeline_completed: 'Pipeline 完成',
  system_alert: '系统告警',
  comment_mention: '评论提及',
  transfer_request: '转派请求',
};

// Priority config
const priorityConfig: Record<string, { color: string; label: string; bg: string }> = {
  critical: { color: colors.error[500], label: '紧急', bg: 'rgba(245, 34, 45, 0.04)' },
  high: { color: colors.warning[500], label: '高', bg: 'rgba(250, 140, 22, 0.04)' },
  medium: { color: colors.warning[500], label: '中', bg: 'transparent' },
  low: { color: colors.neutral[300], label: '低', bg: 'transparent' },
};

// Tab definitions
const tabDefinitions = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'tickets', label: '工单' },
  { key: 'system', label: '系统' },
  { key: 'read', label: '已读' },
];

// ============================================================================
// Component
// ============================================================================

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ unread: 0, critical: 0, today: 0, thisWeek: 0 });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Broadcast modal state (admin only)
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

  // Render stats row
  const renderStatsRow = () => (
    <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
      <Col xs={12} sm={6}>
        <Card size="small" style={{ textAlign: 'center' }}>
          <Statistic
            title="未读"
            value={stats.unread}
            valueStyle={{
              color: stats.unread > 0 ? colors.error[500] : undefined,
              fontSize: spacing[6],
            }}
            prefix={<BellOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={{ textAlign: 'center' }}>
          <Statistic
            title="紧急"
            value={stats.critical}
            valueStyle={{
              color: stats.critical > 0 ? colors.error[500] : undefined,
              fontSize: spacing[6],
            }}
            prefix={<ExclamationCircleOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={{ textAlign: 'center' }}>
          <Statistic
            title="今日"
            value={stats.today}
            valueStyle={{ fontSize: spacing[6] }}
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={{ textAlign: 'center' }}>
          <Statistic
            title="本周"
            value={stats.thisWeek}
            valueStyle={{ fontSize: spacing[6] }}
            prefix={<BellOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );

  // Render notification item
  const renderNotificationItem = (item: NotificationItem) => {
    const isExpanded = expandedIds.has(item.id);
    const priorityConf = priorityConfig[item.priority];
    const typeIcon = typeIconMap[item.type] || <BellOutlined style={{ fontSize: spacing[5] }} />;
    const typeLabel = typeLabelMap[item.type] || item.type;

    // Background color for priority (only critical and high)
    const hasPriorityBg = item.priority === 'critical' || item.priority === 'high';
    const bgColor = hasPriorityBg
      ? priorityConf.bg
      : item.read
        ? 'transparent'
        : 'rgba(24, 144, 255, 0.02)';
    const borderLeft = item.read ? '3px solid transparent' : `3px solid ${priorityConf.color}`;

    return (
      <List.Item
        style={{
          padding: spacing.md,
          background: bgColor,
          borderLeft,
          borderRadius: 8,
          marginBottom: spacing.sm,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => {
          if (!item.read) {
            handleMarkAsRead(item.id);
          }
          toggleExpand(item.id);
        }}
      >
        <Space align="start" style={{ width: '100%' }} size={12}>
          {/* Icon */}
          <div style={{ marginTop: 2, flexShrink: 0 }}>{typeIcon}</div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
              <Text
                strong={!item.read}
                style={{
                  fontSize: spacing[4],
                  color: item.read ? undefined : colors.neutral[900],
                  flex: 1,
                }}
                ellipsis={{ tooltip: item.title }}
              >
                {item.title}
              </Text>
              {/* Priority badge */}
              <Tag color={priorityConf.color} style={{ fontSize: spacing[2], margin: 0 }}>
                {priorityConf.label}
              </Tag>
              {/* Type tag */}
              <Tag style={{ fontSize: spacing[2], margin: 0 }}>{typeLabel}</Tag>
              {/* Unread dot */}
              {!item.read && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: colors.primary[500],
                    flexShrink: 0,
                  }}
                />
              )}
            </div>

            {/* Content (truncated) */}
            <Paragraph
              ellipsis={{ rows: isExpanded ? 10 : 2, tooltip: !isExpanded }}
              style={{ margin: '4px 0 8px', fontSize: spacing[3], color: colors.neutral[500] }}
            >
              {item.content}
            </Paragraph>

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                {item.sender}
              </Text>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                {dayjs(item.createdAt).fromNow()}
              </Text>
              {item.relatedId && (
                <Text type="secondary" style={{ fontSize: spacing[3], color: colors.primary[500] }}>
                  关联: {item.relatedId}
                </Text>
              )}
            </div>

            {/* Expanded actions */}
            {isExpanded && (
              <div
                style={{
                  marginTop: spacing[3],
                  borderTop: `1px solid ${colors.light.border.light}`,
                  paddingTop: spacing[3],
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {item.actions && item.actions.length > 0 && (
                  <Space style={{ marginBottom: spacing.sm }}>
                    {item.actions.map((action, idx) => (
                      <Button
                        key={idx}
                        type={
                          action.type as
                            | 'primary'
                            | 'default'
                            | 'link'
                            | 'text'
                            | 'dashed'
                            | undefined
                        }
                        size="small"
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Space>
                )}
                <Space>
                  {!item.read && (
                    <Button
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => handleMarkAsRead(item.id)}
                    >
                      标记已读
                    </Button>
                  )}
                  <Popconfirm
                    title="确定删除此通知？"
                    onConfirm={() => handleDelete(item.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            )}
          </div>
        </Space>
      </List.Item>
    );
  };

  // Empty state
  const renderEmptyState = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="暂无通知"
      style={{ padding: '48px 0' }}
    />
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
      {renderStatsRow()}

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, padding: '8px 12px', background: colors.neutral[50], borderRadius: 8 }}>
          <span style={{ fontSize: 13, color: colors.neutral[600] }}>
            共 {total} 条通知，每页 {pageSize} 条
          </span>
          <Pagination
            current={currentPage}
            total={total}
            pageSize={pageSize}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={['10', '20', '50', '100']}
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
        renderItem={renderNotificationItem}
        locale={{ emptyText: renderEmptyState() }}
      />

      {/* Pagination - Bottom */}
      {total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: spacing.lg, marginBottom: spacing.md, padding: '16px 0', borderTop: '1px solid colors.neutral[200]' }}>
          <Pagination
            current={currentPage}
            total={total}
            pageSize={pageSize}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={['10', '20', '50', '100']}
            showTotal={(t) => `共 ${t} 条通知`}
            onChange={handlePageChange}
            onShowSizeChange={handlePageChange}
          />
        </div>
      )}

      {/* Broadcast Modal (admin only) */}
      <Modal
        title={
          <Space>
            <SoundOutlined /> 广播通知
          </Space>
        }
        open={broadcastModalVisible}
        onCancel={() => setBroadcastModalVisible(false)}
        onOk={handleBroadcastSubmit}
        confirmLoading={broadcastSubmitting}
        width={560}
        destroyOnClose
      >
        <Form form={broadcastForm} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入广播标题' }]}
          >
            <Input placeholder="如: 系统维护通知" />
          </Form.Item>
          <Form.Item
            name="message"
            label="消息内容"
            rules={[{ required: true, message: '请输入消息内容' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入广播消息内容..." />
          </Form.Item>
          <Form.Item label="目标受众" initialValue="all">
            <Select
              value={broadcastAudience}
              onChange={(val) => {
                setBroadcastAudience(val);
                if (val === 'all') setSelectedBroadcastUsers([]);
              }}
              options={[
                { label: '全体用户', value: 'all' },
                { label: '指定用户', value: 'specific' },
              ]}
            />
          </Form.Item>
          {broadcastAudience === 'specific' && (
            <Form.Item label="选择用户">
              <Select
                mode="multiple"
                loading={usersLoading}
                value={selectedBroadcastUsers}
                onChange={setSelectedBroadcastUsers}
                options={availableUsers.map((u) => ({
                  label: u.name || u.username,
                  value: u.id,
                }))}
                placeholder="搜索并选择用户"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          )}
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select
              options={[
                { label: '紧急', value: 'critical' },
                { label: '高', value: 'high' },
                { label: '中', value: 'medium' },
                { label: '低', value: 'low' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Notification Settings Drawer */}
      <Drawer
        title={
          <Space>
            <SettingOutlined /> 通知设置
          </Space>
        }
        open={settingsDrawerVisible}
        onClose={() => setSettingsDrawerVisible(false)}
        width={480}
        destroyOnClose
      >
        {settingsLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spin size="large" />
          </div>
        ) : notificationSettings ? (
          <div>
            {/* Channel Settings */}
            <Title level={5}>通知渠道</Title>
            <div style={{ marginBottom: spacing.md }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>邮件通知</Text>
                <Switch
                  checked={notificationSettings.emailEnabled}
                  onChange={() => handleToggleSetting('emailEnabled')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>声音提醒</Text>
                <Switch
                  checked={notificationSettings.soundEnabled}
                  onChange={() => handleToggleSetting('soundEnabled')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>桌面推送</Text>
                <Switch
                  checked={notificationSettings.desktopEnabled}
                  onChange={() => handleToggleSetting('desktopEnabled')}
                  loading={settingsSaving}
                />
              </div>
            </div>

            <Divider />

            {/* Event Type Settings */}
            <Title level={5}>通知类型</Title>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>工单分配</Text>
                <Switch
                  checked={notificationSettings.ticketAssigned}
                  onChange={() => handleToggleSetting('ticketAssigned')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>工单升级</Text>
                <Switch
                  checked={notificationSettings.ticketEscalated}
                  onChange={() => handleToggleSetting('ticketEscalated')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>SLA 警告</Text>
                <Switch
                  checked={notificationSettings.slaWarning}
                  onChange={() => handleToggleSetting('slaWarning')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>SLA 违约</Text>
                <Switch
                  checked={notificationSettings.slaBreached}
                  onChange={() => handleToggleSetting('slaBreached')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>Pipeline 完成</Text>
                <Switch
                  checked={notificationSettings.pipelineCompleted}
                  onChange={() => handleToggleSetting('pipelineCompleted')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>系统告警</Text>
                <Switch
                  checked={notificationSettings.systemAlert}
                  onChange={() => handleToggleSetting('systemAlert')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>评论提及</Text>
                <Switch
                  checked={notificationSettings.commentMention}
                  onChange={() => handleToggleSetting('commentMention')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>转派请求</Text>
                <Switch
                  checked={notificationSettings.transferRequest}
                  onChange={() => handleToggleSetting('transferRequest')}
                  loading={settingsSaving}
                />
              </div>
            </div>
          </div>
        ) : (
          <Empty description="无法加载通知设置" />
        )}
      </Drawer>
    </div>
  );
};

export default NotificationCenter;
