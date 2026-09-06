/**
 * Pipeline Detail Page (TASK-905)
 * Pipeline detail view with stages/timeline/logs and re-run actions.
 *
 * P0-3 Fix: Removed silent mock fallback. On API failure, displays error
 * message and allows retry instead of silently showing mock data.
 * Mock data is kept only in test files.
 *
 * 主入口 (P2-9 Phase 103 refactor: 已抽取
 *   - types.ts (StepDetail/StageDetail/PipelineDetailModel/APIFlattenedResponse)
 *   - constants.ts (stageStatusColors + triggerLabel)
 *   - format.ts (formatDuration)
 *   - usePipelineDetailState.ts (state + handlers)
 *   - Components/PageHeader.tsx
 *   - Components/PipelineInfoCard.tsx
 *   - Components/StageTab.tsx (进度条 + 阶段卡片)
 *   - Components/LogsTab.tsx
 *   - Components/DagTab.tsx
 * )
 */
import React from 'react';
import { Tabs, Button, Result, Empty } from 'antd';
import {
  PlayCircleOutlined,
  CodeOutlined,
  ApartmentOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import { usePipelineDetailState } from './usePipelineDetailState';
import { PageHeader } from './Components/PageHeader';
import { PipelineInfoCard } from './Components/PipelineInfoCard';
import { StageTab } from './Components/StageTab';
import { LogsTab } from './Components/LogsTab';
import { DagTab } from './Components/DagTab';

const { TabPane } = Tabs;

const PipelineDetail: React.FC = () => {
  const state = usePipelineDetailState();

  if (state.loading) {
    return (
      <div style={{ padding: 0 }}>
        <CardPanel>Loading...</CardPanel>
      </div>
    );
  }

  if (state.apiError && !state.pipeline) {
    return (
      <div style={{ padding: 0 }}>
        <Result
          status="error"
          title="加载失败"
          subTitle={state.apiError}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              重新加载
            </Button>
          }
        />
      </div>
    );
  }

  if (!state.pipeline) {
    return (
      <div style={{ padding: 0 }}>
        <Empty description="暂无数据" />
      </div>
    );
  }

  const pipeline = state.pipeline;

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        pipeline={pipeline}
        loading={state.loading}
        isRerunning={state.isRerunning}
        onBack={() => state.navigate('/pipelines')}
        onRerun={state.handleRerun}
      />

      <PipelineInfoCard
        pipeline={pipeline}
        completedStages={state.completedStages}
        totalStages={state.totalStages}
        progressPercent={state.progressPercent}
      />

      <Tabs activeKey={state.activeTab} onChange={state.setActiveTab} style={{ marginBottom: spacing.md }}>
        <TabPane
          tab={
            <PlayCircleOutlined />
          }
          key="stages"
        >
          <StageTab
            pipeline={pipeline}
            retryingStageId={state.retryingStageId}
            onRetryFromStage={state.handleRetryFromStage}
          />
        </TabPane>

        <TabPane
          tab={
            <CodeOutlined />
          }
          key="logs"
        >
          <LogsTab pipeline={pipeline} />
        </TabPane>

        <TabPane
          tab={
            <ApartmentOutlined />
          }
          key="dag"
        >
          <DagTab pipeline={pipeline} />
        </TabPane>

        <TabPane
          tab={
            <SwapOutlined />
          }
          key="outputs"
        >
          <CardPanel title="任务输出与变量传播">
            <Empty description="任务输出变量传播功能即将上线" />
          </CardPanel>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default PipelineDetail;
