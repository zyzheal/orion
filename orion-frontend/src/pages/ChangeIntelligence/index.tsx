/**
 * Change Intelligence Page
 * Reports list with risk scores, analysis trigger form, report detail with blast radius visualization
 *
 * P2-9 Phase 119 拆分:
 * - useChangeIntelligenceState.tsx  状态 hook (10 useState + 1 Form + loadData + handleAnalyze + handleViewDetail)
 * - changeColumns.tsx               8 列 + 5 列受影响服务 + riskLevelColor + FILTER_DEFS
 * - Components/ChangeIntelligenceHeader.tsx
 * - Components/ChangeIntelligenceStatsRow.tsx
 * - Components/ChangeIntelligenceTable.tsx
 * - Components/ChangeIntelligenceModals.tsx  (2 Modal)
 */
import React from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useChangeIntelligenceState } from './useChangeIntelligenceState';
import { ChangeIntelligenceHeader } from './Components/ChangeIntelligenceHeader';
import { ChangeIntelligenceStatsRow } from './Components/ChangeIntelligenceStatsRow';
import { ChangeIntelligenceTable } from './Components/ChangeIntelligenceTable';
import { ChangeIntelligenceModals } from './Components/ChangeIntelligenceModals';

dayjs.extend(relativeTime);

const ChangeIntelligence: React.FC = () => {
  const state = useChangeIntelligenceState();

  return (
    <div style={{ padding: 0 }}>
      <ChangeIntelligenceHeader state={state} />
      <ChangeIntelligenceStatsRow state={state} />
      <ChangeIntelligenceTable state={state} />
      <ChangeIntelligenceModals state={state} />
    </div>
  );
};

export default ChangeIntelligence;
