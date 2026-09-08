/**
 * APK Upload History Page
 * View and manage APK upload history records
 *
 * 拆分自 index.tsx (P2-9 Phase 215)
 * - useApkUploadHistoryState.ts: state + loaders + displayStats
 * - columns.tsx: buildApkUploadColumns 7 cols
 * - Components/PageHeader.tsx: title + description
 * - Components/StatsRow.tsx: 4 statistics cards
 * - Components/RecentFailures.tsx: recent failures list
 * - Components/FilterBar.tsx: market/status filters
 * - index.tsx: composition
 */
import { Card, Table, Empty } from 'antd';
import { spacing } from '@/tokens';
import { useApkUploadHistoryState } from './useApkUploadHistoryState';
import { buildApkUploadColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { RecentFailures } from './Components/RecentFailures';
import { FilterBar } from './Components/FilterBar';

const ApkUploadHistoryPage = () => {
  const {
    loading,
    records,
    total,
    recentFailures,
    displayStats,
    filters,
    setFilters,
    pagination,
    loadHistory,
    loadRecentFailures,
    handleTableChange,
  } = useApkUploadHistoryState();

  const columns = buildApkUploadColumns();

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />

      <StatsRow stats={displayStats} />

      <RecentFailures recentFailures={recentFailures} onRefresh={loadRecentFailures} />

      <FilterBar filters={filters} onFiltersChange={setFilters} onRefresh={loadHistory} />

      <Card>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条记录`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: records.length === 0 ? <Empty description="暂无上传记录" /> : undefined,
          }}
        />
      </Card>
    </div>
  );
};

export default ApkUploadHistoryPage;
