/**
 * Workflow Trigger Management Page
 *
 * Admin page for workflow trigger CRUD: create, edit, delete, enable/disable triggers.
 * Uses api/workflow-trigger.ts for all data operations.
 *
 * Route: /console/triggers
 * Access: admin, platform_admin
 *
 * 拆分为: useWorkflowTriggerState + workflowTriggerColumns + Components/*
 * 参考: P2-9 Phase 131
 */
import React from 'react';
import DataState from '@/components/DataState';
import { useWorkflowTriggerState } from './useWorkflowTriggerState';
import { WorkflowTriggersHeader } from './Components/WorkflowTriggersHeader';
import { WorkflowTriggersTable } from './Components/WorkflowTriggersTable';
import { CreateEditModal } from './Components/CreateEditModal';

const WorkflowTriggers: React.FC = () => {
  const state = useWorkflowTriggerState();

  return (
    <div style={{ padding: 0 }}>
      <WorkflowTriggersHeader
        loading={state.loading}
        loadTriggers={state.loadTriggers}
        openCreate={state.openCreate}
      />

      <DataState
        loading={state.loading && state.triggers.length === 0}
        error={state.error}
        empty={state.triggers.length === 0 && !state.loading}
        emptyText="暂无触发器"
        loadingText="加载触发器..."
        retry={state.loadTriggers}
      >
        <WorkflowTriggersTable
          triggers={state.triggers}
          loading={state.loading}
          workflows={state.workflows}
          page={state.page}
          pageSize={state.pageSize}
          total={state.total}
          setPage={state.setPage}
          setPageSize={state.setPageSize}
          handleToggle={state.handleToggle}
          openEdit={state.openEdit}
          handleDelete={state.handleDelete}
        />
      </DataState>

      <CreateEditModal
        open={state.modalVisible}
        submitting={state.submitting}
        editingTrigger={state.editingTrigger}
        workflows={state.workflows}
        form={state.form}
        onCancel={() => {
          state.setModalVisible(false);
          state.setEditingTrigger(null);
        }}
        handleCreate={state.handleCreate}
        handleUpdate={state.handleUpdate}
      />
    </div>
  );
};

export default WorkflowTriggers;
