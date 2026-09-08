/**
 * Queue Tasks Management Page
 *
 * Phase 2.3: Standalone queue task monitoring UI
 *
 * 拆分自 index.tsx (P2-9 Phase 209)
 * - useQueueTasksState.ts: state + useQuery jobs/stats + handlers
 * - columns.tsx: buildQueueColumns
 * - Components/PageHeader.tsx: title + filter + enqueue button
 * - Components/StatsRow.tsx: 4 stat cards
 * - Components/EnqueueModal.tsx: modal + form
 */
import { Table } from 'antd';
import { spacing } from '@/tokens';
import { useQueueTasksState } from './useQueueTasksState';
import { buildQueueColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { EnqueueModal } from './Components/EnqueueModal';

const QueueTasksPage = () => {
  const {
    modalVisible,
    submitting,
    filterStatus,
    setFilterStatus,
    form,
    jobs,
    loading,
    stats,
    handleEnqueue,
    handleComplete,
    handleFail,
    openEnqueueModal,
    closeEnqueueModal,
  } = useQueueTasksState();

  const columns = buildQueueColumns(handleComplete, handleFail);

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        onOpenEnqueue={openEnqueueModal}
      />

      <StatsRow stats={stats} />

      <Table
        columns={columns}
        dataSource={jobs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 900 }}
      />

      <EnqueueModal
        open={modalVisible}
        submitting={submitting}
        form={form}
        onCancel={closeEnqueueModal}
        onSubmit={() => form.submit()}
        onFinish={handleEnqueue}
      />
    </div>
  );
};

export default QueueTasksPage;
