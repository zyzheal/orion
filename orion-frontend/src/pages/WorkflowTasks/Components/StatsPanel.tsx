/**
 * Components/StatsPanel.tsx - WorkflowTasks 任务统计面板
 * 抽取自 WorkflowTasks/index.tsx (P2-9 Phase 99)
 */
import React from 'react';
import { Card, Space, Typography } from 'antd';
import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Text } = Typography;

interface StatsPanelProps {
  stats: { total: number; pending: number; assigned: number; completed: number };
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => (
  <Card size="small" style={{ marginBottom: spacing.md }}>
    <Space size="large">
      <Space>
        <Text type="secondary">总计:</Text>
        <Text strong>{stats.total}</Text>
      </Space>
      <Space>
        <ClockCircleOutlined style={{ color: colors.primary[500] }} />
        <Text type="secondary">待认领:</Text>
        <Text strong style={{ color: colors.primary[500] }}>
          {stats.pending}
        </Text>
      </Space>
      <Space>
        <ExclamationCircleOutlined style={{ color: colors.warning[500] }} />
        <Text type="secondary">已认领:</Text>
        <Text strong style={{ color: colors.warning[500] }}>
          {stats.assigned}
        </Text>
      </Space>
      <Space>
        <CheckCircleOutlined style={{ color: colors.success[500] }} />
        <Text type="secondary">已完成:</Text>
        <Text strong style={{ color: colors.success[500] }}>
          {stats.completed}
        </Text>
      </Space>
    </Space>
  </Card>
);
