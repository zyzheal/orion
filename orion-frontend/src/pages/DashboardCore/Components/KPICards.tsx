/**
 * Dashboard KPI cards
 * 抽取自 index.tsx (P2-9 Phase 156)
 */
import MetricCard from '@/components/MetricCard';
import DashboardLayout from '@/components/DashboardLayout';
import { spacing } from '@/tokens';
import type { DashboardKPI } from '../types';

interface KPICardsProps {
  kpis: DashboardKPI[];
}

export const KPICards = ({ kpis }: KPICardsProps) => (
  <div style={{ marginBottom: spacing.lg }}>
    <DashboardLayout columns={4} gap={16}>
      {kpis.map((metric) => (
        <MetricCard
          key={metric.id}
          title={metric.title}
          value={metric.value}
          unit={metric.unit}
          trend={metric.trend}
          trendPercent={metric.trendPercent}
          previousValue={metric.previousValue}
          color={metric.color}
        />
      ))}
    </DashboardLayout>
  </div>
);
