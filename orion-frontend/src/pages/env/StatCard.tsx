/**
 * StatCard
 * 环境统计卡（抽取自 EnvironmentPage.tsx）
 */
import React from 'react';
import { Card, Statistic, Typography } from 'antd';

const { Text } = Typography;

export interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <Card size="small">
    <Statistic
      title={<Text type="secondary">{title}</Text>}
      value={value}
      prefix={icon}
      valueStyle={{ color }}
    />
  </Card>
);
