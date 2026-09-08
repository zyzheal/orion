/**
 * PipelineRunLive Page
 * Real-time pipeline execution panel with SSE live logs
 *
 * 拆分自 index.tsx (P2-9 Phase 216)
 * - usePipelineRunLiveState.ts: state + usePipelineSSE + loadPipeline + handlers
 * - Components/PageHeader.tsx: header with SSE badge + StatusBadge
 * - Components/LogPanel.tsx: grid layout StageProgress + LiveLogViewer
 * - index.tsx: loading + apiError + composition
 */
import { Spin, Card, Typography, Button } from 'antd';
import {
  PlayCircleOutlined,
  ArrowLeftOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors, spacing } from '@/tokens';
import { usePipelineRunLiveState } from './usePipelineRunLiveState';
import { PageHeader } from './Components/PageHeader';
import { LogPanel } from './Components/LogPanel';
import { RunMetadataCard } from './RunMetadataCard';
import { ControlBar } from './ControlBar';

const { Title } = Typography;

const PipelineRunLive = () => {
  const navigate = useNavigate();
  const {
    id,
    runId,
    pipeline,
    loading,
    apiError,
    autoScroll,
    setAutoScroll,
    isPaused,
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
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/pipelines')}
              >
                返回列表
              </Button>
              <Title level={2} style={{ margin: 0 }}>
                <PlayCircleOutlined
                  style={{ marginRight: spacing[3], color: colors.primary[500] }}
                />
                实时执行面板
              </Title>
            </div>
          }
        >
          <div style={{ textAlign: 'center', padding: 40, color: colors.error[500] }}>
            <CloseCircleOutlined style={{ fontSize: 48, marginBottom: spacing.md }} />
            <div>{apiError}</div>
          </div>
        </Card>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawStages = (pipeline?.stages as any[] | undefined) || [];
  const totalStages = rawStages.length;
  const completedStages = rawStages.filter((s) => s.status === 'success').length;
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        pipeline={pipeline}
        runId={runId}
        id={id}
        isConnected={isConnected}
        error={error}
        onBack={() => navigate('/pipelines')}
      />

      <RunMetadataCard
        pipeline={pipeline as never}
        runId={runId}
        id={id}
        elapsedSeconds={elapsedSeconds}
        completedStages={completedStages}
        totalStages={totalStages}
        progressPercent={progressPercent}
      />

      <ControlBar
        searchText={searchText}
        setSearchText={setSearchText}
        autoScroll={autoScroll}
        setAutoScroll={setAutoScroll}
        isPaused={isPaused}
        handlePause={handlePause}
        handleClearLogs={handleClearLogs}
        handleExportLogs={handleExportLogs}
        handleReconnect={handleReconnect}
        displayLogs={displayLogs}
      />

      <LogPanel
        stages={stages}
        currentStageId={currentStageId}
        displayLogs={displayLogs}
        autoScroll={autoScroll}
        searchText={searchText}
        isConnected={isConnected}
      />
    </div>
  );
};

export default PipelineRunLive;
