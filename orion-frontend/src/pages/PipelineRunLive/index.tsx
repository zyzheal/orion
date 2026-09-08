/**
 * PipelineRunLive Page
 * Real-time pipeline execution panel with SSE live logs
 *
 * 拆分结构:
 * - types.ts: StageState/StepState/LogEntry + 状态联合类型
 * - constants.ts: 颜色映射 + formatDuration/Time + makeLogId
 * - LiveLogViewer.tsx: 实时日志查看器 (autoScroll + 闪烁光标 + 空态)
 * - StageProgress.tsx: 阶段进度条 + 阶段详情 + 步骤列表
 * - RunMetadataCard.tsx: 8 项 Descriptions 元数据卡
 * - ControlBar.tsx: 暂停/清空/导出/自动滚动切换/重连
 * - usePipelineRunLiveState.ts: SSE 集成 + API 加载 + elapsed timer
 * - Components/PageHeader.tsx: 页头 (P2-9 Phase 211)
 * - index.tsx: 布局组合
 */
import { Card, Space, Spin, Badge, Button, Result } from 'antd';
import { spacing } from '@/tokens';
import { usePipelineRunLiveState } from './usePipelineRunLiveState';
import { LiveLogViewer } from './LiveLogViewer';
import { StageProgress } from './StageProgress';
import { RunMetadataCard } from './RunMetadataCard';
import { ControlBar } from './ControlBar';
import { PageHeader } from './Components/PageHeader';

const PipelineRunLive = () => {
  const {
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
  } = usePipelineRunLiveState();

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
      <PageHeader
        pipelineName={pipeline?.name || 'Pipeline'}
        runId={runId}
        id={id}
        isConnected={isConnected}
        error={error}
        pipelineStatus={pipeline?.status}
        onBack={() => navigate('/pipelines')}
      />

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
