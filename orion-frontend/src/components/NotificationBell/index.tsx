/**
 * NotificationBell Component
 * - 通知铃铛入口，显示未读数量
 * - 点击展开通知面板，支持 Tabs 分类
 * - "Mark all read" 功能
 * - "View all" 链接到通知中心页面
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Dropdown, Tabs, List, Typography, Button, Space, Empty, Tag } from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  MessageOutlined,
  SwapOutlined,
  AlertOutlined,
  UserAddOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getNotifications, markAllAsRead } from '@/api/notifications';
import type { MockNotification } from '@/api/notifications';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';
import { spacing } from '@/tokens';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Text } = Typography;

// 通知类型图标映射
const typeIconMap: Record<string, React.ReactElement> = {
  ticket_assigned: <UserAddOutlined />,
  ticket_escalated: <ArrowUpOutlined />,
  sla_warning: <WarningOutlined />,
  sla_breached: <ExclamationCircleOutlined />,
  pipeline_completed: <CheckCircleOutlined />,
  comment_mention: <MessageOutlined />,
  transfer_request: <SwapOutlined />,
  system_alert: <AlertOutlined />,
};

// 优先级颜色映射
const priorityColorMap: Record<string, string> = {
  critical: colors.error[500],
  high: colors.warning[500],
  medium: colors.primary[500],
  low: colors.neutral[400],
};

// 优先级标签文本
const priorityLabelMap: Record<string, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

// Tabs 分类定义
interface TabDef {
  key: string;
  label: string;
  filter?: (n: MockNotification) => boolean;
}

const tabs: TabDef[] = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读', filter: (n) => !n.read },
  { key: 'alerts', label: '告警', filter: (n) => ['system_alert', 'sla_warning', 'sla_breached'].includes(n.type) },
  { key: 'tickets', label: '工单', filter: (n) => ['ticket_assigned', 'ticket_escalated', 'transfer_request'].includes(n.type) },
];

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<MockNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // 获取通知数据
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getNotifications({ page: 1, pageSize: 50 });
      setNotifications(data);
      const unread = data.filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 全部标记为已读
  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // 查看全部通知
  const handleViewAll = () => {
    setDropdownOpen(false);
    navigate('/notifications');
  };

  // 过滤当前 Tab 的通知
  const filteredNotifications = tabs.find((t) => t.key === activeTab)?.filter
    ? notifications.filter(tabs.find((t) => t.key === activeTab)!.filter!)
    : notifications;

  // 通知项渲染
  const renderNotification = (item: MockNotification) => (
    <List.Item
      style={{
        padding: '12px 16px',
        background: item.read ? 'transparent' : `${colors.primary[500]}08`,
        cursor: 'pointer',
        borderLeft: item.read ? 'none' : `3px solid ${priorityColorMap[item.priority] || colors.neutral[400]}`,
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = item.read ? `${colors.neutral[400]}10` : `${colors.primary[500]}12`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = item.read ? 'transparent' : `${colors.primary[500]}08`;
      }}
    >
      <List.Item.Meta
        avatar={
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: item.read ? `${colors.neutral[400]}15` : `${priorityColorMap[item.priority] || colors.primary[500]}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: item.read ? colors.neutral[400] : priorityColorMap[item.priority] || colors.primary[500],
            }}
          >
            {typeIconMap[item.type] || <BellOutlined />}
          </div>
        }
        title={
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text
                ellipsis={{ tooltip: item.title }}
                strong={!item.read}
                style={{ fontSize: 13, flex: 1 }}
              >
                {item.title}
              </Text>
              {!item.read && (
                <Tag
                  color={priorityColorMap[item.priority]}
                  style={{
                    fontSize: 10,
                    padding: '0 6px',
                    lineHeight: '18px',
                    borderRadius: 4,
                    marginLeft: spacing.sm,
                  }}
                >
                  {priorityLabelMap[item.priority]}
                </Tag>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {item.sender} · {dayjs(item.createdAt).fromNow()}
              </Text>
            </div>
          </Space>
        }
      />
    </List.Item>
  );

  // 通知面板内容
  const notificationPanel = (
    <div
      style={{
        width: 420,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderRadius: componentRadius.card,
        boxShadow: shadows.dropdown,
        border: `1px solid ${colors.neutral[100]}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.neutral[100]}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text strong style={{ fontSize: 14 }}>通知中心</Text>
        <Space size={12}>
          {unreadCount > 0 && (
            <Button type="link" size="small" onClick={handleMarkAllRead} style={{ padding: 0 }}>
              全部已读
            </Button>
          )}
          <Button type="link" size="small" onClick={handleViewAll} style={{ padding: 0 }}>
            <EyeOutlined /> 查看全部
          </Button>
        </Space>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        tabBarStyle={{ margin: 0, padding: '0 16px' }}
        items={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
        }))}
      />

      {/* Notification list */}
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {filteredNotifications.length > 0 ? (
          <List
            dataSource={filteredNotifications.slice(0, 20)}
            renderItem={renderNotification}
            split={false}
          />
        ) : (
          <div style={{ padding: '40px 16px' }}>
            <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        )}
      </div>

      {/* Footer */}
      {filteredNotifications.length > 20 && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: `1px solid ${colors.neutral[100]}`,
            textAlign: 'center',
          }}
        >
          <Button type="link" onClick={handleViewAll}>
            查看更多 ({filteredNotifications.length - 20} 条)
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
      menu={{ items: [] }}
      popupRender={() => notificationPanel}
      trigger={['click']}
      placement="bottomRight"
      arrow
      getPopupContainer={() => document.body}
    >
      <Badge
        count={unreadCount > 99 ? '99+' : unreadCount}
        offset={[-4, 4]}
        size="small"
        color={
          unreadCount === 0 ? undefined :
          notifications.some((n) => n.priority === 'critical' && !n.read) ? colors.error[500] :
          notifications.some((n) => n.priority === 'high' && !n.read) ? colors.warning[500] :
          colors.primary[500]
        }
      >
        <Button
          icon={<BellOutlined />}
          type="text"
          size="large"
          loading={loading}
          style={{
            fontSize: 18,
            color: unreadCount > 0 ? colors.error[500] : undefined,
          }}
          title="通知"
        />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBell;
