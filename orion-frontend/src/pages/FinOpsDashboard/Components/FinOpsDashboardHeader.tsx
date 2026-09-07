/**
 * FinOpsDashboardHeader - 页面标题
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
import React from 'react';
import { Typography } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { FinOpsDashboardState } from '../useFinOpsDashboardState';

const { Title, Text } = Typography;

interface FinOpsDashboardHeaderProps {
  state: FinOpsDashboardState;
}

export const FinOpsDashboardHeader: React.FC<FinOpsDashboardHeaderProps> = ({ state }) => {
  const { dataTimestamp } = state;

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
          <DollarOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          成本分析
        </Title>
        <Text type="secondary">数据更新时间：{dataTimestamp}</Text>
      </div>
    </div>
  );
};
