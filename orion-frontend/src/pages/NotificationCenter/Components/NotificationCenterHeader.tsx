/**
 * NotificationCenterHeader - 页面头部 (标题 + 操作按钮)
 * 抽取自 index.tsx (P2-9 Phase 121)
 */
import React from 'react';
import { Typography, Button, Space, Popconfirm } from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  ClearOutlined,
  SettingOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { NotificationCenterState } from '../useNotificationCenterState';

const { Title, Text } = Typography;

interface NotificationCenterHeaderProps {
  state: NotificationCenterState;
}

export const NotificationCenterHeader: React.FC<NotificationCenterHeaderProps> = ({ state }) => {
  const {
    notifications,
    stats,
    isAdmin,
    handleMarkAllAsRead,
    handleClearRead,
    openBroadcastModal,
    openSettingsDrawer,
  } = state;

  return (
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
  );
};
