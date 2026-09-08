/**
 * PipelineMonitor - 运行监控面板
 * 展示 Pipeline 运行统计、失败分析、趋势图表、性能指标
 *
 * 拆分结构（P2-9 Phase 26）:
 * - usePipelineMonitorState.ts: 状态 + loadData + 轮询逻辑 + formatDuration
 * - StatsCards.tsx: 第一行 4 卡 + P50/P95 行
 * - TrendChart.tsx: 运行趋势柱状图
 * - FailureAnalysis.tsx: 失败模式分布 + 失败阶段 Top 5
 * - RecentRunsTable.tsx: 最近运行表格
 * - constants.ts: 轮询间隔 + 颜色/标签映射
 *
 * Phase 248 追加拆分:
 * - Components/PageHeader.tsx: 标题 + 轮询指示 + 天数 Select + 刷新
 * - Components/TrendChartCard.tsx: 趋势图 CardPanel
 * - Components/EmptyState.tsx: 空状态
 * - Components/InlineStyles.tsx: 内联脉冲动画样式
 */
import { usePipelineMonitorState } from './usePipelineMonitorState';
import { StatsCards } from './StatsCards';
import { FailureAnalysis } from './FailureAnalysis';
import { RecentRunsTable } from './RecentRunsTable';
import { PageHeader } from './Components/PageHeader';
import { TrendChartCard } from './Components/TrendChartCard';
import { EmptyState } from './Components/EmptyState';
import { InlineStyles } from './Components/InlineStyles';
import { spacing } from '@/tokens';

const PipelineMonitor: React.FC = () => {
  const {
    loading,
    stats,
    days,
    setDays,
    failedRuns,
    recentRuns,
    dailyStats,
    failedStageStats,
    p50Duration,
    p95Duration,
    isPolling,
    handleRefresh,
    formatDuration,
  } = usePipelineMonitorState();

  // 空状态
  if (!loading && (!stats || stats.totalRuns === 0)) {
    return <EmptyState />;
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader
        loading={loading}
        isPolling={isPolling}
        days={days}
        setDays={setDays}
        handleRefresh={handleRefresh}
      />

      <StatsCards
        stats={stats}
        p50Duration={p50Duration}
        p95Duration={p95Duration}
        formatDuration={formatDuration}
      />

      <TrendChartCard dailyStats={dailyStats} formatDuration={formatDuration} />

      <FailureAnalysis
        failedRuns={failedRuns}
        failedStageStats={failedStageStats}
        stats={stats}
      />

      <RecentRunsTable
        recentRuns={recentRuns}
        totalRuns={stats?.totalRuns ?? 0}
        successRate={stats?.successRate ?? 0}
        formatDuration={formatDuration}
      />

      <InlineStyles />
    </div>
  );
};

export default PipelineMonitor;
