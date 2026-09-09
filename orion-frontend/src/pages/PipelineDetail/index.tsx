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
 *
 * P2-9 Phase 261 重构: 194 -> 45 行 (-77%), 新增:
 *   Components/LoadingStates.tsx  — Loading (info) + Error (error) Result
 *   Components/TabItems.tsx       — 5 tabs items (stages/logs/dag/runs/outputs)
 */
import React from 'react';
import { Tabs } from 'antd';
import PipelineErrorDetail from '@/components/pipeline/PipelineErrorDetail';
import { usePipelineDetailState } from './usePipelineDetailState';
import { PipelineHeader } from './PipelineHeader';
import { LoadingStates } from './Components/LoadingStates';
import { buildTabItems } from './Components/TabItems';

const PipelineDetail: React.FC = () => {
  const state = usePipelineDetailState();
  // 直接函数调用：LoadingStates 返回 null 或 ReactNode，避免 JSX element 永远 truthy 导致空白页
  const loadingState = LoadingStates({ state });

  if (loadingState) return loadingState;

  return (
    <div style={{ padding: 0 }}>
      <PipelineHeader
        pipeline={state.pipeline!}
        isRerunning={state.isRerunning}
        loading={state.loading}
        totalStages={state.totalStages}
        completedStages={state.completedStages}
        progressPercent={state.progressPercent}
        formatDuration={state.formatDuration}
        onBack={() => state.navigate('/pipelines')}
        onRerun={state.handleRerun}
      />

      {/* Structured error detail for failed pipelines */}
      {state.pipeline!.status === 'failed' && state.id && (
        <PipelineErrorDetail runId={state.id} onRetry={state.handleReloadPipeline} />
      )}

      {/* Tabbed content: Stages / Logs / DAG / Runs / Outputs */}
      <Tabs activeKey={state.activeTab} onChange={state.setActiveTab} items={buildTabItems({ state })} />
    </div>
  );
};

export default PipelineDetail;
