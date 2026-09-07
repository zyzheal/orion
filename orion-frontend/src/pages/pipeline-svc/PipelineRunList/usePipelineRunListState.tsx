/**
 * PipelineRunList state hook
 * 抽取自 index.tsx (P2-9 Phase 140)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message, Modal } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { componentRadius } from '@/tokens';
import {
  getAllPipelineRuns,
  retryPipelineRun,
  cancelPipelineRun,
  type PipelineRunSummary,
} from '@/api/pipelineRuns';
import type { DateRange, Filters, RetryOptions, StageRetryState } from './types';

const DEFAULT_STAGE_RETRY: StageRetryState = { visible: false, runId: null };

export const usePipelineRunListState = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [dateRange, setDateRange] = useState<DateRange>(null);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [stageRetryModal, setStageRetryModal] = useState<StageRetryState>(DEFAULT_STAGE_RETRY);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load pipeline runs from API
  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAllPipelineRuns({ limit: 200 });
      const apiData = response.data;
      const items = Array.isArray(apiData.data) ? apiData.data : [];
      setRuns(items as PipelineRunSummary[]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载 Pipeline 运行列表失败：${error.message}`);
      } else {
        message.error('加载 Pipeline 运行列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Polling for running executions: refresh every 5s if any runs are 'running'
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

  // Filter runs based on search, filters, and date range
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

  // Sort by startedAt descending (most recent first)
  const sortedRuns = useMemo(() => {
    return [...filteredRuns].sort((a, b) => {
      const aTime = dayjs(a.startedAt || a.createdAt).valueOf();
      const bTime = dayjs(b.startedAt || b.createdAt).valueOf();
      return bTime - aTime;
    });
  }, [filteredRuns]);

  // Handle re-run for a failed/cancelled run
  const handleRetry = useCallback(
    async (runId: string, options?: RetryOptions) => {
      try {
        const response = await retryPipelineRun(runId, options);
        message.success('Pipeline 重新运行已触发');
        await loadRuns();
        const responseData = response as { data?: { id?: string; newRunId?: string } };
        const newRunId = responseData.data?.id || responseData.data?.newRunId;
        if (newRunId) {
          navigate(`/pipelines/${newRunId}`);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          const errMsg = error.message;
          if (
            errMsg.includes('not found') ||
            errMsg.includes('不存在') ||
            errMsg.includes('已删除')
          ) {
            message.error('该 Pipeline 运行已不存在，可能已被删除');
          } else {
            message.error(`重新运行失败：${errMsg}`);
          }
        } else {
          message.error('重新运行失败，请稍后重试');
        }
      }
    },
    [loadRuns, navigate]
  );

  // Handle retry confirmation dialog for "完整重试"
  const handleRetryConfirm = useCallback(
    (runId: string) => {
      Modal.confirm({
        title: '确认重新运行此 Pipeline？',
        content: '将从头开始重新运行整个 Pipeline，所有阶段都将被重新执行。',
        okText: '确认重跑',
        cancelText: '取消',
        style: { borderRadius: componentRadius.modal },
        onOk: () => handleRetry(runId),
      });
    },
    [handleRetry]
  );

  // Handle cancel for a running run
  const handleCancel = useCallback(
    async (runId: string) => {
      setCancellingIds((prev) => new Set(prev).add(runId));
      try {
        await cancelPipelineRun(runId);
        message.success('Pipeline 已取消');
        await loadRuns();
      } catch (error: unknown) {
        if (error instanceof Error) {
          const errMsg = error.message;
          if (
            errMsg.includes('not running') ||
            errMsg.includes('已结束') ||
            errMsg.includes('已取消')
          ) {
            message.warning('该 Pipeline 运行已结束，无需取消');
          } else {
            message.error(`取消失败：${errMsg}`);
          }
        } else {
          message.error('取消失败，请稍后重试');
        }
      } finally {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(runId);
          return next;
        });
      }
    },
    [loadRuns]
  );

  // Handle cancel confirmation dialog
  const confirmCancel = useCallback(
    (runId: string) => {
      Modal.confirm({
        title: '确认取消此 Pipeline 运行？',
        content: '取消后，正在运行的阶段将被停止，此操作不可恢复。',
        okText: '确认取消',
        cancelText: '取消',
        okButtonProps: { danger: true },
        style: { borderRadius: componentRadius.modal },
        onOk: () => handleCancel(runId),
      });
    },
    [handleCancel]
  );

  // Handle retry from stage
  const handleRetryFromStage = useCallback(
    async (runId: string, stageId?: string, onlyFailed?: boolean) => {
      try {
        const response = await retryPipelineRun(runId, { fromStage: stageId, onlyFailed });
        message.success('Pipeline 重新运行已触发');
        await loadRuns();
        const responseData = response as { data?: { id?: string; newRunId?: string } };
        const newRunId = responseData.data?.id || responseData.data?.newRunId;
        if (newRunId) {
          navigate(`/pipelines/${newRunId}`);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          const errMsg = error.message;
          if (
            errMsg.includes('not found') ||
            errMsg.includes('不存在') ||
            errMsg.includes('已删除')
          ) {
            message.error('该 Pipeline 运行已不存在，可能已被删除');
          } else {
            message.error(`重新运行失败：${errMsg}`);
          }
        } else {
          message.error('重新运行失败，请稍后重试');
        }
      } finally {
        setStageRetryModal({ visible: false, runId: null });
      }
    },
    [loadRuns, navigate]
  );

  const handleRefresh = useCallback(() => {
    loadRuns();
  }, [loadRuns]);

  return {
    // state
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    dateRange,
    setDateRange,
    loading,
    runs,
    cancellingIds,
    stageRetryModal,
    setStageRetryModal,
    // derived
    filteredRuns,
    sortedRuns,
    // handlers
    loadRuns,
    handleRefresh,
    handleRetry,
    handleRetryConfirm,
    handleCancelConfirm: confirmCancel,
    handleCancel,
    handleRetryFromStage,
    navigate,
  };
};

export type PipelineRunListState = ReturnType<typeof usePipelineRunListState>;
