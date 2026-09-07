/**
 * MetricsDashboard Page
 * Metrics Overview - 全局指标概览
 *
 * P2-9 Phase 128 重构: 508 → 46行 (-90.9%)
 * 拆分: types.ts + constants.ts + useMetricsDashboardState.tsx
 *       + serviceColumns.tsx + 5 Components
 */
import React from 'react';
import { useMetricsDashboardState } from './useMetricsDashboardState';
import { MetricsDashboardHeader } from './Components/MetricsDashboardHeader';
import { KeyMetricsCards } from './Components/KeyMetricsCards';
import { LatencyBreakdownChart } from './Components/LatencyBreakdownChart';
import { MetricTrendsAndHealth } from './Components/MetricTrendsAndHealth';
import { ServiceHealthCard } from './Components/ServiceHealthCard';

const MetricsDashboard: React.FC = () => {
  const state = useMetricsDashboardState();

  return (
    <div>
      <MetricsDashboardHeader
        selectedTimeRange={state.selectedTimeRange}
        setSelectedTimeRange={state.setSelectedTimeRange}
        refreshing={state.refreshing}
        handleRefresh={state.handleRefresh}
      />
      <KeyMetricsCards
        metricSummary={state.metricSummary}
        sparklineData={state.sparklineData}
      />
      <LatencyBreakdownChart latencyTrendData={state.latencyTrendData} />
      <MetricTrendsAndHealth
        trendData={state.trendData}
        systemHealthScore={state.systemHealthScore}
      />
      <ServiceHealthCard
        filteredServiceHealth={state.filteredServiceHealth}
        loading={state.loading}
        selectedService={state.selectedService}
        setSelectedService={state.setSelectedService}
      />
    </div>
  );
};

export default MetricsDashboard;
