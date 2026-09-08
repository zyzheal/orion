/**
 * Cron Jobs Management Page
 *
 * Phase 2.3: Standalone cron job management UI
 *
 * 拆分自 index.tsx (P2-9 Phase 195)
 */
import { useMemo } from 'react';
import { Table } from 'antd';
import { spacing } from '@/tokens';
import { useCronJobsState } from './useCronJobsState';
import { buildColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { CronFormModal } from './Components/CronFormModal';

const CronJobsPage = () => {
  const {
    loading,
    modalVisible,
    editingJob,
    submitting,
    jobs,
    stats,
    form,
    handleCreate,
    handleEdit,
    handleDelete,
    handleExecute,
    openCreate,
    closeCreate,
  } = useCronJobsState();

  const columns = useMemo(
    () => buildColumns({ onEdit: handleEdit, onExecute: handleExecute, onDelete: handleDelete }),
    [handleEdit, handleExecute, handleDelete]
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader onCreate={openCreate} />
      <StatsRow stats={stats} />
      <Table
        columns={columns}
        dataSource={jobs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1000 }}
      />
      <CronFormModal
        form={form}
        open={modalVisible}
        editingJob={editingJob}
        submitting={submitting}
        onSubmit={handleCreate}
        onClose={closeCreate}
      />
    </div>
  );
};

export default CronJobsPage;
