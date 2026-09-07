/**
 * Sessions Detail Drawer
 * 抽取自 index.tsx (P2-9 Phase 130)
 */
import React from 'react';
import { Drawer, Descriptions, Space, Typography, Tag, Button, Popconfirm } from 'antd';
import { UserOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import type { UserSession } from '../types';
import { statusColorMap, statusLabelMap, statusIconMap } from '../constants';
import { formatDuration } from '../helpers';

const { Text } = Typography;

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedSession: UserSession | null;
  handleRevoke: (id: string) => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  open,
  onClose,
  selectedSession,
  handleRevoke,
}) => (
  <Drawer
    title="会话详情"
    open={open}
    onClose={onClose}
    width={640}
    destroyOnClose
  >
    {selectedSession && (
      <>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="用户" span={2}>
            <Space>
              <UserOutlined style={{ color: colors.neutral[400] }} />
              <Text strong>{selectedSession.userId}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Session ID" span={2}>
            <Text code>{selectedSession.sessionId}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="IP 地址">
            <Text style={{ fontFamily: 'monospace' }}>{selectedSession.ipAddress}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag
              color={statusColorMap[selectedSession.status]}
              icon={statusIconMap[selectedSession.status]}
            >
              {statusLabelMap[selectedSession.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="浏览器" span={2}>
            {selectedSession.userAgent}
          </Descriptions.Item>
          <Descriptions.Item label="开始时间" span={2}>
            {dayjs(selectedSession.startedAt).format('YYYY-MM-DD HH:mm:ss')}
            <Text type="secondary" style={{ marginLeft: spacing.sm }}>
              ({dayjs(selectedSession.startedAt).fromNow()})
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="最后活跃" span={2}>
            {dayjs(selectedSession.lastActive).format('YYYY-MM-DD HH:mm:ss')}
            <Text type="secondary" style={{ marginLeft: spacing.sm }}>
              ({dayjs(selectedSession.lastActive).fromNow()})
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="会话时长">
            {formatDuration(selectedSession.duration)}
          </Descriptions.Item>
        </Descriptions>

        {selectedSession.status === 'active' && (
          <div style={{ marginTop: spacing.lg }}>
            <Popconfirm
              title="确认撤销该会话？"
              description="撤销后用户需要重新登录"
              onConfirm={() => {
                handleRevoke(selectedSession.id);
                onClose();
              }}
            >
              <Button danger icon={<DeleteOutlined />}>
                撤销会话
              </Button>
            </Popconfirm>
          </div>
        )}
      </>
    )}
  </Drawer>
);
