/**
 * Ability Distribution Chart
 * 抽取自 index.tsx (P2-9 Phase 129)
 */
import React from 'react';
import CardPanel from '@/components/CardPanel';
import { BarChart } from '@/components/charts';
import { spacing } from '@/tokens';
import type { EngineerDashboardData } from '@/types/pages';
import { categoryName } from '../constants';

interface AbilityDistributionChartProps {
  data: EngineerDashboardData;
}

export const AbilityDistributionChart: React.FC<AbilityDistributionChartProps> = ({ data }) => (
  <div style={{ marginBottom: spacing.lg }}>
    <CardPanel title="能力分布">
      <BarChart
        title="各类别熟练度"
        data={[
          ...data.strengths.map((s) => ({
            label: categoryName(s.category),
            value: s.proficiencyScore,
            series: '优势',
          })),
          ...data.weaknesses.map((w) => ({
            label: categoryName(w.category),
            value: Math.round(w.slaComplianceRate * 100),
            series: '待提升',
          })),
        ]}
        height={200}
      />
    </CardPanel>
  </div>
);
