import { useState, useEffect, useCallback, useMemo } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import {
  getAllPipelineRuns,
  getPipelineRunStages,
  type GetAllPipelineRunsParams,
} from '@/api/pipelineRuns';
import { getPipelines } from '@/api/pipelines';
import type {
  RunRecord,
  PipelineSummary,
  Bottleneck,
  DurationBucket,
} from './types';
import { computeStats } from './constants';

export function usePipelineRunAnalyticsState() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [stageDetails, setStageDetails] = useState<unknown[]>([]);
  const [stageLoading, setStageLoading] = useState(false);

  const loadPipelines = async () => {
    try {
      const res = await getPipelines();
      const list = res.data as
        | { data?: PipelineSummary[]; pipelines?: PipelineSummary[] }
        | PipelineSummary[];
      const data = Array.isArray(list)
        ? list
        : ((list as { data?: PipelineSummary[] })?.data ??
          (list as { pipelines?: PipelineSummary[] })?.pipelines ??
          []);
      setPipelines(data);
    } catch {
      // Pipeline list optional
    }
  };

  const buildParams = useCallback((): GetAllPipelineRunsParams => {
    const params: GetAllPipelineRunsParams = { limit: 200 };
    if (selectedPipeline) params.pipelineId = selectedPipeline;
    if (selectedStatus) params.status = selectedStatus;
    return params;
  }, [selectedPipeline, selectedStatus]);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const res = await getAllPipelineRuns(buildParams());
      const raw = (res as any).data ?? res;
      let data =
        (raw as { data?: RunRecord[]; runs?: RunRecord[] })?.data ??
        (raw as { runs?: RunRecord[] })?.runs ??
        (raw as RunRecord[]) ??
        [];
      if (!Array.isArray(data)) data = [];

      // Client-side date filtering
      if (dateRange && dateRange[0] && dateRange[1]) {
        const start = dateRange[0].startOf('day');
        const end = dateRange[1].endOf('day');
        data = data.filter((r) => {
          const d = dayjs(r.startedAt || r.createdAt);
          return d.isAfter(start) && d.isBefore(end);
        });
      }

      // Sort newest first
      data.sort((a, b) => {
        const ta = a.startedAt || a.createdAt;
        const tb = b.startedAt || b.createdAt;
        return dayjs(tb).valueOf() - dayjs(ta).valueOf();
      });

      setRuns(data);
    } catch {
      message.error('Failed to load pipeline runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
    loadPipelines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPipeline, selectedStatus]);

  const stats = useMemo(() => computeStats(runs), [runs]);

  const successRateProgress: {
    percent: number;
    status?: 'normal' | 'active' | 'exception' | 'success' | undefined;
  } =
    stats.total > 0
      ? {
          percent: stats.successRate,
          status:
            stats.successRate >= 80
              ? 'normal'
              : stats.successRate >= 50
                ? 'active'
                : 'exception',
        }
      : { percent: 0 };

  const bottlenecks = useMemo((): Bottleneck[] => {
    const byPipeline = new Map<string, RunRecord[]>();
    runs.forEach((r) => {
      const existing = byPipeline.get(r.pipelineId) || [];
      existing.push(r);
      byPipeline.set(r.pipelineId, existing);
    });
    return Array.from(byPipeline.entries())
      .map(([pid, pruns]) => {
        const failures = pruns.filter((r) => r.status === 'failed');
        const durations = pruns
          .filter((r) => r.status === 'success')
          .map((r) =>
            typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : (r.durationMs ?? 0)
          )
          .filter((d) => Number.isFinite(d) && d > 0);
        const avgMs =
          durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        const pname = pipelines.find((p) => p.id === pid)?.name || pid;
        return {
          stageName: pname,
          failureCount: failures.length,
          avgDurationMs: Math.round(avgMs),
          pipelineId: pid,
          pipelineName: pname,
        };
      })
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 10);
  }, [runs, pipelines]);

  const durationBuckets = useMemo((): DurationBucket[] => {
    const buckets: { label: string; items: RunRecord[] }[] = [
      { label: '< 30s', items: [] },
      { label: '30s-2m', items: [] },
      { label: '2m-5m', items: [] },
      { label: '5m-15m', items: [] },
      { label: '> 15m', items: [] },
    ];
    runs
      .filter((r) => r.status === 'success')
      .forEach((r) => {
        const ms = typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs;
        if (ms == null) return;
        if (ms < 30000) buckets[0].items.push(r);
        else if (ms < 120000) buckets[1].items.push(r);
        else if (ms < 300000) buckets[2].items.push(r);
        else if (ms < 900000) buckets[3].items.push(r);
        else buckets[4].items.push(r);
      });
    return buckets.map((b) => ({
      label: b.label,
      count: b.items.length,
      avgMs:
        b.items.length > 0
          ? Math.round(
              b.items.reduce((sum, r) => {
                const d =
                  typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs;
                return sum + (d || 0);
              }, 0) / b.items.length
            )
          : 0,
    }));
  }, [runs]);

  const topSlow = useMemo((): RunRecord[] => {
    return runs
      .filter((r) => r.status === 'success')
      .map((r) => ({
        ...r,
        _dur: typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs,
      }))
      .sort((a, b) => (b._dur ?? 0) - (a._dur ?? 0))
      .slice(0, 5)
      .map(({ _dur, ...rest }) => rest);
  }, [runs]);

  const openStageDetail = async (run: RunRecord) => {
    setSelectedRun(run);
    setStageLoading(true);
    try {
      const res = await getPipelineRunStages(run.id);
      const stages = res.data as unknown[];
      setStageDetails(Array.isArray(stages) ? stages : [stages]);
    } catch {
      message.error('Failed to load stage details');
    } finally {
      setStageLoading(false);
    }
  };

  return {
    runs, pipelines, loading,
    selectedPipeline, setSelectedPipeline,
    selectedStatus, setSelectedStatus,
    dateRange, setDateRange,
    selectedRun, setSelectedRun,
    stageDetails, setStageDetails, stageLoading,
    loadPipelines, buildParams, loadRuns,
    stats, successRateProgress, bottlenecks, durationBuckets, topSlow,
    openStageDetail,
  };
}

export type PipelineRunAnalyticsState = ReturnType<typeof usePipelineRunAnalyticsState>;
