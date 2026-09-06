/**
 * StatCard.tsx - 统计卡片组件
 * 抽取自 quality-gate/QualityGatePage.tsx (P2-9 Phase 77)
 */
import React from 'react';
import { Card, Statistic, Typography } from 'antd';

const { Text } = Typography;

export const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}> = ({ title, value, icon, color }) => (
  <Card size="small">
    <Statistic
      title={<Text type="secondary">{title}</Text>}
      value={value}
      prefix={icon}
      valueStyle={{ color }}
    />
  </Card>
);
