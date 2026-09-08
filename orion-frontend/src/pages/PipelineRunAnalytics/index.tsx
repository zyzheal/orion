/**
 * Pipeline Run History Analytics
 * P2-25: 成功率/耗时趋势/瓶颈分析
 *
 * 拆分结构（P2-9 Phase 38）:
 * - types.ts: RunRecord/PipelineSummary/RunStats/Bottleneck/DurationBucket
 * - constants.tsx: statusConfig + computeStats + formatDuration + toNumberMs
 * - StatsCards.tsx: 6 张 Statistic 卡片行
 * - FilterBar.tsx: Pipeline/Status/DateRange/Refresh 筛选
 * - SuccessRateChart.tsx: 环形进度 + 成功/失败/取消 计数
 * - DurationDistribution.tsx: 30s-2m 等 5 个桶
 * - TopSlowRuns.tsx: Top 5 慢速运行
 * - BottleneckTable.tsx: 按失败次数排序的瓶颈分析
 * - RunHistoryTable.tsx: 运行历史明细 + Cancel/Retry/详情 操作
 * - StageDetailDrawer.tsx: 700px Stage 详情抽屉
 * - index.tsx: state + 4 loader + 6 useMemo + 布局
 *
 * P2-9 Phase 256 重构: 293 → 35 行 (-88%), 新增:
 *   usePipelineRunAnalyticsState.ts   — state 9 + load 2 + memo 5 + openStageDetail
 *   Components/PageHeader.tsx         — Title + Text
 *   Components/AnalyticsPanels.tsx    — 2 Row 5 charts (Success/Duration/TopSlow/Bottleneck)
 */
import { spacing } from '@/tokens';
import { usePipelineRunAnalyticsState } from './usePipelineRunAnalyticsState';
import { PageHeader } from './Components/PageHeader';
import { AnalyticsPanels } from './Components/AnalyticsPanels';
import { FilterBar } from './FilterBar';
import { StatsCards } from './StatsCards';
import { RunHistoryTable } from './RunHistoryTable';
import { StageDetailDrawer } from './StageDetailDrawer';

export default function PipelineRunAnalyticsPage() {
  const state = usePipelineRunAnalyticsState();

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />
      <FilterBar
        pipelines={state.pipelines}
        selectedPipeline={state.selectedPipeline}
        setSelectedPipeline={state.setSelectedPipeline}
        selectedStatus={state.selectedStatus}
        setSelectedStatus={state.setSelectedStatus}
        dateRange={state.dateRange}
        setDateRange={state.setDateRange}
        loading={state.loading}
        loadRuns={state.loadRuns}
      />
      <StatsCards stats={state.stats} />
      <AnalyticsPanels state={state} />
      <RunHistoryTable
        runs={state.runs}
        pipelines={state.pipelines}
        loading={state.loading}
        loadRuns={state.loadRuns}
        openStageDetail={state.openStageDetail}
      />
      <StageDetailDrawer
        selectedRun={state.selectedRun}
        pipelines={state.pipelines}
        stageDetails={state.stageDetails}
        stageLoading={state.stageLoading}
        onClose={() => state.setSelectedRun(null)}
      />
    </div>
  );
}
