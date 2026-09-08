import { Button, Card, Descriptions, Divider, Space, Tag, Typography } from 'antd';
const { Paragraph } = Typography;
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import { priorityConfig, typeLabelMap } from '../constants';

const { Title, Text } = Typography;

export function NotificationCard({ notification }: { notification: any }) {
  const priorityConf = priorityConfig[notification.priority];
  const typeLabel = typeLabelMap[notification.type] || notification.type;

  return (
    <Card
      style={{
        background:
          notification.priority === 'critical' || notification.priority === 'high'
            ? priorityConf?.bg
            : 'transparent',
        borderLeft: notification.read
          ? '3px solid transparent'
          : `3px solid ${priorityConf?.color}`,
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
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

        <Paragraph style={{ fontSize: 14, color: colors.neutral[800], whiteSpace: 'pre-wrap' }}>
          {notification.content}
        </Paragraph>

        <Divider />

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

        {notification.actions && notification.actions.length > 0 && (
          <>
            <Divider />
            <div>
              <Text strong style={{ marginRight: spacing.md }}>
                相关操作
              </Text>
              <Space>
                {notification.actions.map((action: any, idx: number) => (
                  <Button key={String(idx)} type={action.type || 'default'}>
                    {action.label}
                  </Button>
                ))}
              </Space>
            </div>
          </>
        )}
      </Space>
    </Card>
  );
}

// Need to import Button for actions
