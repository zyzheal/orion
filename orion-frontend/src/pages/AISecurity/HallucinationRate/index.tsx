/**
 * AI Hallucination Rate Monitoring Page
 * Tracks LLM hallucination rate, false positives, model drift, and quality scores
 * 组件化重构 (P2-9 Phase 265): 168->33行, 6 文件拆分
 */
import React from 'react';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import { useHallucinationRateState } from './useHallucinationRateState';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { RecordsTable } from './Components/RecordsTable';

const HallucinationRatePage: React.FC = () => {
  const state = useHallucinationRateState();
  const {
    period, setPeriod, records, loading, loadData,
    total, rate, avgConfidence, criticalCount, columns,
  } = state;

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader period={period} setPeriod={setPeriod} loading={loading} loadData={loadData} />
      {loading ? (
        <PageSkeleton rows={6} />
      ) : (
        <>
          <StatsRow total={total} rate={rate} avgConfidence={avgConfidence} criticalCount={criticalCount} />
          <RecordsTable records={records} columns={columns} loading={loading} />
        </>
      )}
    </div>
  );
};

export default HallucinationRatePage;
