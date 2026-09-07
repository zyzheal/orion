/**
 * TrendChartCard - 趋势图卡片
 * 抽取自 index.tsx (P2-9 Phase 126)
 */
import React from 'react';
import { Card, Empty, Space } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import type { HealthDashboardState } from '../useHealthDashboardState';
import { TrendChart } from './TrendChart';

interface TrendChartCardProps {
  state: HealthDashboardState;
}

export const TrendChartCard: React.FC<TrendChartCardProps> = ({ state }) => {
  const { trend } = state;

  return (
    <Card
      title={
        <Space>
          <LineChartOutlined style={{ color: colors.info[500] }} />
          健康趋势（24h）
        </Space>
      }
    >
      {trend.length > 0 ? <TrendChart data={trend} /> : <Empty description="暂无趋势数据" />}
    </Card>
  );
};
