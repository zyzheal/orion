/**
 * EfficacyMetrics - 效能度量中心
 * 拆分自 index.tsx (P2-9 Phase 212)
 * - useEfficacyMetricsState.ts: state + loadData + helpers
 * - Components/PageHeader.tsx: title + description
 * - Components/ScoreRingCard.tsx: score ring + text info card
 * - Components/DomainCards.tsx: 6 domain cards grid
 * - index.tsx: loading + composition + trend chart
 */
import { Card, Spin } from 'antd';
import { colors, spacing } from '@/tokens';
import TrendChart from '@/components/EfficacyMetrics/TrendChart';
import { useEfficacyMetricsState } from './useEfficacyMetricsState';
import { PageHeader } from './Components/PageHeader';
import { ScoreRingCard } from './Components/ScoreRingCard';
import { DomainCards } from './Components/DomainCards';

const trendSeries = [
  { name: '工程域', dataKey: 'engineering', color: colors.purple[500] },
  { name: '端到端', dataKey: 'e2e', color: colors.primary[500] },
  { name: '管理域', dataKey: 'management', color: colors.success[500] },
  { name: '合规域', dataKey: 'compliance', color: colors.warning[500] },
  { name: 'AI 提效', dataKey: 'aiEfficiency', color: colors.info[500] },
  { name: '风险', dataKey: 'risk', color: colors.error[500] },
];

const EfficacyMetrics = () => {
  const {
    loading,
    domainScores,
    trendData,
    e2eMetrics,
    engMetrics,
    aiMetrics,
    mgmtMetrics,
    riskMetrics,
  } = useEfficacyMetricsState();

  if (loading) {
    return (
      <div style={{ padding: spacing.lg, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />

      <ScoreRingCard domainScores={domainScores} />

      <DomainCards
        domainScores={domainScores}
        e2eMetrics={e2eMetrics}
        engMetrics={engMetrics}
        aiMetrics={aiMetrics}
        mgmtMetrics={mgmtMetrics}
        riskMetrics={riskMetrics}
      />

      {trendData.length > 0 && (
        <Card>
          <TrendChart data={trendData} series={trendSeries} loading={loading} height={300} />
        </Card>
      )}
    </div>
  );
};

export default EfficacyMetrics;
