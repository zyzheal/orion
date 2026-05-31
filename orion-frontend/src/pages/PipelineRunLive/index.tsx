/**
 * PipelineRunLive Page
 * Real-time pipeline execution panel with SSE live logs
 *
 * Features:
 * - Live log streaming via SSE (usePipelineSSE hook)
 * - Stage/task status indicators with real-time color changes
 * - Log viewer with auto-scroll
 * - Pause/resume controls
 * - Run metadata (pipeline name, run ID, started time, duration)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Typography, Button, Space, Tag, Card, Descriptions, Badge, message, Spin, Divider, Result } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ArrowLeftOutlined,
  ClearOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import StatusBadge from '@/components/StatusBadge';
import { usePipelineSSE } from '@/hooks/usePipelineSSE';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { getPipelineRun } from '@/api/pipelines';

dayjs.extend(duration);

type PipelineRun = { id: string; name: string; status: string; startTime?: string; endTime?: string };
type Task = { id: string; name: string; status: string };
type Step = { id: string; name: string; status: string };
const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface StageState {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'warning';
  startTime?: string;
  endTime?: string;
  steps: StepState[];
}

interface StepState {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  startTime?: string;
  endTime?: string;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  stageName: string;
  stepName?: string;
  text: string;
  level: 'info' | 'warn' | 'error' | 'debug';
}

// ============================================================================
// Helpers
// ============================================================================

const stageStatusColors: Record<string, string> = {
  success: colors.success[500],
  running: colors.primary[500],
  failed: colors.error[500],
  pending: colors.neutral[300],
  warning: colors.warning[500],
  cancelled: colors.neutral[400],
};

const logLevelColors: Record<string, string> = {
  info: colors.neutral[300],
  warn: colors.warning[400],
  error: colors.error[400],
  debug: colors.purple[400],
};

const logLevelLabels: Record<string, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  debug: 'DEBUG',
};

function formatDuration(seconds?: number): string {
  if (!seconds) return '-';
  const dur = dayjs.duration(seconds, 'seconds');
  const minutes = Math.floor(dur.asMinutes());
  const secs = dur.seconds();
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

function formatTime(date: Date | string): string {
  return dayjs(date).format('HH:mm:ss.SSS');
}

// Generate a unique log entry ID
let logIdCounter = 0;
function makeLogId(): string {
  return `log-${++logIdCounter}-${Date.now()}`;
}

// ============================================================================
// Component: LiveLogViewer
// ============================================================================

interface LiveLogViewerProps {
  logs: LogEntry[];
  autoScroll: boolean;
}

const LiveLogViewer: React.FC<LiveLogViewerProps> = ({ logs, autoScroll }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLogCountRef = useRef(0);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (autoScroll && logs.length > prevLogCountRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    prevLogCountRef.current = logs.length;
  }, [logs.length, autoScroll]);

  if (logs.length === 0) {
    return (
      <div
        style={{
          background: colors.neutral[900],
          borderRadius: 6,
          padding: '40px 16px',
          textAlign: 'center',
          color: colors.neutral[500],
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          fontSize: spacing[3],
        }}
      >
        <LoadingOutlined style={{ fontSize: 24, marginBottom: 12 }} />
        <div>等待日志推送...</div>
        <Text type="secondary" style={{ fontSize: spacing[2] }}>
          SSE 连接建立后将实时显示日志
        </Text>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: colors.neutral[900],
        borderRadius: 6,
        padding: 12,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 12,
        lineHeight: 1.6,
        maxHeight: 500,
        overflowY: 'auto',
        color: colors.neutral[300],
      }}
    >
      {logs.map((log) => {
        const textColor = logLevelColors[log.level] || colors.neutral[300];
        return (
          <div key={log.id} style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: colors.neutral[500], flexShrink: 0, userSelect: 'none' }}>
              {formatTime(log.timestamp)}
            </span>
            <span style={{ color: textColor, fontWeight: 600, flexShrink: 0, minWidth: 48 }}>
              [{logLevelLabels[log.level]}]
            </span>
            {log.stepName && (
              <Tag
                color="blue"
                style={{ margin: 0, fontSize: 10, lineHeight: '18px', height: 18, flexShrink: 0 }}
              >
                {log.stepName}
              </Tag>
            )}
            <span style={{ color: textColor, wordBreak: 'break-word' }}>{log.text}</span>
          </div>
        );
      })}
      {/* Blinking cursor when connection is active */}
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 16,
          backgroundColor: colors.neutral[300],
          animation: 'blink 1s step-end infinite',
          marginTop: 4,
        }}
      />
    </div>
  );
};

// ============================================================================
// Component: StageProgress
// ============================================================================

interface StageProgressProps {
  stages: StageState[];
  currentStageId?: string;
}

const StageProgress: React.FC<StageProgressProps> = ({ stages, currentStageId }) => {
  const statusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: colors.success[500] }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: colors.error[500] }} />;
      case 'running':
        return <LoadingOutlined style={{ color: colors.primary[500] }} />;
      default:
        return <span style={{ color: colors.neutral[400] }}>&#9679;</span>;
    }
  };

  if (stages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 24, color: colors.neutral[500] }}>
        <Text>暂无阶段数据</Text>
      </div>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {/* Stage progress bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 0',
        }}
      >
        {stages.map((stage, index) => (
          <React.Fragment key={stage.id || index}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: stageStatusColors[stage.status] || colors.neutral[300],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.neutral[0],
                  fontSize: spacing[4],
                  fontWeight: 600,
                  boxShadow:
                    stage.status === 'running' ? '0 0 0 4px rgba(24,144,255,0.2)' : 'none',
                  animation:
                    stage.status === 'running' ? 'status-pulse 1.5s ease-in-out infinite' : 'none',
                }}
              >
                {statusIcon(stage.status)}
              </div>
              <Text
                style={{
                  fontSize: 12,
                  textAlign: 'center',
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={stage.name}
              >
                {stage.name}
              </Text>
            </div>
            {index < stages.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 3,
                  backgroundColor:
                    stages[index + 1].status === 'pending'
                      ? colors.light.border.light
                      : stageStatusColors[stages[index].status] || colors.neutral[300],
                  borderRadius: 2,
                  marginTop: -16,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Stage details */}
      <Divider style={{ margin: '8px 0' }} />
      {stages.map((stage, index) => (
        <Card
          key={stage.id || index}
          size="small"
          style={{
            marginBottom: 8,
            borderColor:
              stage.id === currentStageId && stage.status === 'running'
                ? colors.primary[300]
                : undefined,
          }}
          title={
            <Space>
              {statusIcon(stage.status)}
              <Text strong>
                {index + 1}. {stage.name}
              </Text>
            </Space>
          }
          extra={
            <StatusBadge
              status={stage.status}
              size="small"
              label={stage.status === 'running' ? '运行中' : stage.status === 'success' ? '成功' : stage.status === 'failed' ? '失败' : '等待中'}
            />
          }
        >
          {stage.steps && stage.steps.length > 0 ? (
            <Space direction="vertical" size={4}>
              {stage.steps.map((step) => (
                <div
                  key={step.id || step.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: spacing[3],
                  }}
                >
                  <span style={{ color: stageStatusColors[step.status] || colors.neutral[300] }}>
                    {statusIcon(step.status)}
                  </span>
                  <Text>{step.name}</Text>
                  <Tag
                    color={
                      step.status === 'success'
                        ? 'success'
                        : step.status === 'failed'
                          ? 'error'
                          : step.status === 'running'
                            ? 'processing'
                            : 'default'
                    }
                    style={{ marginLeft: 'auto' }}
                  >
                    {step.status}
                  </Tag>
                </div>
              ))}
            </Space>
          ) : (
            <Text type="secondary">暂无步骤数据</Text>
          )}
        </Card>
      ))}
    </Space>
  );
};

// ============================================================================
// Main Component: PipelineRunLive
// ============================================================================

const PipelineRunLive: React.FC = () => {
  const navigate = useNavigate();
  const { id, runId } = useParams<{ id: string; runId: string }>();

  const [pipeline, setPipeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Track stage states locally for real-time updates
  const [stages, setStages] = useState<StageState[]>([]);
  const [currentStageId, setCurrentStageId] = useState<string | undefined>();

  // SSE hook
  const { logs: sseLogs, status: sseStatus, isConnected, error, connect, disconnect, clearLogs } =
    usePipelineSSE({
      pipelineId: id || '',
      runId: runId || id || '',
      autoConnect: !isPaused && !!(id && runId),
      maxLogs: 2000,
      onStatusChange: (statusEvent) => {
        // Update pipeline status from SSE
        if (sseStatus) {
          setPipeline((prev: any) =>
            prev
              ? { ...prev, status: statusEvent.status, progress: statusEvent.progress }
              : prev
          );
        }
      },
    });

  // Convert SSE logs to display format
  const [displayLogs, setDisplayLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const newEntries: LogEntry[] = sseLogs.map((log) => ({
      id: makeLogId(),
      timestamp: log.timestamp,
      stageName: log.stageName,
      stepName: log.stepName,
      text: log.logLine,
      level: log.level,
    }));
    setDisplayLogs(newEntries);
  }, [sseLogs]);

  // Load pipeline metadata from API
  useEffect(() => {
    const loadPipeline = async () => {
      setLoading(true);
      setApiError(null);
      try {
        const response = await getPipelineRun(runId!);
        // Backend returns { run, stages, tasks } directly, not wrapped in data
        const apiData = response.data as { run?: PipelineRun; stages?: StageState[]; tasks?: Task[] };
        if (apiData) {
          setPipeline(apiData);
          // Initialize stages from API data
          if (apiData.stages) {
            const initialized: StageState[] = apiData.stages.map((s: { id?: string; name?: string; status?: string; startTime?: string; endTime?: string; steps?: Step[] }, idx: number) => ({
              id: s.id || `stage-${idx}`,
              name: s.name || '',
              status: (s.status || 'pending') as StageState['status'],
              startTime: s.startTime || '',
              endTime: s.endTime || '',
              steps: (s.steps || []).map((st: { id?: string; name?: string; status?: string; startTime?: string; endTime?: string }, stIdx: number) => ({
                id: st.id || `step-${idx}-${stIdx}`,
                name: st.name || '',
                status: (st.status || 'pending') as StepState['status'],
                startTime: st.startTime || '',
                endTime: st.endTime || '',
              })),
            }));
            setStages(initialized);
            // Set current stage to the first running one
            const running = initialized.find((s) => s.status === 'running');
            if (running) {
              setCurrentStageId(running.id);
            }
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

    if (id) {
      loadPipeline();
    }
  }, [id]);

  // Elapsed time counter for running pipelines
  useEffect(() => {
    if (pipeline?.status === 'running') {
      const timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [pipeline?.status]);

  // Handle pause/resume
  const handlePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Handle clear logs
  const handleClearLogs = useCallback(() => {
    clearLogs();
    setDisplayLogs([]);
    message.info('日志已清空');
  }, [clearLogs]);

  // Handle export logs
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

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: 0 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // Error state
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
  const completedStages =
    pipeline?.stages?.filter((s: any) => s.status === 'success').length || 0;
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page header - 与列表页 space-between 布局一致 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
            <CloudUploadOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            {pipeline?.name || 'Pipeline'} 实时执行
          </Title>
          <Space size="middle" wrap>
            <Text type="secondary">
              运行 #{pipeline?.runNumber || runId || id}
            </Text>
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
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/pipelines')}
          >
            返回列表
          </Button>
        </Space>
      </div>

      {/* Run metadata */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={4} size="small" labelStyle={{ width: 80 }}>
          <Descriptions.Item label="Pipeline">
            <Text strong>{pipeline?.name || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="运行 ID">
            <Text code>{pipeline?.runNumber || runId || id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="分支">
            {pipeline?.branch ? (
              <Tag color="blue">{pipeline.branch}</Tag>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="触发人">
            <Text code>{pipeline?.author || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            <Space>
              <ClockCircleOutlined />
              <Text type="secondary">
                {pipeline?.startTime
                  ? dayjs(pipeline.startTime).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="耗时">
            {pipeline?.status === 'running' ? (
              <Text type="secondary">{formatDuration(elapsedSeconds)}</Text>
            ) : (
              <Text type="secondary">{formatDuration(pipeline?.duration)}</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="进度">
            <Space>
              <Badge
                status={
                  pipeline?.status === 'success'
                    ? 'success'
                    : pipeline?.status === 'failed'
                      ? 'error'
                      : 'processing'
                }
                text={`${completedStages}/${totalStages} 阶段完成`}
              />
              <Text type="secondary">({progressPercent}%)</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="提交">
            {pipeline?.commit && (
              <Tag color="default" style={{ marginRight: 8 }}>
                {pipeline.commit}
              </Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Control bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          padding: '8px 12px',
          background: colors.light.bg.tertiary,
          borderRadius: 6,
        }}
      >
        <Button
          size="small"
          icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
          onClick={handlePause}
          title={isPaused ? '恢复日志流' : '暂停日志流'}
        >
          {isPaused ? '恢复' : '暂停'}
        </Button>
        <Button
          size="small"
          icon={<ClearOutlined />}
          onClick={handleClearLogs}
          title="清空日志"
        >
          清空日志
        </Button>
        <Button
          size="small"
          icon={<DownloadOutlined />}
          onClick={handleExportLogs}
          title="导出日志"
        >
          导出日志
        </Button>
        <Divider type="vertical" />
        <Button
          size="small"
          type={autoScroll ? 'primary' : 'default'}
          onClick={() => setAutoScroll(!autoScroll)}
          title={autoScroll ? '关闭自动滚动' : '开启自动滚动'}
        >
          {autoScroll ? '自动滚动: 开' : '自动滚动: 关'}
        </Button>
        <Divider type="vertical" />
        <Button
          size="small"
          icon={<SyncOutlined />}
          onClick={() => {
            disconnect();
            connect();
          }}
          title="重新连接 SSE"
        >
          重连
        </Button>
        <div style={{ marginLeft: 'auto' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            日志数: {displayLogs.length}
          </Text>
        </div>
      </div>

      {/* Main content: stages on left, logs on right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* Left: Stage progress */}
        <Card title="执行阶段" size="small">
          <StageProgress stages={stages} currentStageId={currentStageId} />
        </Card>

        {/* Right: Live logs */}
        <Card
          title={
            <Space>
              实时日志
              {isConnected && (
                <Badge status="success" text="实时推送中" />
              )}
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
