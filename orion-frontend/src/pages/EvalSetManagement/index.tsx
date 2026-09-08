/**
 * EvalSet Management Page (TR-05)
 * - 布局编排: Header + StatsRow + EvalSets Card + EvalRuns Card + CreateModal + DetailModal
 * 抽取自 740 行原始文件 (P2-9 Phase 60)
 * P2-9 Phase 282: 165->44 行 (-73%), 新增 Components/{PageHeader,EvalSetsCard,EvalRunsCard,ModalsBundle}.tsx
 */
import React from 'react';
import { spacing } from '@/tokens';
import { useEvalSetState } from './useEvalSetState';
import { useEvalSetColumns, useRunColumns } from './EvalSetColumns';
import { EvalSetStatsRow } from './EvalSetStatsRow';
import { PageHeader } from './Components/PageHeader';
import { EvalSetsCard } from './Components/EvalSetsCard';
import { EvalRunsCard } from './Components/EvalRunsCard';
import { EvalSetModalsBundle } from './Components/ModalsBundle';

const EvalSetManagement: React.FC = () => {
  const s = useEvalSetState();

  const setColumns = useEvalSetColumns({
    runLoading: s.runLoading,
    handleViewSet: s.handleViewSet,
    handleRunEval: s.handleRunEval,
    handleDeleteSet: s.handleDeleteSet,
  });
  const runColumns = useRunColumns();

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />
      <EvalSetStatsRow sets={s.sets} runs={s.runs} />
      <EvalSetsCard
        sets={s.sets}
        setColumns={setColumns}
        loading={s.loading}
        seeding={s.seeding}
        onSeed={s.handleSeed}
        onRefresh={() => s.refetch()}
        onCreate={() => s.setCreateModalOpen(true)}
      />
      <EvalRunsCard
        runs={s.runs}
        runColumns={runColumns}
        selectedRuns={s.selectedRuns}
        setSelectedRuns={s.setSelectedRuns}
        loading={s.loading}
        exporting={s.exporting}
        onExport={s.handleExportReport}
        onCompare={s.handleCompare}
      />
      <EvalSetModalsBundle s={s} />
    </div>
  );
};

export default EvalSetManagement;
