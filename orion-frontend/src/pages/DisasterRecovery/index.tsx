/**
 * Disaster Recovery Management Page (P4-04)
 * RTO/RPO 配置、灾备演练历史、灾备策略管理
 *
 * Features:
 * - 4 stats cards (RTO/RPO target, last drill, DR coverage)
 * - RTO/RPO configuration table with status indicators
 * - Disaster drill history (last 5)
 * - DR strategy info (Descriptions)
 * - Create DR plan Modal
 *
 * 主入口 (P2-9 Phase 100 refactor: 已抽取 constants / useDisasterRecoveryState /
 * columns / Components/StatsCards / Components/StrategyInfo / Components/CreatePlanModal)
 * P2-9 Phase 286: 162->68 行 (-58%), 新增 Components/{PageHeader,MiddleRow}.tsx
 */
import React, { useMemo } from 'react';
import { spacing } from '@/tokens';
import { useDisasterRecoveryState } from './useDisasterRecoveryState';
import { buildRtoRpoColumns, buildDrillColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsCards } from './Components/StatsCards';
import { MiddleRow } from './Components/MiddleRow';
import { StrategyInfo } from './Components/StrategyInfo';
import { CreatePlanModal } from './Components/CreatePlanModal';

const DisasterRecovery: React.FC = () => {
  const state = useDisasterRecoveryState();

  const rtoRpoColumns = useMemo(
    () =>
      buildRtoRpoColumns({
        rtoRpoRecords: state.rtoRpoRecords,
        selectedRecordId: state.selectedRecordId,
        testingType: state.testingType,
        handleTest: state.handleTest,
      }),
    [state.rtoRpoRecords, state.selectedRecordId, state.testingType, state.handleTest],
  );

  const drillColumns = useMemo(() => buildDrillColumns(), []);

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />

      <StatsCards
        rtoTarget={state.rtoTarget}
        rpoTarget={state.rpoTarget}
        lastDrill={state.lastDrill}
        coverage={state.coverage}
      />

      <MiddleRow state={state} rtoRpoColumns={rtoRpoColumns} drillColumns={drillColumns} />

      <StrategyInfo />

      <CreatePlanModal
        open={state.createModalOpen}
        onCancel={() => state.setCreateModalOpen(false)}
        onOk={state.handleCreate}
        confirmLoading={state.loading}
        createForm={state.createForm}
      />
    </div>
  );
};

export default DisasterRecovery;
