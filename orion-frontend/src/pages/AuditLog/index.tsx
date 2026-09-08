/**
 * Audit Log Page
 * Immutable audit chain viewing and integrity verification
 *
 * 拆分自 index.tsx (P2-9 Phase 208)
 * - useAuditLogState.ts: state + loadData + handlers
 * - columns.tsx: buildAuditLogColumns
 * - Components/PageHeader.tsx: title + 3 buttons
 * - Components/SummaryCards.tsx: 4 stat cards + chain hash info card
 * - Components/DetailDrawer.tsx: detail drawer
 */
import { Card, Table } from 'antd';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuditLogState } from './useAuditLogState';
import { buildAuditLogColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { SummaryCards } from './Components/SummaryCards';
import { DetailDrawer } from './Components/DetailDrawer';

const AuditLogPage = () => {
  const {
    loading,
    auditLogs,
    chainInfo,
    storageStats,
    selectedLog,
    drawerOpen,
    loadData,
    handleVerify,
    handleGenerateReport,
    handleViewDetail,
    handleCloseDrawer,
  } = useAuditLogState();

  const columns = buildAuditLogColumns(handleViewDetail);
  const tableData = auditLogs.map((log) => ({ ...log, key: log.id }));
  const isInitialLoading = loading && auditLogs.length === 0;

  return (
    <DashboardLayout>
      {isInitialLoading ? (
        <div style={{ padding: spacing.lg }}>
          <PageSkeleton cards={3} rows={10} />
        </div>
      ) : (
        <div style={{ padding: spacing.lg }}>
          <PageHeader
            loading={loading}
            onRefresh={loadData}
            onVerify={handleVerify}
            onGenerateReport={handleGenerateReport}
          />

          <SummaryCards chainInfo={chainInfo} storageStats={storageStats} />

          <Card title="审计日志列表">
            <Table
              columns={columns}
              dataSource={tableData}
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>

          <DetailDrawer open={drawerOpen} selectedLog={selectedLog} onClose={handleCloseDrawer} />
        </div>
      )}
    </DashboardLayout>
  );
};

export default AuditLogPage;
