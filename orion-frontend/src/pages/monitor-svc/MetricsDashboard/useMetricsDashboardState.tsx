/**
 * MetricsDashboard state hook
 * 抽取自 index.tsx (P2-9 Phase 145)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import type { TrendDataPoint } from '@/components/charts';
import { getMonitoringHealth, getMetrics, getDashboardData } from '@/api/monitoring';
import type { MetricSummary, ServiceHealthRow, TimeRange } from './types';
import { generateSparkline } from './helpers';

export const useMetricsDashboardState = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1h');
  const [metricSummary, setMetricSummary] = useState<MetricSummary | null>(null);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthRow[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[][]>([]);
  const [systemHealthScore, setSystemHealthScore] = useState<number>(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [_healthRes, metricsRes, dashboardRes] = await Promise.all([
        getMonitoringHealth(),
        getMetrics(),
        getDashboardData(),
      ]);

      const metricsData = metricsRes?.data || [];
      const dashboardData = dashboardRes?.data;

      if (dashboardData) {
        const metrics = dashboardData.metrics;
        setMetricSummary({
          requestRate: metrics?.rate ?? 0,
          errorRate: dashboardData.alerts?.total
            ? (dashboardData.alerts.active / dashboardData.alerts.total) * 100
            : 0,
          latencyP50: 0,
          latencyP95: 0,
          latencyP99: 0,
          throughput: 0,
        });
      } else {
        setMetricSummary(null);
      }

      const healthRows: ServiceHealthRow[] = metricsData.map(
        (m: { name?: string; value?: number; unit?: string; lastUpdated?: string }, i: number) => ({
          key: `metric-${i}`,
          serviceName: m.name || `Service ${i + 1}`,
          status:
            m.value !== undefined && m.value > 0.9
              ? 'unhealthy'
              : m.value !== undefined && m.value > 0.5
                ? 'degraded'
                : 'healthy',
          requestRate: `${Math.round((m.value || 0) * 1000)}/min`,
          errorRate: `${(m.value || 0).toFixed(2)}%`,
          latency: `${Math.round((m.value || 0) * 100)}ms`,
        })
      );
      setServiceHealth(healthRows);

      const now = Date.now();
      const trendPoints: TrendDataPoint[] = metricsData.map(
        (m: { name?: string; value?: number; lastUpdated?: string }, i: number) => ({
          period: m.lastUpdated || new Date(now - (metricsData.length - i) * 60000).toISOString(),
          value: m.value ?? 0,
          label: m.name || `Metric ${i + 1}`,
        })
      );
      const seriesMap = new Map<string, TrendDataPoint[]>();
      for (const point of trendPoints) {
        const key = point.label || 'unknown';
        if (!seriesMap.has(key)) seriesMap.set(key, []);
        seriesMap.get(key)!.push(point);
      }
      setTrendData(Array.from(seriesMap.values()));

      if (healthRows.length > 0) {
        const scoreMap = { healthy: 95, degraded: 60, unhealthy: 25 };
        const total = healthRows.reduce((sum, row) => sum + scoreMap[row.status], 0);
        setSystemHealthScore(Math.round(total / healthRows.length));
      } else {
        setSystemHealthScore(0);
      }
    } catch (error: unknown) {
      setMetricSummary(null);
      setServiceHealth([]);
      setTrendData([]);
      setSystemHealthScore(0);
      message.error(`加载指标数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sparklineData = useMemo(() => {
    const rate = metricSummary?.requestRate ?? 0;
    const err = metricSummary?.errorRate ?? 0;
    const p50 = metricSummary?.latencyP50 ?? 0;
    const throughput = metricSummary?.throughput ?? 0;

    return {
      requestRate: typeof rate === 'number' && rate > 0 ? generateSparkline(rate, 0.1) : [],
      errorRate: typeof err === 'number' && err > 0 ? generateSparkline(err, 0.2) : [],
      latencyP50: typeof p50 === 'number' && p50 > 0 ? generateSparkline(p50, 0.08) : [],
      throughput:
        typeof throughput === 'number' && throughput > 0
          ? generateSparkline(throughput, 0.12)
          : [],
    };
  }, [metricSummary]);

  const latencyTrendData: TrendDataPoint[][] = useMemo(() => {
    const now = new Date();
    const periods = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now);
      d.setMinutes(d.getMinutes() - (11 - i) * 5);
      return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    const baseP50 = metricSummary?.latencyP50 ?? 44;
    const baseP95 = metricSummary?.latencyP95 ?? 120;
    const baseP99 = metricSummary?.latencyP99 ?? 280;

    return [
      periods.map((period, i) => ({
        period,
        value: Math.round(baseP50 * (1 + Math.sin(i * 0.5) * 0.1)),
        label: 'P50',
      })),
      periods.map((period, i) => ({
        period,
        value: Math.round(baseP95 * (1 + Math.cos(i * 0.4) * 0.15)),
        label: 'P95',
      })),
      periods.map((period, i) => ({
        period,
        value: Math.round(baseP99 * (1 + Math.sin(i * 0.3) * 0.2 + Math.random() * 0.1)),
        label: 'P99',
      })),
    ];
  }, [metricSummary]);

  const filteredServiceHealth =
    selectedService === 'all'
      ? serviceHealth
      : serviceHealth.filter((s) => s.key === selectedService);

  return {
    loading,
    refreshing,
    selectedService,
    setSelectedService,
    selectedTimeRange,
    setSelectedTimeRange,
    metricSummary,
    serviceHealth,
    trendData,
    systemHealthScore,
    loadData,
    handleRefresh,
    sparklineData,
    latencyTrendData,
    filteredServiceHealth,
  };
};

export type MetricsDashboardState = ReturnType<typeof useMetricsDashboardState>;
