/**
 * Cron Management Page
 *
 * Admin page for scheduled job CRUD: create, edit, delete, execute cron jobs.
 * Uses api/cron.ts for all data operations.
 *
 * Route: /console/cron
 * Access: admin, platform_admin
 *
 * 拆分自 index.tsx (P2-9 Phase 193)
 */
import { useMemo } from 'react';
import { PermissionGuard } from '@/components/PermissionGuard';
import DataState from '@/components/DataState';
import { useCronManagementState } from './useCronManagementState';
import { buildColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { CronTable } from './Components/CronTable';
import { CronFormModal } from './Components/CronFormModal';

const CronManagement = () => {
  const {
    loading,
    error,
    jobs,
    stats,
    modalVisible,
    editingJob,
    form,
    loadJobs,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleExecute,
    openEdit,
    openCreate,
    closeModal,
  } = useCronManagementState();

  const columns = useMemo(
    () => buildColumns({ onExecute: handleExecute, onEdit: openEdit, onDelete: handleDelete }),
    [handleExecute, openEdit, handleDelete]
  );

  return (
    <div style={{ padding: 0 }}>
      <PageHeader loading={loading} onRefresh={loadJobs} onCreate={openCreate} />

      <DataState
        loading={loading && jobs.length === 0}
        error={error}
        empty={jobs.length === 0 && !loading}
        emptyText="暂无定时任务"
        loadingText="加载定时任务..."
        retry={loadJobs}
      >
        <StatsRow stats={stats} />
        <CronTable columns={columns} jobs={jobs} loading={loading} />
      </DataState>

      <CronFormModal
        form={form}
        open={modalVisible}
        editingJob={editingJob}
        onSubmit={editingJob ? handleUpdate : handleCreate}
        onClose={closeModal}
      />
    </div>
  );
};

export default () => (
  <PermissionGuard
    requiredRoles={['admin', 'platform_admin']}
    pageLevel
    resourceName="定时任务管理"
  >
    <CronManagement />
  </PermissionGuard>
);
