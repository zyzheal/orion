/**
 * usePipelineRunListState hook
 * 抽取自 PipelineRunList/index.tsx (P2-9 Phase 180)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { getAllPipelineRuns, retryPipelineRun, type PipelineRunSummary } from '@/api/pipelineRuns';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export function usePipelineRunListState() {
  const { id: pipelineId } = useParams<{ id: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [pipelineName, setPipelineName] = useState<string | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAllPipelineRuns({
        limit: 200,
        ...(pipelineId ? { pipelineId } : {}),
      });

      const raw = response.data;
      let items: PipelineRunSummary[] = [];

      if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.data)) {
          items = raw.data;
        } else if (Array.isArray(raw)) {
          items = raw;
        }
      }

      if (pipelineId && items.length > 0) {
        const firstRun = items[0];
        if (firstRun && (firstRun as { pipelineName?: string }).pipelineName) {
          setPipelineName((firstRun as { pipelineName?: string }).pipelineName ?? null);
        }
      }

      setRuns(items);
    } catch (error: unknown) {
      console.error('[PipelineRunList] Error:', error);
      if (error instanceof Error) {
        message.error(`加载 Pipeline 运行列表失败：${error.message}`);
      } else {
        message.error('加载 Pipeline 运行列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === 'running');

    if (hasRunning) {
      pollingTimerRef.current = setTimeout(() => {
        loadRuns();
      }, 5000);
    }

    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [runs, loadRuns]);

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          run.pipelineId,
          (run as { pipelineName?: string }).pipelineName || '',
          run.triggerBy || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all') {
        if (run.status !== statusFilter) return false;
      }

      if (dateRange && dateRange[0] && dateRange[1]) {
        const startTime = run.startedAt || run.createdAt;
        if (startTime) {
          const runDate = dayjs(startTime);
          if (runDate.isBefore(dateRange[0]) || runDate.isAfter(dateRange[1].endOf('day'))) {
            return false;
          }
        }
      }

      return true;
    });
  }, [searchQuery, filters, dateRange, runs]);

  const sortedRuns = useMemo(() => {
    return [...filteredRuns].sort((a, b) => {
      const aTime = dayjs(a.startedAt || a.createdAt).valueOf();
      const bTime = dayjs(b.startedAt || b.createdAt).valueOf();
      return bTime - aTime;
    });
  }, [filteredRuns]);

  const handleRetry = async (runId: string) => {
    try {
      await retryPipelineRun(runId);
      message.success('Pipeline 重新运行已触发');
      await loadRuns();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`重新运行失败：${error.message}`);
      } else {
        message.error('重新运行失败，请稍后重试');
      }
    }
  };

  const handleRefresh = () => {
    loadRuns();
  };

  return {
    pipelineId,
    pipelineName,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    dateRange,
    setDateRange,
    loading,
    runs,
    sortedRuns,
    loadRuns,
    handleRetry,
    handleRefresh,
  };
}
