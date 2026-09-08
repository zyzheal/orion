/**
 * SPACE Dashboard Page
 * 开发者效能五维度模型 · 基于 SPACE 框架
 *
 * P2-9 Phase 262 重构: 190 -> 30 行 (-84%), 新增:
 *   types.ts                       — SpaceMetric/SpaceData/SpaceDetailRow
 *   constants.tsx                  — SPACE_CONFIG + fetchSpaceData + getFallbackData
 *   useSpaceDashboardState.ts      — period + useQuery + loadData + buildDetailRows + columns + overallScore
 *   Components/PageHeader.tsx      — Title + Select period + Reload button
 *   Components/OverallPanel.tsx    — Progress dashboard + 5 维度 Cards
 *   Components/StatsRow.tsx        — 4 Statistic Cards
 *   Components/DetailTable.tsx     — Card + Table 指标明细
 */
import React from 'react';
import { useSpaceDashboardState } from './useSpaceDashboardState';
import { PageHeader } from './Components/PageHeader';
import { OverallPanel } from './Components/OverallPanel';
import { StatsRow } from './Components/StatsRow';
import { DetailTable } from './Components/DetailTable';

const SpaceDashboardPage: React.FC = () => {
  const { period, setPeriod, data, loading, loadData, buildDetailRows, columns, overallScore } =
    useSpaceDashboardState();

  if (!data) return null;

  return (
    <div style={{ padding: 24 }}>
      <PageHeader period={period} setPeriod={setPeriod} loading={loading} loadData={loadData} />
      <OverallPanel overallScore={overallScore} />
      <StatsRow data={data} />
      <DetailTable rows={buildDetailRows} columns={columns} loading={loading} />
    </div>
  );
};

export default SpaceDashboardPage;
