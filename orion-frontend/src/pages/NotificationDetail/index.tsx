/**
 * NotificationDetail Page
 * - Full notification detail view
 * - Read/Unread toggle, Delete
 * - Related actions
 * - Back to list navigation
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Tag,
  Space,
  Card,
  Descriptions,
  message,
  Spin,
  Empty,
  Popconfirm,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  DeleteOutlined,
  UserAddOutlined,
  ArrowUpOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  SwapOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { getNotification, markAsRead, deleteNotification } from '@/api/notifications';
import { colors, spacing } from '@/tokens';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;

// Icon mapping for notification types
const typeIconMap: Record<string, React.ReactElement> = {
  ticket_assigned: <UserAddOutlined style={{ fontSize: 24, color: colors.primary[500] }} />,
  ticket_escalated: <ArrowUpOutlined style={{ fontSize: 24, color: colors.warning[500] }} />,
  sla_warning: <WarningOutlined style={{ fontSize: 24, color: colors.warning[500] }} />,
  sla_breached: <ExclamationCircleOutlined style={{ fontSize: 24, color: colors.error[500] }} />,
  pipeline_completed: <CheckCircleOutlined style={{ fontSize: 24, color: colors.success[500] }} />,
  comment_mention: <MessageOutlined style={{ fontSize: 24, color: colors.purple[500] }} />,
  transfer_request: <SwapOutlined style={{ fontSize: 24, color: colors.info[500] }} />,
  system_alert: <AlertOutlined style={{ fontSize: 24, color: colors.error[500] }} />,
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

const NotificationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [notification, setNotification] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchNotification = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getNotification(id);
      setNotification(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`获取通知详情失败：${error.message}`);
      } else {
        message.error('获取通知详情失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotification();
  }, [id]);

  const handleMarkAsRead = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await markAsRead(id);
      setNotification((prev: any) => ({ ...prev, read: true }));
      message.success('已标记为已读');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`操作失败：${error.message}`);
      } else {
        message.error('操作失败');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await deleteNotification(id);
      message.success('通知已删除');
      navigate('/notifications');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const priorityConf = notification ? priorityConfig[notification.priority] : null;
  const typeIcon = notification ? (typeIconMap[notification.type] || null) : null;
  const typeLabel = notification ? (typeLabelMap[notification.type] || notification.type) : '';

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!notification) {
    return (
      <Empty description="通知不存在" style={{ padding: '48px 0' }}>
        <Button type="primary" onClick={() => navigate('/notifications')}>
          返回通知列表
        </Button>
      </Empty>
    );
  }

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
            <ArrowLeftOutlined
              style={{ marginRight: spacing[3], color: colors.primary[500], cursor: 'pointer' }}
              onClick={() => navigate('/notifications')}
            />
            {typeIcon}
            通知详情
          </Title>
          <Text type="secondary">查看通知完整内容与相关操作</Text>
        </div>
        <Space>
          {!notification.read && (
            <Button
              icon={<CheckOutlined />}
              onClick={handleMarkAsRead}
              loading={actionLoading}
            >
              标记已读
            </Button>
          )}
          <Popconfirm
            title="确定删除此通知？"
            onConfirm={handleDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />} loading={actionLoading}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      </div>

      {/* Notification content */}
      <Card
        style={{
          background: notification.priority === 'critical' || notification.priority === 'high'
            ? priorityConf?.bg
            : 'transparent',
          borderLeft: notification.read ? '3px solid transparent' : `3px solid ${priorityConf?.color}`,
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Title & badges */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Title level={3} style={{ margin: 0, flex: 1 }}>
                {notification.title}
              </Title>
              <Tag color={priorityConf?.color}>{priorityConf?.label}</Tag>
              <Tag>{typeLabel}</Tag>
              {!notification.read && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: colors.primary[500],
                  }}
                />
              )}
            </div>
            <Text type="secondary">
              {notification.sender} · {dayjs(notification.createdAt).fromNow()}
            </Text>
          </div>

          <Divider />

          {/* Content */}
          <Paragraph style={{ fontSize: 14, color: colors.neutral[800], whiteSpace: 'pre-wrap' }}>
            {notification.content}
          </Paragraph>

          <Divider />

          {/* Metadata */}
          <Descriptions title="通知信息" column={2} bordered size="small">
            <Descriptions.Item label="通知 ID">{notification.id}</Descriptions.Item>
            <Descriptions.Item label="类型">{typeLabel}</Descriptions.Item>
            <Descriptions.Item label="优先级">{priorityConf?.label}</Descriptions.Item>
            <Descriptions.Item label="发送方">{notification.sender}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(notification.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={notification.read ? 'default' : 'blue'}>
                {notification.read ? '已读' : '未读'}
              </Tag>
            </Descriptions.Item>
            {notification.relatedId && (
              <Descriptions.Item label="关联 ID" span={2}>
                <Text copyable style={{ color: colors.primary[500] }}>
                  {notification.relatedId}
                </Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <>
              <Divider />
              <div>
                <Text strong style={{ marginRight: spacing.md }}>
                  相关操作
                </Text>
                <Space>
                  {notification.actions.map((action: any, idx: number) => (
                    <Button key={idx} type={action.type || 'default'}>
                      {action.label}
                    </Button>
                  ))}
                </Space>
              </div>
            </>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default NotificationDetail;
