/**
 * useDashboardState.ts - DashboardNew 状态 Hook
 * 抽取自 DashboardNew/index.tsx (P2-9 Phase 67)
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { getPipelines, getPipelineRuns, type PipelineRun } from '@/api/pipelines';
import { retryPipelineRun } from '@/api/pipelineRuns';
import { getMonitoringHealth } from '@/api/monitoring';
import { getServiceHealthList } from '@/api/health';
import type { PipelineRecord, SystemHealthItem, TaskRecord } from './types';
import { formatDuration, formatTimeRelative, formatTrigger } from './constants';

export const useDashboardState = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<PipelineRun[]>([]);
  const [recentRuns, setRecentRuns] = useState<PipelineRun[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthItem[]>([]);

  // Derived stats
  const pipelineStats = {
    total: pipelines.length,
    running: recentRuns.filter((r) => r.status === 'running').length,
    success: recentRuns.filter((r) => r.status === 'success').length,
    failed: recentRuns.filter((r) => r.status === 'failed').length,
    pending: recentRuns.filter((r) => r.status === 'pending').length,
  };

  const tasks: TaskRecord[] = [];

  const taskStats = {
    total: 0,
    inProgress: 0,
    todo: 0,
    completed: 0,
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pipelinesRes = await getPipelines();
      if (pipelinesRes.data) {
        setPipelines(Array.isArray(pipelinesRes.data) ? pipelinesRes.data : []);
      }

      const runsRes = await getPipelineRuns('all', { page: 1, pageSize: 5 });
      if (runsRes.data) {
        setRecentRuns(Array.isArray(runsRes.data) ? runsRes.data : []);
      }

      try {
        const healthServices = await getServiceHealthList();
        const mapped = (Array.isArray(healthServices) ? healthServices : []).map(
          (s) =>
            ({
              name: s.serviceName,
              status: s.status === 'unhealthy' ? 'warning' : 'healthy',
              latency: s.latencyMs > 0 ? `${s.latencyMs}ms` : '-',
              uptime: s.uptimePercent > 0 ? `${s.uptimePercent.toFixed(1)}%` : '-',
            }) as SystemHealthItem,
        );
        if (mapped.length > 0) {
          setSystemHealth(mapped);
        } else {
          const healthRes = await getMonitoringHealth();
          const baseStatus = healthRes.data?.status === 'ok' ? 'healthy' : 'warning';
          setSystemHealth([
            { name: 'API Gateway', status: baseStatus, latency: '-', uptime: '-' },
            { name: 'Platform Service', status: baseStatus, latency: '-', uptime: '-' },
            { name: 'Database', status: baseStatus, latency: '-', uptime: '-' },
            { name: 'Redis', status: baseStatus, latency: '-', uptime: '-' },
          ]);
        }
      } catch {
        message.error('系统健康数据加载失败');
        setError('系统健康数据加载失败，请稍后刷新重试');
        setSystemHealth([]);
      }
    } catch {
      message.error('加载数据失败，使用演示数据展示');
      setError('加载数据失败，使用演示数据展示');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Transform runs to table records
  const recentPipelineRecords: PipelineRecord[] = recentRuns.map((run, idx) => ({
    key: String(idx + 1),
    name: run.pipelineName || run.pipelineId,
    pipelineId: run.pipelineId,
    runId: run.id,
    status: run.status,
    duration: formatDuration(run),
    trigger: run.author || formatTrigger(run.trigger),
    time: formatTimeRelative(run.startTime),
  }));

  const handleRetry = useCallback(
    async (runId: string) => {
      try {
        await retryPipelineRun(runId);
        message.success('流水线已重新触发');
        loadData();
      } catch {
        message.error('重试失败');
      }
    },
    [loadData],
  );

  return {
    loading,
    error,
    pipelines,
    recentRuns,
    systemHealth,
    pipelineStats,
    tasks,
    taskStats,
    recentPipelineRecords,
    loadData,
    handleRetry,
  };
};
