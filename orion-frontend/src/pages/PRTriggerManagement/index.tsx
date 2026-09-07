/**
 * PR/MR Trigger Management Page
 * Manage Pull Request / Merge Request trigger rules for pipelines
 * with path filtering, branch filtering, and status callback configuration.
 *
 * Split into components (P2-9 Phase 153):
 * - types.ts / constants.ts / columns.tsx / usePRTriggerManagementState.ts
 * - Components/{PRTriggerManagementHeader,StatsRow,PRTriggerTable,PRTriggerModal}.tsx
 */
import React, { useMemo } from 'react';
import { usePRTriggerManagementState } from './usePRTriggerManagementState';
import { buildPRTriggerColumns } from './columns';
import { PRTriggerManagementHeader } from './Components/PRTriggerManagementHeader';
import { StatsRow } from './Components/StatsRow';
import { PRTriggerTable } from './Components/PRTriggerTable';
import { PRTriggerModal } from './Components/PRTriggerModal';

const PRTriggerManagement: React.FC = () => {
  const state = usePRTriggerManagementState();

  const columns = useMemo(
    () =>
      buildPRTriggerColumns({
        pipelines: state.pipelines,
        handleEdit: state.handleEdit,
        handleDelete: state.handleDelete,
        handleToggle: state.handleToggle,
      }),
    [state.pipelines, state.handleEdit, state.handleDelete, state.handleToggle],
  );

  return (
    <div style={{ padding: 0 }}>
      <PRTriggerManagementHeader
        onRefresh={state.loadData}
        onCreate={() => state.setModalVisible(true)}
        loading={state.loading}
      />
      <StatsRow rules={state.rules} />
      <PRTriggerTable columns={columns} dataSource={state.rules} loading={state.loading} />
      <PRTriggerModal
        open={state.modalVisible}
        editingRule={state.editingRule}
        form={state.form}
        pipelines={state.pipelines}
        prConfig={state.prConfig}
        onPrConfigChange={state.setPrConfig}
        onOk={state.handleModalOk}
        onCancel={state.handleModalClose}
      />
    </div>
  );
};

export default PRTriggerManagement;
