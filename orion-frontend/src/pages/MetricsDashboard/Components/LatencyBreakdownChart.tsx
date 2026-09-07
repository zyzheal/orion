/**
 * Latency Breakdown Chart
 * 抽取自 index.tsx (P2-9 Phase 128)
 */
import React from 'react';
import { Typography, Card } from 'antd';
import { spacing } from '@/tokens';
import { TrendLineChart } from '@/components/charts';
import type { TrendDataPoint } from '@/components/charts';

const { Title } = Typography;

interface LatencyBreakdownChartProps {
  latencyTrendData: TrendDataPoint[][];
}

export const LatencyBreakdownChart: React.FC<LatencyBreakdownChartProps> = ({
  latencyTrendData,
}) => (
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
