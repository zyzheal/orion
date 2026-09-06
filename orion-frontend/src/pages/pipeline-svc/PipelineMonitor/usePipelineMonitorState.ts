/**
 * usePipelineMonitorState
 * 运行监控页状态与逻辑（抽取自 index.tsx）
 *
 * 合并了原 index.tsx 中的 loadData 与 loadDataWithPollingCheck（两者 90% 重复）
 * 为单一 loadData 函数，末尾调用 checkAndStartPolling 决定是否启动轮询。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import {
  getRunStats,
  buildDailyStats,
  calculatePercentile,
  getFailedStageStats,
  type RunStats,
  type DailyRunStats,
  type FailedStageStat,
} from './api';
import { getAllPipelineRuns, type PipelineRunSummary } from '@/api/pipelineRuns';
import { POLLING_INTERVAL_MS } from './constants';

export interface UsePipelineMonitorStateReturn {
  loading: boolean;
  stats: RunStats | null;
  days: number;
  setDays: (n: number) => void;
  failedRuns: PipelineRunSummary[];
  recentRuns: PipelineRunSummary[];
  dailyStats: DailyRunStats[];
  failedStageStats: FailedStageStat[];
  p50Duration: number;
  p95Duration: number;
  isPolling: boolean;
  handleRefresh: () => void;
  formatDuration: (ms: number) => string;
}

export const usePipelineMonitorState = (): UsePipelineMonitorStateReturn => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [days, setDays] = useState(7);
  const [failedRuns, setFailedRuns] = useState<PipelineRunSummary[]>([]);
  const [recentRuns, setRecentRuns] = useState<PipelineRunSummary[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyRunStats[]>([]);
  const [failedStageStats, setFailedStageStats] = useState<FailedStageStat[]>([]);
  const [p50Duration, setP50Duration] = useState(0);
  const [p95Duration, setP95Duration] = useState(0);

  // 实时监控相关
  const [isPolling, setIsPolling] = useState(false);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 失败阶段缓存
  const stageCacheRef = useRef<Map<string, Array<{ name: string; status: string }>>>(new Map());

  // 检查是否有正在运行的 Pipeline，决定是否启动轮询
  const checkAndStartPolling = useCallback(
    (runs: PipelineRunSummary[]) => {
      const hasRunning = runs.some((r) => r.status === 'running');

      if (hasRunning && !isPolling) {
        setIsPolling(true);
        pollingTimerRef.current = setInterval(() => {
          loadData();
        }, POLLING_INTERVAL_MS);
      } else if (!hasRunning && isPolling) {
        setIsPolling(false);
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPolling]
  );

  // 加载主数据（合并原 loadData 与 loadDataWithPollingCheck）
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 尝试从 API 获取统计数据
      try {
        const statsRes = await getRunStats({ days });
        if (statsRes.data && statsRes.data.totalRuns !== undefined) {
          setStats(statsRes.data);
        }
      } catch {
        // API 不存在，使用 fallback 逻辑
      }

      // 使用 getAllPipelineRuns 聚合数据
      const endDate = dayjs();
      const startDate = endDate.subtract(days, 'day');

      const runsRes = await getAllPipelineRuns({ limit: 500 });

      const apiData = runsRes.data;
      const runs = Array.isArray(apiData.data) ? apiData.data : [];
      // 按日期过滤
      const filteredRuns = runs.filter((run: PipelineRunSummary) => {
        if (!run.createdAt) return false;
        const runDate = dayjs(run.createdAt);
        return runDate.isAfter(startDate) && runDate.isBefore(endDate.add(1, 'day'));
      });

      // 计算统计数据
      const totalRuns = filteredRuns.length;
      const successRuns = filteredRuns.filter(
        (r: PipelineRunSummary) => r.status === 'success'
      ).length;
      const failedCount = filteredRuns.filter(
        (r: PipelineRunSummary) => r.status === 'failed'
      ).length;
      const successRate = totalRuns > 0 ? (successRuns / totalRuns) * 100 : 0;

      // 计算平均耗时
      const completedRuns = filteredRuns.filter((r: PipelineRunSummary) => {
        const dur = typeof r.durationMs === 'string' ? parseFloat(r.durationMs) : r.durationMs;
        return dur && dur > 0;
      });
      const totalDuration = completedRuns.reduce((sum: number, r: PipelineRunSummary) => {
        const dur = typeof r.durationMs === 'string' ? parseFloat(r.durationMs) : r.durationMs;
        return sum + (dur || 0);
      }, 0);
      const avgDuration = completedRuns.length > 0 ? totalDuration / completedRuns.length : 0;

      // 计算 P50/P95
      const durations = completedRuns.map((r: PipelineRunSummary) => {
        const dur = typeof r.durationMs === 'string' ? parseFloat(r.durationMs) : r.durationMs;
        return dur || 0;
      });
      const p50 = calculatePercentile(durations, 50);
      const p95 = calculatePercentile(durations, 95);
      setP50Duration(p50);
      setP95Duration(p95);

      setStats({ totalRuns, successRate, avgDuration, failedCount });

      // 记录失败的运行
      setFailedRuns(filteredRuns.filter((r: PipelineRunSummary) => r.status === 'failed'));

      // 记录最近的运行
      setRecentRuns(
        [...filteredRuns]
          .sort((a: PipelineRunSummary, b: PipelineRunSummary) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 10)
      );

      // 构建每日趋势数据
      const daily = buildDailyStats(filteredRuns);
      setDailyStats(daily);

      // 加载失败阶段统计
      const failedRunIds = filteredRuns
        .filter((r: PipelineRunSummary) => r.status === 'failed')
        .map((r: PipelineRunSummary) => r.id);

      if (failedRunIds.length > 0) {
        const stageStats = await getFailedStageStats(failedRunIds, stageCacheRef.current);
        setFailedStageStats(stageStats);
      } else {
        setFailedStageStats([]);
      }

      // 检查是否需要启动/停止轮询
      checkAndStartPolling(filteredRuns);
    } catch (error) {
      console.error('Failed to load pipeline monitor data:', error);
      message.error('加载监控数据失败');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, checkAndStartPolling]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  // 手动刷新时重置轮询状态
  const handleRefresh = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    setIsPolling(false);
    stageCacheRef.current.clear();
    loadData();
  };

  // 格式化耗时
  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return '-';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  return {
    loading,
    stats,
    days,
    setDays,
    failedRuns,
    recentRuns,
    dailyStats,
    failedStageStats,
    p50Duration,
    p95Duration,
    isPolling,
    handleRefresh,
    formatDuration,
  };
};
