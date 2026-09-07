/**
 * Personal Trend Chart
 * 抽取自 index.tsx (P2-9 Phase 129)
 */
import React from 'react';
import { Tag } from 'antd';
import CardPanel from '@/components/CardPanel';
import { TrendLineChart } from '@/components/charts';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { EngineerDashboardData } from '@/types/pages';

interface PersonalTrendChartProps {
  data: EngineerDashboardData;
}

export const PersonalTrendChart: React.FC<PersonalTrendChartProps> = ({ data }) => {
  const recentTrend = data.personalTrend.slice(-14);

  return (
    <div style={{ marginBottom: spacing.lg }}>
      <CardPanel title="个人趋势（近14天）" extra={<Tag color="cyan">解决数 & 耗时</Tag>}>
        <TrendLineChart
          title=""
          data={[
            recentTrend.map((d) => ({
              period: dayjs(d.period).format('MM/DD'),
              value: d.resolved,
              label: '解决数',
            })),
          ]}
          height={200}
          showArea
          smooth={false}
        />
      </CardPanel>
    </div>
  );
};
