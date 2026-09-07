/**
 * RiskStatusCard - 系统风险状态卡片
 * 抽取自 index.tsx (P2-9 Phase 123)
 */
import React from 'react';
import { Space, Tag, Typography } from 'antd';
import CardPanel from '@/components/CardPanel';
import { spacing } from '@/tokens';
import type { RiskDashboardState } from '../useRiskDashboardState';

const { Text } = Typography;

interface RiskStatusCardProps {
  state: RiskDashboardState;
}

export const RiskStatusCard: React.FC<RiskStatusCardProps> = ({ state }) => {
  const { status } = state;

  return (
    <div style={{ marginBottom: spacing.lg }}>
      <CardPanel title="系统风险状态">
        <Space size="large">
          <div>
            <Text type="secondary">系统状态:</Text>{' '}
            <Tag color={status?.status === 'healthy' ? 'green' : 'red'}>
              {status?.status === 'healthy' ? '健康' : '异常'}
            </Tag>
          </div>
        </Space>
      </CardPanel>
    </div>
  );
};
