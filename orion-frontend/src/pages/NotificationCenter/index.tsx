/**
 * NotificationCenter Page
 * - Top stats row: Unread count, Critical alerts, Today's notifications, This week's total
 * - Tab navigation: All | Unread | Tickets | System | Read
 * - Notification list with expandable content, priority indicators, type icons
 * - Mark all as read, Clear read notifications actions
 * - Empty state for no notifications
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
} from '@/api/notifications';
import type { MockNotification } from '@/pages/__mocks__/mockNotificationData';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Configuration
// ============================================================================

// Icon mapping for notification types
const typeIconMap: Record<string, React.ReactElement> = {
  ticket_assigned: <UserAddOutlined style={{ color: colors.primary[500], fontSize: spacing[5] }} />,
  ticket_escalated: <ArrowUpOutlined style={{ color: colors.warning[500], fontSize: spacing[5] }} />,
  sla_warning: <WarningOutlined style={{ color: colors.warning[500], fontSize: spacing[5] }} />,
  sla_breached: <ExclamationCircleOutlined style={{ color: colors.error[500], fontSize: spacing[5] }} />,
  pipeline_completed: <CheckCircleOutlined style={{ color: colors.success[500], fontSize: spacing[5] }} />,
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
  const [notifications, setNotifications] = useState<MockNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ unread: 0, critical: 0, today: 0, thisWeek: 0 });

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

      const { data } = await getNotifications({
        page: 1,
        pageSize: 50,
        type: typeParam,
        read: readParam,
      });
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      message.error('获取通知列表失败');
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const data = await getNotificationStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchStats();
  }, [activeTab]);

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
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      fetchStats();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      message.success('已全部标记为已读');
      fetchStats();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      message.error('操作失败');
    }
  };

  // Delete notification
  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      message.success('通知已删除');
      fetchStats();
    } catch (error) {
      console.error('Failed to delete notification:', error);
      message.error('删除失败');
    }
  };

  // Clear read notifications
  const handleClearRead = () => {
    setNotifications((prev) => prev.filter((n) => !n.read));
    message.success('已清除已读通知');
    fetchStats();
  };

  // Tab change handler
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setExpandedIds(new Set());
  };

  // Render stats row
  const renderStatsRow = () => (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={12} sm={6}>
        <Card size="small" style={{ textAlign: 'center' }}>
          <Statistic
            title="未读"
            value={stats.unread}
            valueStyle={{ color: stats.unread > 0 ? colors.error[500] : undefined, fontSize: spacing[6] }}
            prefix={<BellOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={{ textAlign: 'center' }}>
          <Statistic
            title="紧急"
            value={stats.critical}
            valueStyle={{ color: stats.critical > 0 ? colors.error[500] : undefined, fontSize: spacing[6] }}
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
  const renderNotificationItem = (item: MockNotification) => {
    const isExpanded = expandedIds.has(item.id);
    const priorityConf = priorityConfig[item.priority];
    const typeIcon = typeIconMap[item.type] || <BellOutlined style={{ fontSize: spacing[5] }} />;
    const typeLabel = typeLabelMap[item.type] || item.type;

    // Background color for priority (only critical and high)
    const hasPriorityBg = item.priority === 'critical' || item.priority === 'high';
    const bgColor = hasPriorityBg ? priorityConf.bg : (item.read ? 'transparent' : 'rgba(24, 144, 255, 0.02)');
    const borderLeft = item.read
      ? '3px solid transparent'
      : `3px solid ${priorityConf.color}`;

    return (
      <List.Item
        style={{
          padding: 16,
          background: bgColor,
          borderLeft,
          borderRadius: 8,
          marginBottom: 8,
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
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
                style={{ marginTop: spacing[3], borderTop: `1px solid ${colors.light.border.light}`, paddingTop: spacing[3] }}
                onClick={(e) => e.stopPropagation()}
              >
                {item.actions && item.actions.length > 0 && (
                  <Space style={{ marginBottom: 8 }}>
                    {item.actions.map((action, idx) => (
                      <Button
                        key={idx}
                        type={action.type as 'primary' | 'default' | 'link' | 'text' | 'dashed' | undefined}
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
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <BellOutlined style={{ marginRight: 8 }} />
            通知中心
          </Title>
          <Text type="secondary">
            共 {notifications.length} 条通知
          </Text>
        </div>
        <Space>
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
            <Button icon={<ClearOutlined />} disabled={notifications.filter((n) => n.read).length === 0}>
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
        style={{ marginBottom: 16 }}
      />

      {/* Notification list */}
      <List
        dataSource={notifications}
        loading={loading}
        renderItem={renderNotificationItem}
        locale={{ emptyText: renderEmptyState() }}
      />
    </div>
  );
};

export default NotificationCenter;
