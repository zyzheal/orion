/**
 * Pipeline Detail Page (TASK-905)
 * Pipeline detail view with stages/timeline/logs and re-run actions.
 *
 * 拆分结构（P2-9 Phase 24）:
 * - usePipelineDetailState.ts: 状态 + 加载器 + 处理器
 * - PipelineHeader.tsx: 页面头部 + 状态卡片
 * - StageTimeline.tsx: 阶段详情 Tab
 * - LogViewer.tsx: 执行日志 Tab
 * - DAGTab.tsx: DAG 视图 Tab
 * - RunsHistoryTab.tsx: 运行历史 Tab
 * - TaskOutputsTable.tsx: 任务输出占位组件
 * - types.ts / constants.ts / helpers.ts: 类型/常量/工具
 */
import React from 'react';
import { Typography, Button, Space, Tabs, Result, Card, Badge } from 'antd';
import {
  PlayCircleOutlined,
  CodeOutlined,
  ApartmentOutlined,
  HistoryOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import PipelineErrorDetail from '@/components/pipeline/PipelineErrorDetail';
import { colors, spacing } from '@/tokens';
import { usePipelineDetailState } from './usePipelineDetailState';
import { PipelineHeader } from './PipelineHeader';
import { StageTimeline } from './StageTimeline';
import { LogViewer } from './LogViewer';
import { DAGTab } from './DAGTab';
import { RunsHistoryTab } from './RunsHistoryTab';
import { TaskOutputsTable } from './TaskOutputsTable';

const { Text } = Typography;
const { TabPane } = Tabs;

const PipelineDetail: React.FC = () => {
  const {
    id,
    navigate,
    activeTab,
    setActiveTab,
    isRerunning,
    retryingStageId,
    loading,
    apiError,
    pipeline,
    runs,
    runsLoading,
    totalStages,
    completedStages,
    progressPercent,
    formatDuration,
    handleRerun,
    handleReloadPipeline,
    handleRetryFromStage,
  } = usePipelineDetailState();

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: 0 }}>
        <Result status="info" title="加载中..." />
      </div>
    );
  }

  // Error state
  if (apiError || !pipeline) {
    return (
      <div style={{ padding: 0 }}>
        <Result
          status="error"
          title="加载失败"
          subTitle={apiError}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              重新加载
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <PipelineHeader
        pipeline={pipeline}
        isRerunning={isRerunning}
        loading={loading}
        totalStages={totalStages}
        completedStages={completedStages}
        progressPercent={progressPercent}
        formatDuration={formatDuration}
        onBack={() => navigate('/pipelines')}
        onRerun={handleRerun}
      />

      {/* Structured error detail for failed pipelines */}
      {pipeline.status === 'failed' && id && (
        <PipelineErrorDetail runId={id} onRetry={handleReloadPipeline} />
      )}

      {/* Tabbed content: Stages / Logs / DAG / Runs / Outputs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <Space>
              <PlayCircleOutlined />
              阶段详情
            </Space>
          }
          key="stages"
        >
          <StageTimeline
            pipeline={pipeline}
            retryingStageId={retryingStageId}
            formatDuration={formatDuration}
            onRetryFromStage={handleRetryFromStage}
          />
        </TabPane>

        <TabPane
          tab={
            <Space>
              <CodeOutlined />
              执行日志
            </Space>
          }
          key="logs"
        >
          <LogViewer pipeline={pipeline} />
        </TabPane>

        <TabPane
          tab={
            <Space>
              <ApartmentOutlined />
              DAG 视图
            </Space>
          }
          key="dag"
        >
          <DAGTab pipeline={pipeline} />
        </TabPane>

        {/* 运行历史 Tab */}
        <TabPane
          tab={
            <Space>
              <HistoryOutlined />
              运行历史
              <Badge count={runs.length} style={{ backgroundColor: colors.primary[500] }} />
            </Space>
          }
          key="runs"
        >
          <RunsHistoryTab
            id={id}
            runs={runs}
            runsLoading={runsLoading}
            isRerunning={isRerunning}
            onNavigate={(path) => navigate(path)}
            onRerun={handleRerun}
          />
        </TabPane>

        <TabPane
          tab={
            <Space>
              <SwapOutlined />
              任务输出
            </Space>
          }
          key="outputs"
        >
          {/* Task outputs / variable propagation table */}
          <Card
            style={{ marginBottom: spacing.lg }}
            title="任务输出与变量传播"
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
              以下列出各阶段任务产生的输出变量及其传播目标。
            </Text>
            <TaskOutputsTable />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default PipelineDetail;
