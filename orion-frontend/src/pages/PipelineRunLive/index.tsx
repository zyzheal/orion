/**
 * PipelineRunLive Page
 * Real-time pipeline execution panel with SSE live logs
 *
 * 拆分结构（P2-9 Phase 37）:
 * - types.ts: StageState/StepState/LogEntry/PipelineRun/Task/Step + 状态联合类型
 * - constants.ts: 颜色映射 + formatDuration/Time + makeLogId
 * - LiveLogViewer.tsx: 实时日志查看器 (autoScroll + 闪烁光标 + 空态)
 * - StageProgress.tsx: 阶段进度条 + 阶段详情 + 步骤列表
 * - RunMetadataCard.tsx: 8 项 Descriptions 元数据卡
 * - ControlBar.tsx: 暂停/清空/导出/自动滚动切换/重连
 * - index.tsx: SSE 集成 + API 加载 + elapsed timer + 布局
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Button, Space, Card, Spin, Badge, message, Result } from 'antd';
import {
  CloudUploadOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import StatusBadge from '@/components/StatusBadge';
import { usePipelineSSE } from '@/hooks/usePipelineSSE';
import { useQuery } from '@/providers/QueryProvider';
import { useNavigate, useParams } from 'react-router-dom';
import { getPipelineRun } from '@/api/pipelines';
import type { StageState, StepState, LogEntry } from './types';
import { makeLogId, formatTime, logLevelLabels } from './constants';
import { LiveLogViewer } from './LiveLogViewer';
import { StageProgress } from './StageProgress';
import { RunMetadataCard } from './RunMetadataCard';
import { ControlBar } from './ControlBar';

const { Title, Text } = Typography;

const PipelineRunLive: React.FC = () => {
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

  if (loading) {
    return (
      <div style={{ padding: 0 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (apiError && !pipeline) {
    return (
      <div style={{ padding: 0 }}>
        <Result
          status="error"
          title="加载失败"
          subTitle={apiError}
          extra={
            <Space>
              <Button onClick={() => navigate('/pipelines')}>返回列表</Button>
              <Button type="primary" onClick={() => window.location.reload()}>
                重新加载
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  const totalStages = pipeline?.stages?.length || 0;
  const completedStages = pipeline?.stages?.filter((s: any) => s.status === 'success').length || 0;
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title
            level={2}
            style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
          >
            <CloudUploadOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            {pipeline?.name || 'Pipeline'} 实时执行
          </Title>
          <Space size="middle" wrap>
            <Text type="secondary">运行 #{pipeline?.runNumber || runId || id}</Text>
            <Badge
              status={isConnected ? 'success' : 'error'}
              text={isConnected ? 'SSE 已连接' : 'SSE 未连接'}
            />
            {error && (
              <Text type="danger" style={{ fontSize: 12 }}>
                连接错误: {error.message}
              </Text>
            )}
            {pipeline && <StatusBadge status={pipeline.status} size="small" />}
          </Space>
        </div>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/pipelines')}>
            返回列表
          </Button>
        </Space>
      </div>

      <RunMetadataCard
        pipeline={pipeline}
        runId={runId}
        id={id}
        elapsedSeconds={elapsedSeconds}
        completedStages={completedStages}
        totalStages={totalStages}
        progressPercent={progressPercent}
      />

      <ControlBar
        isPaused={isPaused}
        handlePause={handlePause}
        handleClearLogs={handleClearLogs}
        handleExportLogs={handleExportLogs}
        handleReconnect={handleReconnect}
        autoScroll={autoScroll}
        setAutoScroll={setAutoScroll}
        logCount={displayLogs.length}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          gap: spacing.md,
          alignItems: 'start',
        }}
      >
        <Card title="执行阶段" size="small">
          <StageProgress stages={stages} currentStageId={currentStageId} />
        </Card>
        <Card
          title={
            <Space>
              实时日志
              {isConnected && <Badge status="success" text="实时推送中" />}
            </Space>
          }
          size="small"
        >
          <LiveLogViewer logs={displayLogs} autoScroll={autoScroll} />
        </Card>
      </div>
    </div>
  );
};

export default PipelineRunLive;
