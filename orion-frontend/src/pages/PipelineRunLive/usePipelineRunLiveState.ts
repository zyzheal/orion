/**
 * usePipelineRunLiveState.ts - Pipeline 实时执行状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 211)
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { usePipelineSSE } from '@/hooks/usePipelineSSE';
import { useQuery } from '@/providers/QueryProvider';
import { useNavigate, useParams } from 'react-router-dom';
import { getPipelineRun } from '@/api/pipelines';
import type { StageState, StepState, LogEntry } from './types';
import { makeLogId, formatTime, logLevelLabels } from './constants';

export function usePipelineRunLiveState() {
  const navigate = useNavigate();
  const { id, runId } = useParams<{ id: string; runId: string }>();

  const [pipeline, setPipeline] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stages, setStages] = useState<StageState[]>([]);
  const [currentStageId, setCurrentStageId] = useState<string | undefined>();
  const [displayLogs, setDisplayLogs] = useState<LogEntry[]>([]);

  const {
    data: apiData,
    isLoading: loading,
    isError: apiQueryError,
    error: apiQueryErrorObj,
  } = useQuery<any>({
    queryKey: ['pipeline-run', runId || id],
    queryFn: async () => {
      if (!runId && !id) return null;
      const response = await getPipelineRun((runId || id)!);
      return response.data as any;
    },
    enabled: !!(id || runId),
    staleTime: 15_000,
    // SSE 已负责实时更新，useQuery 仅作初始加载；数据通过下方 useEffect 落到局部 state
  });

  const {
    logs: sseLogs,
    status: sseStatus,
    isConnected,
    error,
    connect,
    disconnect,
    clearLogs,
  } = usePipelineSSE({
    pipelineId: id || '',
    runId: runId || id || '',
    autoConnect: !isPaused && !!(id && runId),
    maxLogs: 2000,
    onStatusChange: (statusEvent) => {
      if (sseStatus) {
        setPipeline((prev: any) =>
          prev ? { ...prev, status: statusEvent.status, progress: statusEvent.progress } : prev
        );
      }
    },
  });

  // Convert SSE logs to display format
  useEffect(() => {
    setDisplayLogs(
      sseLogs.map((log) => ({
        id: makeLogId(),
        timestamp: log.timestamp,
        stageName: log.stageName,
        stepName: log.stepName,
        text: log.logLine,
        level: log.level,
      }))
    );
  }, [sseLogs]);

  // Load pipeline metadata from API — useQuery 数据桥接到局部 state（SSE 合并层）
  useEffect(() => {
    if (!apiData) return;
    setPipeline(apiData);
    if (apiData.stages) {
      const initialized: StageState[] = apiData.stages.map((s: any, idx: number) => ({
        id: s.id || `stage-${idx}`,
        name: s.name || '',
        status: (s.status || 'pending') as StageState['status'],
        startTime: s.startTime || '',
        endTime: s.endTime || '',
        steps: (s.steps || []).map(
          (
            st: {
              id?: string;
              name?: string;
              status?: string;
              startTime?: string;
              endTime?: string;
            },
            stIdx: number
          ) => ({
            id: st.id || `step-${idx}-${stIdx}`,
            name: st.name || '',
            status: (st.status || 'pending') as StepState['status'],
            startTime: st.startTime || '',
            endTime: st.endTime || '',
          })
        ),
      }));
      setStages(initialized);
      const running = initialized.find((s) => s.status === 'running');
      if (running) setCurrentStageId(running.id);
    }
  }, [apiData]);

  // 加载失败反馈
  useEffect(() => {
    if (!apiQueryError) return;
    const msg = apiQueryErrorObj instanceof Error ? apiQueryErrorObj.message : '加载失败，请稍后重试';
    setApiError(msg);
    message.error(`加载 Pipeline 详情失败：${msg}`);
  }, [apiQueryError, apiQueryErrorObj]);

  // Elapsed time counter for running pipelines
  useEffect(() => {
    if (pipeline?.status === 'running') {
      const timer = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [pipeline?.status]);

  const handlePause = useCallback(() => setIsPaused((prev) => !prev), []);

  const handleClearLogs = useCallback(() => {
    clearLogs();
    setDisplayLogs([]);
    message.info('日志已清空');
  }, [clearLogs]);

  const handleExportLogs = useCallback(() => {
    const logText = displayLogs
      .map(
        (l) =>
          `[${formatTime(l.timestamp)}] [${logLevelLabels[l.level]}] ${l.stepName ? `[${l.stepName}] ` : ''}${l.text}`
      )
      .join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-${id}-run-${runId}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('日志已导出');
  }, [displayLogs, id, runId]);

  const handleReconnect = useCallback(() => {
    disconnect();
    connect();
  }, [disconnect, connect]);

  return {
    navigate,
    id,
    runId,
    pipeline,
    apiError,
    loading,
    autoScroll,
    setAutoScroll,
    isPaused,
    isConnected,
    error,
    elapsedSeconds,
    stages,
    currentStageId,
    displayLogs,
    handlePause,
    handleClearLogs,
    handleExportLogs,
    handleReconnect,
  };
}
