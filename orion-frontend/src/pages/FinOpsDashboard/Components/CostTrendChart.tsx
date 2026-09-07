/**
 * CostTrendChart - 成本趋势图
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
import React from 'react';
import { Card, Space, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { TrendLineChart } from '@/components/charts';
import { colors, spacing } from '@/tokens';
import type { FinOpsDashboardState } from '../useFinOpsDashboardState';

const { Text } = Typography;

interface CostTrendChartProps {
  state: FinOpsDashboardState;
}

export const CostTrendChart: React.FC<CostTrendChartProps> = ({ state }) => {
  const { loading, costTrend } = state;

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined />
          成本趋势（近12个月）
        </Space>
      }
      bordered={false}
      style={{ borderRadius: 8, marginBottom: spacing.md }}
      loading={loading}
    >
      {costTrend.length > 0 ? (
        <TrendLineChart
          title="成本趋势（近12个月）"
          data={[costTrend.map((d) => ({ period: d.month, value: d.cost, label: '实际成本' }))]}
          height={280}
          showArea={true}
          smooth={true}
        />
      ) : (
        <div
          style={{
            height: 280,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: colors.neutral[50],
            borderRadius: 6,
            border: `1px dashed ${colors.neutral[300]}`,
          }}
        >
          <Text type="secondary" style={{ fontSize: spacing[4] }}>
            暂无趋势数据
          </Text>
        </div>
      )}
    </Card>
  );
};
