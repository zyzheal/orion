/**
 * AI Dashboard Page
 * AI 能力平台入口 + 场景健康统计 + 4 域聚合数据 + 5 功能入口卡
 *
 * 拆分自 index.tsx (P2-9 Phase 224)
 * - useAIDashboardState.ts: state + loadHealth + loadAggregateStats + derived
 * - Components/PageHeader.tsx: 标题
 * - Components/HealthStatsRow.tsx: 3 张场景健康统计卡
 * - Components/AggregateStatsRow.tsx: 4 张聚合数据卡 + Alert 重试
 * - Components/CategoryCards.tsx: 5 个 AI 功能入口卡
 * - Components/HealthStatusGrid.tsx: 场景健康状态网格
 * - index.tsx: 组合层
 */
import { Spin } from 'antd';
import { spacing } from '@/tokens';
import { useAIDashboardState } from './useAIDashboardState';
import { PageHeader } from './Components/PageHeader';
import { HealthStatsRow } from './Components/HealthStatsRow';
import { AggregateStatsRow } from './Components/AggregateStatsRow';
import { CategoryCards } from './Components/CategoryCards';
import { HealthStatusGrid } from './Components/HealthStatusGrid';

const AIDashboard = () => {
  const {
    healthData,
    loading,
    aggregateStats,
    aggregateLoading,
    aggregateError,
    healthyCount,
    totalRequests,
    avgLatency,
    loadAggregateStats,
    handleNavigate,
  } = useAIDashboardState();

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />

      <HealthStatsRow
        healthyCount={healthyCount}
        totalScenarios={healthData.length}
        totalRequests={totalRequests}
        avgLatency={avgLatency}
      />

      <AggregateStatsRow
        stats={aggregateStats}
        loading={aggregateLoading}
        error={aggregateError}
        onRetry={loadAggregateStats}
      />

      <CategoryCards onNavigate={handleNavigate} />

      <HealthStatusGrid healthData={healthData} />

      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      )}
    </div>
  );
};

export default AIDashboard;
