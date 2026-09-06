/**
 * Header - 页面头部
 * 抽取自 index.tsx (P2-9 Phase 105)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  OrderedListOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { QueueState } from '../useQueueState';

const { Title, Text } = Typography;

interface HeaderProps {
  state: QueueState;
}

export const Header: React.FC<HeaderProps> = ({ state }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <Title
        level={2}
        style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
      >
        <OrderedListOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        队列管理
      </Title>
      <Text type="secondary">管理异步任务队列，监控任务执行状态</Text>
    </div>
    <Space>
      <Button
        icon={<ReloadOutlined />}
        onClick={() => {
          state.loadData();
          state.loadStats();
        }}
        loading={state.loading}
      >
        刷新
      </Button>
      <Button icon={<InboxOutlined />} onClick={state.openDequeue}>
        出队
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={state.openEnqueue}>
        入队
      </Button>
    </Space>
  </div>
);
