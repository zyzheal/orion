/**
 * RiskDashboard system status card
 * 抽取自 index.tsx (P2-9 Phase 143)
 */
import React from 'react';
import { Card, Space, Tag, Typography } from 'antd';
import { spacing } from '@/tokens';

const { Text } = Typography;

interface RiskStatusCardProps {
  systemStatus: string | null;
}

export const RiskStatusCard: React.FC<RiskStatusCardProps> = ({ systemStatus }) => (
  <Card title="系统风险状态" style={{ marginBottom: spacing.lg }}>
    <Space size="large">
      <div>
        <Text type="secondary">系统状态:</Text>{' '}
        <Tag color={systemStatus === 'healthy' ? 'green' : 'red'}>
          {systemStatus === 'healthy' ? '健康' : '异常'}
        </Tag>
      </div>
    </Space>
  </Card>
);
