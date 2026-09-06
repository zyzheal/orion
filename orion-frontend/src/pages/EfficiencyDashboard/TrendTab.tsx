/**
 * TrendTab.tsx - 趋势分析 Tab
 * 抽取自 EfficiencyDashboard/index.tsx (P2-9 Phase 79)
 */
import React from 'react';
import { Card } from 'antd';
import { spacing } from '@/tokens';
import { TrendLineChart, BarChart } from '@/components/charts';
import type { TrendDataPoint, BarDataItem } from '@/components/charts';

interface TrendTabProps {
  trendData: TrendDataPoint[][];
  deploymentByTeam: BarDataItem[];
  loading: boolean;
}

export const TrendTab: React.FC<TrendTabProps> = ({ trendData, deploymentByTeam, loading }) => (
  <>
    <Card title="近 12 周趋势" style={{ marginBottom: spacing.md }}>
      <TrendLineChart
        title="DORA 指标趋势"
        data={trendData}
        height={280}
        smooth={true}
        loading={loading}
      />
    </Card>
    <Card title="部署频率分布">
      <BarChart
        title="各团队部署次数"
        data={deploymentByTeam}
        height={200}
        loading={loading}
      />
    </Card>
  </>
);
