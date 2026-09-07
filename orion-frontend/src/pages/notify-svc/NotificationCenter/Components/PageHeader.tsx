/**
 * NotificationCenter page header
 * 抽取自 index.tsx (P2-9 Phase 159)
 */
import { Button, Popconfirm, Space, Typography } from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  ClearOutlined,
  SoundOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  notificationCount: number;
  isAdmin: () => boolean;
  unreadCount: number;
  readCount: number;
  onOpenBroadcast: () => void;
  onOpenSettings: () => void;
  onMarkAllAsRead: () => void;
  onClearRead: () => void;
}

export const PageHeader = ({
  notificationCount,
  isAdmin,
  unreadCount,
  readCount,
  onOpenBroadcast,
  onOpenSettings,
  onMarkAllAsRead,
  onClearRead,
}: PageHeaderProps) => (
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
      <Text type="secondary">共 {notificationCount} 条通知</Text>
    </div>
    <Space>
      {isAdmin() && (
        <Button icon={<SoundOutlined />} onClick={onOpenBroadcast}>
          广播通知
        </Button>
      )}
      <Button icon={<SettingOutlined />} onClick={onOpenSettings}>
        通知设置
      </Button>
      <Button
        type="primary"
        ghost
        icon={<CheckOutlined />}
        onClick={onMarkAllAsRead}
        disabled={unreadCount === 0}
      >
        全部已读
      </Button>
      <Popconfirm title="确定清除所有已读通知？" onConfirm={onClearRead} okText="确定" cancelText="取消">
        <Button icon={<ClearOutlined />} disabled={readCount === 0}>
          清除已读
        </Button>
      </Popconfirm>
    </Space>
  </div>
);
