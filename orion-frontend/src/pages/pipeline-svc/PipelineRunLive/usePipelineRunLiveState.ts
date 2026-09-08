/**
 * usePipelineRunLiveState.ts - Pipeline Run Live 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 216)
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { usePipelineSSE } from '@/hooks/usePipelineSSE';
import { useParams } from 'react-router-dom';
import { getPipelineRun } from '@/api/pipelines';
import type { StageState, LogEntry } from './types';
import { makeLogId, formatTime, logLevelLabels } from './constants';

export function usePipelineRunLiveState() {
  const { id, runId } = useParams<{ id: string; runId: string }>();

  const [pipeline, setPipeline] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stages, setStages] = useState<StageState[]>([]);
  const [currentStageId, setCurrentStageId] = useState<string | undefined>();
  const [displayLogs, setDisplayLogs] = useState<LogEntry[]>([]);

  const {
    logs: sseLogs,
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
      if (statusEvent) {
        setPipeline((prev) =>
          prev
            ? { ...prev, status: statusEvent.status, progress: statusEvent.progress }
            : prev
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

  // Load pipeline metadata from API
  useEffect(() => {
    const loadPipeline = async () => {
      setLoading(true);
      setApiError(null);
      try {
        const response = await getPipelineRun(id!);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wrapperData = response.data as { data?: any; success?: boolean };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apiData = wrapperData?.data ?? wrapperData;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (apiData && ((apiData as any).run || (apiData as any).stages)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const run = (apiData as any).run || apiData;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const flattened: any = {
            ...run,
            branch: run.context?.branch || run.branch || 'main',
            commit: run.context?.commitSha || run.commit || '-',
            version: run.context?.version || run.pipelineVersion,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stages: (apiData as any).stages || [],
          };
          setPipeline(flattened);
          if (flattened.stages.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const initialized: StageState[] = flattened.stages.map((s: any, idx: number) => ({
              id: s.id || `stage-${idx}`,
              name: s.name,
              status: s.status || 'pending',
              startTime: s.startedAt,
              endTime: s.completedAt,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              steps: (s.steps || []).map((st: any, stIdx: number) => ({
                id: st.id || `step-${idx}-${stIdx}`,
                name: st.name,
                status: st.status || 'pending',
                startTime: st.startedAt,
                endTime: st.completedAt,
              })),
            }));
            setStages(initialized);
            const running = initialized.find((s) => s.status === 'running');
            if (running) setCurrentStageId(running.id);
          }
        } else {
          setApiError('未找到该 Pipeline 运行记录');
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '加载失败，请稍后重试';
        setApiError(errorMsg);
        message.error(`加载 Pipeline 详情失败：${errorMsg}`);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadPipeline();
  }, [id]);

  // Elapsed time counter for running pipelines
  useEffect(() => {
    if ((pipeline?.status as string) === 'running') {
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
    id,
    runId,
    pipeline,
    loading,
    apiError,
    autoScroll,
    setAutoScroll,
    isPaused,
    setIsPaused,
    searchText,
    setSearchText,
    elapsedSeconds,
    stages,
    currentStageId,
    displayLogs,
    isConnected,
    error,
    handlePause,
    handleClearLogs,
    handleExportLogs,
    handleReconnect,
  };
}
