/**
 * useApmErrorTrackingState.ts - APM Error Tracking 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 223)
 */
import { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import { apmApi, type TraceSummary } from '@/api/apm';
import { useQuery } from '@/providers/QueryProvider';

export function useApmErrorTrackingState() {
  const [serviceFilter, setServiceFilter] = useState<string | undefined>(undefined);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<TraceSummary | null>(null);

  const {
    data: errorData = {} as { allTraces: TraceSummary[] },
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery<{ allTraces: TraceSummary[] }>({
    queryKey: ['apm-error-tracking'],
    queryFn: async () => {
      const traces = await apmApi.listTraces({ limit: 200 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const traceList: TraceSummary[] = Array.isArray(traces) ? traces : (((traces as any).data ?? []) as TraceSummary[]);
      return { allTraces: traceList };
    },
    staleTime: 30_000,
  });

  const allTraces = errorData.allTraces ?? [];
  const errors = allTraces.filter((t) => t.status === 'error');

  // 错误反馈
  useEffect(() => {
    if (!isError) return;
    message.error(error instanceof Error ? error.message : '加载错误数据失败');
  }, [isError, error]);

  const handleViewDetail = (record: TraceSummary) => {
    setSelectedTrace(record);
    setDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedTrace(null);
  };

  // Extract unique services
  const services = useMemo(
    () => Array.from(new Set(allTraces.map((t) => t.root_service).filter(Boolean))),
    [allTraces]
  );

  // Error trend: group by hour
  const errorTrend = useMemo(() => {
    const hourMap = new Map<string, number>();
    errors.forEach((e) => {
      const hour = new Date(e.start_time).getHours();
      const key = `${hour}:00`;
      hourMap.set(key, (hourMap.get(key) || 0) + 1);
    });
    return Array.from(hourMap.entries()).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  }, [errors]);

  return {
    // State
    serviceFilter,
    setServiceFilter,
    detailModalOpen,
    selectedTrace,
    loading,
    errors,
    allTraces,
    services,
    errorTrend,
    // Actions
    refetch,
    handleViewDetail,
    closeDetailModal,
  };
}
