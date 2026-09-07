/**
 * Pipeline Audit Log Page
 * Pipeline execution audit trail for forensic analysis
 *
 * 拆分自 index.tsx (P2-9 Phase 186)
 */
import { useMemo } from 'react';
import { Table } from 'antd';
import { useAuditLogsState } from './useAuditLogsState';
import { buildLogColumns } from './columns';
import { PAGE_SIZE } from './constants';
import { PageHeader } from './Components/PageHeader';
import { FilterForm } from './Components/FilterForm';
import { DetailModal } from './Components/DetailModal';

const AuditLogsPage = () => {
  const {
    loading,
    logs,
    total,
    page,
    detailVisible,
    selectedLog,
    trail,
    retentionDays,
    form,
    loadLogs,
    setPage,
    setRetentionDays,
    handleSearch,
    handleReset,
    handleViewDetail,
    handleCleanup,
    closeDetail,
  } = useAuditLogsState();

  const columns = useMemo(() => buildLogColumns(handleViewDetail), [handleViewDetail]);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        loading={loading}
        retentionDays={retentionDays}
        onRetentionChange={setRetentionDays}
        onCleanup={handleCleanup}
        onRefresh={loadLogs}
      />

      <FilterForm form={form} onSearch={handleSearch} onReset={handleReset} />

      <Table
        columns={columns}
        dataSource={logs}
        loading={loading}
        rowKey="id"
        size="middle"
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          onChange: (p) => setPage(p),
        }}
      />

      <DetailModal
        open={detailVisible}
        selectedLog={selectedLog}
        trail={trail}
        onClose={closeDetail}
      />
    </div>
  );
};

export default AuditLogsPage;
