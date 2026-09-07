/**
 * Engineer Dashboard Header
 * 抽取自 index.tsx (P2-9 Phase 129)
 */
import React from 'react';
import { Typography } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { EngineerDashboardData } from '@/types/pages';

const { Title, Text } = Typography;

interface EngineerDashboardHeaderProps {
  data: EngineerDashboardData;
}

export const EngineerDashboardHeader: React.FC<EngineerDashboardHeaderProps> = ({ data }) => (
  <div style={{ marginBottom: spacing.lg }}>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <ToolOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
      个人看板
    </Title>
    <Text type="secondary">
      {data.personalOverview.engineerName} — 个人效能与工单管理 —{' '}
      {dayjs().format('YYYY-MM-DD HH:mm')}
    </Text>
  </div>
);
