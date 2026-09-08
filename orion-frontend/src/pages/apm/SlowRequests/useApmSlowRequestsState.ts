/**
 * useApmSlowRequestsState.ts - APM 慢请求分析 状态 Hook
 * 抽取自 index.tsx (P2-9 Phase 245)
 */
import { useState, useEffect } from 'react';
import { message } from 'antd';
import { apmApi, type SlowQuery, type QueryPatternStats } from '@/api/apm';
import { useQuery } from '@/providers/QueryProvider';

export function useApmSlowRequestsState() {
  const [threshold, setThreshold] = useState(1000);

  const {
    data: listData = {} as { slowQueries: SlowQuery[]; patterns: QueryPatternStats[] },
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery<{ slowQueries: SlowQuery[]; patterns: QueryPatternStats[] }>({
    queryKey: ['apm-slow-requests', threshold],
    queryFn: async () => {
      const [queriesRes, patternsRes] = await Promise.all([
        apmApi.getSlowQueries({ limit: 50 }),
        apmApi.getQueryPatternStats(),
      ]);
      return {
        slowQueries: queriesRes.filter((q) => q.duration_ms >= threshold),
        patterns: patternsRes,
      };
    },
    staleTime: 30_000,
  });

  const slowQueries = listData.slowQueries ?? [];
  const patterns = listData.patterns ?? [];

  useEffect(() => {
    if (!isError) return;
    message.error(error instanceof Error ? error.message : '加载慢请求数据失败');
  }, [isError, error]);

  const handleThresholdChange = (val: number | null) => {
    if (!val) return;
    setThreshold(val);
  };

  return {
    threshold,
    loading,
    slowQueries,
    patterns,
    handleThresholdChange,
    refetch,
  };
}
