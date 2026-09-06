/**
 * ApprovalStatsPanel.tsx - Approval Management 统计面板
 * 抽取自 Approvals/index.tsx (P2-9 Phase 56)
 */
import React from 'react';
import { Space, Card } from 'antd';
import { Typography } from 'antd';
const { Text } = Typography;
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface ApprovalStatsPanelProps {
  stats: ApprovalStats;
}

export const ApprovalStatsPanel: React.FC<ApprovalStatsPanelProps> = ({ stats }) => (
  <Card size="small" style={{ marginBottom: spacing.md }}>
    <Space size="large">
      <Space>
        <Text type="secondary">总计:</Text>
        <Text strong>{stats.total}</Text>
      </Space>
      <Space>
        <ClockCircleOutlined style={{ color: colors.primary[500] }} />
        <Text type="secondary">待审批:</Text>
        <Text strong style={{ color: colors.primary[500] }}>
          {stats.pending}
        </Text>
      </Space>
      <Space>
        <CheckCircleOutlined style={{ color: colors.success[500] }} />
        <Text type="secondary">已通过:</Text>
        <Text strong style={{ color: colors.success[500] }}>
          {stats.approved}
        </Text>
      </Space>
      <Space>
        <StopOutlined style={{ color: colors.error[400] }} />
        <Text type="secondary">已拒绝:</Text>
        <Text strong style={{ color: colors.error[400] }}>
          {stats.rejected}
        </Text>
      </Space>
    </Space>
  </Card>
);
