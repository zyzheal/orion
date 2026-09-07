/**
 * MetricsDashboard trends + health gauge
 * 抽取自 index.tsx (P2-9 Phase 145)
 */
import React from 'react';
import { Card } from 'antd';
import { spacing } from '@/tokens';
import { GaugeChart, TrendLineChart, type TrendDataPoint } from '@/components/charts';

interface TrendsAndHealthProps {
  trendData: TrendDataPoint[][];
  systemHealthScore: number;
}

export const TrendsAndHealth: React.FC<TrendsAndHealthProps> = ({
  trendData,
  systemHealthScore,
}) => (
  <div style={{ marginBottom: spacing[6], display: 'flex', gap: spacing[4] }}>
    <Card title="系统指标趋势" size="small" style={{ flex: 3 }}>
      <TrendLineChart data={trendData} height={240} smooth showArea />
    </Card>
    <Card
      title="系统健康度"
      size="small"
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <GaugeChart
        title="Health"
        value={systemHealthScore}
        thresholds={{ warning: 70, danger: 85 }}
        size={160}
      />
    </Card>
  </div>
);
