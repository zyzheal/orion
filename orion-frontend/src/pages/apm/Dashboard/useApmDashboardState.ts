/**
 * useApmDashboardState.ts - APM Dashboard 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 246)
 */
import { useEffect } from 'react';
import { message } from 'antd';
import { apmApi, type TraceSummary, type ServiceInfo } from '@/api/apm';
import { useQuery } from '@/providers/QueryProvider';

export function useApmDashboardState() {
  const {
    data: dashboard = {} as { traces: TraceSummary[]; services: ServiceInfo[] },
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery<{ traces: TraceSummary[]; services: ServiceInfo[] }>({
    queryKey: ['apm-dashboard'],
    queryFn: async () => {
      const [traceRes, serviceRes] = await Promise.all([
        apmApi.listTraces({ limit: 50 }),
        apmApi.listServices(),
      ]);
      return { traces: traceRes, services: serviceRes };
    },
    staleTime: 30_000,
  });

  const traces = dashboard.traces ?? [];
  const services = dashboard.services ?? [];

  // Compute stats
  const errorCount = traces.filter((t) => t.status === 'error').length;
  const avgDuration =
    traces.length > 0
      ? Math.round(traces.reduce((sum, t) => sum + t.duration_ms, 0) / traces.length)
      : 0;

  // 错误反馈
  useEffect(() => {
    if (!isError) return;
    message.error(error instanceof Error ? error.message : '加载 APM 数据失败');
  }, [isError, error]);

  return {
    loading,
    traces,
    services,
    errorCount,
    avgDuration,
    refetch,
  };
}
