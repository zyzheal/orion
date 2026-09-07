/**
 * Executive Dashboard Page
 * High-level KPI overview for leadership, including ticket volume trends,
 * SLA compliance trends, team rankings, alerts, and category/priority distribution.
 *
 * P0-3 Fix: Removed mock data fallback. Now uses real API data with proper
 * loading, error, and empty states. Mock data is kept only in test files.
 *
 * Split into components (P2-9 Phase 158):
 * - types.ts / constants.tsx / useExecutiveDashboardData.ts
 * - Components/{ExecutiveHeader,KPICardsRow,TrendCharts,TeamRanking,AlertsCenter,DistributionCharts,ErrorStates}.tsx
 */
import React from 'react';
import { useExecutiveDashboardData } from './useExecutiveDashboardData';
import { ExecutiveHeader } from './Components/ExecutiveHeader';
import { KPICardsRow } from './Components/KPICardsRow';
import { TrendCharts } from './Components/TrendCharts';
import { TeamRanking } from './Components/TeamRanking';
import { AlertsCenter } from './Components/AlertsCenter';
import { DistributionCharts } from './Components/DistributionCharts';
import { EmptyState, ErrorState } from './Components/ErrorStates';
import DataState from '@/components/DataState';

const ExecutiveDashboard: React.FC = () => {
  const s = useExecutiveDashboardData();

  // Empty state when no data available
  if (!s.loading && !s.error && !s.apiData) {
    return <EmptyState onRetry={s.handleRetry} />;
  }

  // Error state with graceful fallback
  if (s.error) {
    return <ErrorState onRetry={s.handleRetry} />;
  }

  if (!s.data) {
    return null;
  }

  return (
    <div style={{ padding: 0 }}>
      <DataState
        loading={s.loading}
        error={s.error}
        empty={false}
        loadingText="加载效能数据..."
        retry={s.handleRetry}
      >
        <ExecutiveHeader />
        <KPICardsRow metrics={s.kpiMetrics} />
        <TrendCharts
          ticketVolumeTrend={s.recentVolumeTrend}
          slaComplianceTrend={s.trends?.slaComplianceTrend || []}
        />
        <TeamRanking
          topPerformers={s.teamRanking?.topPerformers || []}
          bottomPerformers={s.teamRanking?.bottomPerformers || []}
          topColumns={s.topPerformerColumns}
        />
        <AlertsCenter
          slaComplianceRate={s.overview?.slaComplianceRate ?? 0}
          alertCards={s.alertCards}
        />
        <DistributionCharts
          byCategory={s.distribution?.byCategory || {}}
          byPriority={s.distribution?.byPriority || {}}
        />
      </DataState>
    </div>
  );
};

export default ExecutiveDashboard;
