/**
 * NotificationBell Component
 * - Bell icon with unread count badge
 * - Click to show dropdown with latest 5 notifications
 * - "View all" link to /notifications
 * - "Mark all read" button
 */
import React, { useState, useEffect } from 'react';
import { Badge, Dropdown, List, Typography, Button, Space, Empty } from 'antd';
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
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getNotifications, markAllAsRead } from '@/api/notifications';
import type { MockNotification } from '@/pages/__mocks__/mockNotificationData';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Text } = Typography;

// Icon mapping for notification types
const typeIconMap: Record<string, React.ReactElement> = {
  ticket_assigned: <UserAddOutlined style={{ color: '#1890ff' }} />,
  ticket_escalated: <ArrowUpOutlined style={{ color: '#fa8c16' }} />,
  sla_warning: <WarningOutlined style={{ color: '#faad14' }} />,
  sla_breached: <ExclamationCircleOutlined style={{ color: '#f5222d' }} />,
  pipeline_completed: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  comment_mention: <MessageOutlined style={{ color: '#722ed1' }} />,
  transfer_request: <SwapOutlined style={{ color: '#13c2c2' }} />,
  system_alert: <AlertOutlined style={{ color: '#f5222d' }} />,
};

// Priority color mapping
const priorityColorMap: Record<string, string> = {
  critical: '#f5222d',
  high: '#fa8c16',
  medium: '#faad14',
  low: '#d9d9d9',
};

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<MockNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch notifications on mount and when dropdown opens
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await getNotifications({ page: 1, pageSize: 5 });
      setNotifications(data);
      const unread = data.filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Navigate to notification center
  const handleViewAll = () => {
    setDropdownOpen(false);
    navigate('/notifications');
  };

  // Dropdown content
  const dropdownContent = (
    <div style={{
      width: 360,
      padding: 0,
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text strong>通知</Text>
        <Button type="link" size="small" onClick={handleMarkAllRead}>
          全部已读
        </Button>
      </div>

      {/* Notification list */}
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {notifications.length > 0 ? (
          <List
            dataSource={notifications}
            renderItem={(item) => (
              <List.Item
                style={{
                  padding: '12px 16px',
                  background: item.read ? 'transparent' : 'rgba(24, 144, 255, 0.04)',
                  cursor: 'pointer',
                  borderLeft: item.read
                    ? 'none'
                    : `3px solid ${priorityColorMap[item.priority] || '#1890ff'}`,
                }}
              >
                <List.Item.Meta
                  avatar={typeIconMap[item.type] || <BellOutlined />}
                  title={
                    <Space direction="vertical" size={0} style={{ width: '100%' }}>
                      <Text
                        ellipsis={{ tooltip: item.title }}
                        strong={!item.read}
                        style={{ fontSize: 13 }}
                      >
                        {item.title}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(item.createdAt).fromNow()}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <div style={{ padding: '40px 16px' }}>
            <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(0, 0, 0, 0.06)',
          textAlign: 'center',
        }}
      >
        <Button type="link" onClick={handleViewAll}>
          查看全部通知
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
      menu={{ items: [] }}
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
      arrow
      getPopupContainer={() => document.body}
    >
      <Badge count={unreadCount} offset={[-4, 4]} size="small">
        <Button
          icon={<BellOutlined />}
          type="text"
          size="large"
          loading={loading}
          style={{
            fontSize: 18,
            color: unreadCount > 0 ? '#f5222d' : undefined,
          }}
          title="通知"
        />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBell;
