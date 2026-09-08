/**
 * Automation — 自动化作业与工具库管理页面
 *
 * FE-02: 自动化作业管理 (AutoJob CRUD + 执行 + 历史)
 *
 * 拆分结构（P2-9 Phase 32 + Phase 236）:
 * - useAutomationState.ts: 全部状态 + loadJobs + 7 个 CRUD/执行/历史处理器 + filteredJobs/stats
 * - constants.tsx: 作业/执行类型/状态颜色标签映射 + JOB_TYPE_OPTIONS/JOB_STATUS_OPTIONS + parseJSON/formatShortDate
 * - JobTableColumns.tsx: 8 列表格配置 Hook
 * - ExecutionHistoryColumns.tsx: 6 列执行历史表格配置
 * - StatsBar.tsx: 4 项统计条
 * - JobModal.tsx: 新建/编辑作业 Modal
 * - ExecutionHistoryDrawer.tsx: 执行历史 Drawer
 * - Components/PageHeader.tsx: 页面标题 + 刷新按钮
 * - Components/JobListCard.tsx: 作业列表卡（含筛选 toolbar + 空状态 + Table）
 * - index.tsx: 组合层
 */
import React from 'react';
import { spacing } from '@/tokens';
import { useAutomationState } from './useAutomationState';
import { useJobTableColumns } from './JobTableColumns';
import { StatsBar } from './StatsBar';
import { JobModal } from './JobModal';
import { ExecutionHistoryDrawer } from './ExecutionHistoryDrawer';
import { PageHeader } from './Components/PageHeader';
import { JobListCard } from './Components/JobListCard';

const Automation: React.FC = () => {
  const {
    loading,
    saving,
    executing,
    togglingId,
    searchText,
    setSearchText,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    modalOpen,
    setModalOpen,
    editingJob,
    drawerOpen,
    setDrawerOpen,
    currentJob,
    executions,
    execLoading,
    filteredJobs,
    stats,
    loadJobs,
    handleOpenCreate,
    handleOpenEdit,
    handleSave,
    handleDelete,
    handleToggle,
    handleExecute,
    handleViewExecutions,
  } = useAutomationState();

  const columns = useJobTableColumns({
    executing,
    togglingId,
    handleToggle,
    handleExecute,
    handleViewExecutions,
    handleOpenEdit,
    handleDelete,
  });

  return (
    <div style={{ padding: 0 }}>
      <PageHeader loading={loading} onRefresh={loadJobs} />

      <StatsBar stats={stats} />

      <JobListCard
        columns={columns}
        filteredJobs={filteredJobs}
        loading={loading}
        searchText={searchText}
        setSearchText={setSearchText}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onCreate={handleOpenCreate}
      />

      <JobModal
        open={modalOpen}
        editingJob={editingJob}
        saving={saving}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
      />

      <ExecutionHistoryDrawer
        open={drawerOpen}
        currentJob={currentJob}
        executions={executions}
        execLoading={execLoading}
        onClose={() => setDrawerOpen(false)}
        onRefresh={handleViewExecutions}
      />
    </div>
  );
};

export default Automation;
