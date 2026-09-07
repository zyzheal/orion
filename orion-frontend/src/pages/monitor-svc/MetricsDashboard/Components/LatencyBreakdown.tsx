/**
 * MetricsDashboard latency breakdown chart
 * 抽取自 index.tsx (P2-9 Phase 145)
 */
import React from 'react';
import { Card, Typography } from 'antd';
import { spacing } from '@/tokens';
import { TrendLineChart, type TrendDataPoint } from '@/components/charts';

const { Title } = Typography;

interface LatencyBreakdownProps {
  latencyTrendData: TrendDataPoint[][];
}

export const LatencyBreakdown: React.FC<LatencyBreakdownProps> = ({ latencyTrendData }) => (
  <div style={{ marginBottom: spacing[6] }}>
    <Title level={5}>Latency Breakdown</Title>
    <Card size="small">
      <TrendLineChart
        title="P50 / P95 / P99 Latency (ms)"
        data={latencyTrendData}
        height={200}
        smooth
        showArea
      />
    </Card>
  </div>
);
