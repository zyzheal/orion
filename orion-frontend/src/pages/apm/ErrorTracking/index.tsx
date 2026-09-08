/**
 * APM Error Tracking Page (Phase 3.5.3)
 * Application error collection, stack trace display, trend analysis
 * - Fixed: "View Detail" button now opens Modal with trace details
 * - Added: service filter, error trend visualization
 *
 * 拆分自 index.tsx (P2-9 Phase 223)
 * - useApmErrorTrackingState.ts: state + useQuery + services + errorTrend memo
 * - ErrorColumns.tsx: 7 列表格列定义
 * - Components/PageHeader.tsx: 标题 + 服务筛选 + 刷新
 * - Components/ErrorTrendCard.tsx: 错误时间分布图
 * - Components/TraceDetailModal.tsx: Trace 详情 Modal
 * - index.tsx: 组合层
 */
import { Card, Spin, Table } from 'antd';
import { spacing } from '@/tokens';
import { useApmErrorTrackingState } from './useApmErrorTrackingState';
import { buildErrorColumns } from './ErrorColumns';
import { PageHeader } from './Components/PageHeader';
import { ErrorTrendCard } from './Components/ErrorTrendCard';
import { TraceDetailModal } from './Components/TraceDetailModal';

const ApmErrorTrackingPage = () => {
  const {
    serviceFilter,
    setServiceFilter,
    detailModalOpen,
    selectedTrace,
    loading,
    errors,
    services,
    errorTrend,
    refetch,
    handleViewDetail,
    closeDetailModal,
  } = useApmErrorTrackingState();

  const errorColumns = buildErrorColumns({ onViewDetail: handleViewDetail });

  return (
    <Spin spinning={loading}>
      <div style={{ padding: spacing.lg }}>
        <PageHeader
          loading={loading}
          errorCount={errors.length}
          services={services}
          serviceFilter={serviceFilter}
          setServiceFilter={setServiceFilter}
          onRefresh={() => {
            void refetch();
          }}
        />

        <ErrorTrendCard trend={errorTrend} />

        <Card title={`错误列表 (${errors.length})`}>
          <Table
            columns={errorColumns}
            dataSource={errors}
            rowKey="traceId"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
            }}
            size="small"
            locale={{ emptyText: '暂无错误，系统运行良好！' }}
          />
        </Card>

        <TraceDetailModal open={detailModalOpen} trace={selectedTrace} onClose={closeDetailModal} />
      </div>
    </Spin>
  );
};

export default ApmErrorTrackingPage;
