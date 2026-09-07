/**
 * Traffic Governance Page
 *
 * Manages canary deployments and traffic splitting rules.
 * Supports create/edit/delete traffic rules, real-time metrics display.
 *
 * Phase 6.12 - Task 6.12
 * Split into components (P2-9 Phase 157):
 * - types.ts / constants.ts / columns.tsx / useTrafficGovernanceState.ts
 * - Components/{TrafficGovernanceHeader,StatsCards,TrafficTable,TrafficRuleModal}.tsx
 */
import React, { useMemo } from 'react';
import { spacing } from '@/tokens';
import { useTrafficGovernanceState } from './useTrafficGovernanceState';
import { buildColumns } from './columns';
import { TrafficGovernanceHeader } from './Components/TrafficGovernanceHeader';
import { StatsCards } from './Components/StatsCards';
import { TrafficTable } from './Components/TrafficTable';
import { TrafficRuleModal } from './Components/TrafficRuleModal';

const TrafficGovernance: React.FC = () => {
  const state = useTrafficGovernanceState();
  const columns = useMemo(
    () =>
      buildColumns({
        handlePromote: state.handlePromote,
        handleRollback: state.handleRollback,
        handleEdit: state.handleEdit,
        handleDelete: state.handleDelete,
      }),
    [state.handlePromote, state.handleRollback, state.handleEdit, state.handleDelete],
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <TrafficGovernanceHeader />
      <StatsCards stats={state.stats} />
      <TrafficTable
        columns={columns}
        dataSource={state.trafficRules}
        loading={state.loading}
        onCreate={state.handleCreate}
      />
      <TrafficRuleModal
        open={state.modalVisible}
        isEdit={Boolean(state.editingRule)}
        form={state.form}
        submitting={state.submitting}
        onOk={state.handleSubmit}
        onCancel={() => state.setModalVisible(false)}
      />
    </div>
  );
};

export default TrafficGovernance;
