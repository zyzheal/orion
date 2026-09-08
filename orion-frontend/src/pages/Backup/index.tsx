/**
 * Backup Management Page
 * 数据备份与恢复管理
 * 8 文件拆分: types.ts + constants.tsx + useBackupState.ts + BackupColumns.tsx + ExpandedRow.tsx + index.tsx
 * 抽取自 705 行原始文件 (P2-9 Phase 68)
 *
 * P2-9 Phase 258 重构: 284 -> 50 行 (-82%), 新增:
 *   Components/PageHeader.tsx       — Title + Space (Reload/Create buttons)
 *   Components/StatsCards.tsx       — 4 MetricCards (total/successful/failed/lastBackupTime)
 *   Components/PlanTable.tsx        — Card + SearchFilterBar + Table with expandable rows
 *   Components/CreateModal.tsx      — 创建备份计划 Modal (name/type/retentionDays/schedule)
 *   Components/RestoreModal.tsx     — 确认恢复 Modal (Alert + selectedRecord detail)
 */
import React from 'react';
import { Form } from 'antd';
import { useBackupState } from './useBackupState';
import { useBackupColumns } from './BackupColumns';
import { PageHeader } from './Components/PageHeader';
import { StatsCards } from './Components/StatsCards';
import { PlanTable } from './Components/PlanTable';
import { CreateModal } from './Components/CreateModal';
import { RestoreModal } from './Components/RestoreModal';

const BackupManagement: React.FC = () => {
  const state = useBackupState();
  const {
    loading, stats, setSearchQuery, setFilters,
    createModalVisible, setCreateModalVisible,
    restoreModalVisible, setRestoreModalVisible,
    selectedRecord, submitting,
    loadData, loadStats,
    handleCreate, handleExecute, handleDeletePlan,
    handleDeleteRecord, handleRestore, openRestore,
    expandedRecords,
  } = state;

  const [createForm] = Form.useForm();

  const columns = useBackupColumns({
    handleExecute, handleDeletePlan,
    toggleRecords: state.toggleRecords,
    expandedRecords, submitting,
  });

  // Form wrapper: validateFields + delegate to hook handler
  const handleCreateWrapper = async () => {
    try {
      const values = await createForm.validateFields();
      await handleCreate(values);
      createForm.resetFields();
    } catch {
      // validation error - do nothing
    }
  };

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        loading={loading}
        onLoad={() => {
          loadData();
          loadStats();
        }}
        onOpenCreate={() => setCreateModalVisible(true)}
      />
      <StatsCards stats={stats} />
      <PlanTable state={state} columns={columns} />
      <CreateModal
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreateWrapper}
        confirmLoading={submitting}
        createForm={createForm}
      />
      <RestoreModal
        open={restoreModalVisible}
        onCancel={() => setRestoreModalVisible(false)}
        onOk={handleRestore}
        confirmLoading={submitting}
        selectedRecord={selectedRecord}
      />
    </div>
  );
};

export default BackupManagement;
