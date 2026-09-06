/**
 * useDataPipelineMonitorState - 状态与派生计算 Hook
 * 抽取自 index.tsx (P2-9 Phase 107)
 */
import { useState, useMemo } from 'react';
import { MOCK_PIPELINES } from './mockData';
import type { Pipeline } from './types';

export const useDataPipelineMonitorState = () => {
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterFrequency, setFilterFrequency] = useState<string | null>(null);

  const pipelines: Pipeline[] = MOCK_PIPELINES;

  const stats = useMemo(() => {
    const total = pipelines.length;
    const running = pipelines.filter((p) => p.status === 'running').length;
    const error = pipelines.filter((p) => p.status === 'error').length;
    const withLatency = pipelines.filter((p) => p.latency > 0);
    const avgLatency =
      withLatency.reduce((s, p) => s + p.latency, 0) / Math.max(withLatency.length, 1);
    return { total, running, error, avgLatency: avgLatency.toFixed(1) };
  }, [pipelines]);

  const filteredPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterFrequency && p.frequency !== filterFrequency) return false;
      return true;
    });
  }, [pipelines, filterStatus, filterFrequency]);

  return {
    filterStatus,
    setFilterStatus,
    filterFrequency,
    setFilterFrequency,
    pipelines,
    stats,
    filteredPipelines,
  };
};

export type DataPipelineMonitorState = ReturnType<typeof useDataPipelineMonitorState>;
