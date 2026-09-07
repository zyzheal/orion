/**
 * MetricsDashboard Page
 * Metrics Overview - 全局指标概览
 *
 * Features:
 * - Dashboard cards showing key metrics: Request Rate, Error Rate, Latency (P50/P95/P99), Throughput
 * - Mini trend indicators
 * - Service health summary table
 * - Filter by service and time range
 * - Refresh button
 *
 * 拆分 (P2-9 Phase 145): types / constants / helpers / useMetricsDashboardState / serviceColumns / Components/*
 */
import React from 'react';
import { useMetricsDashboardState } from './useMetricsDashboardState';
import { MetricsDashboardHeader } from './Components/MetricsDashboardHeader';
import { KeyMetricsRow } from './Components/KeyMetricsRow';
import { LatencyBreakdown } from './Components/LatencyBreakdown';
import { TrendsAndHealth } from './Components/TrendsAndHealth';
import { ServiceHealthCard } from './Components/ServiceHealthCard';

const MetricsDashboard: React.FC = () => {
  const state = useMetricsDashboardState();

  return (
    <div>
      <MetricsDashboardHeader
        selectedTimeRange={state.selectedTimeRange}
        onTimeRangeChange={state.setSelectedTimeRange}
        onRefresh={state.handleRefresh}
        refreshing={state.refreshing}
      />
      <KeyMetricsRow metricSummary={state.metricSummary} sparklineData={state.sparklineData} />
      <LatencyBreakdown latencyTrendData={state.latencyTrendData} />
      <TrendsAndHealth
        trendData={state.trendData}
        systemHealthScore={state.systemHealthScore}
      />
      <ServiceHealthCard
        filteredServiceHealth={state.filteredServiceHealth}
        loading={state.loading}
        selectedService={state.selectedService}
        onServiceChange={state.setSelectedService}
      />
    </div>
  );
};

export default MetricsDashboard;
