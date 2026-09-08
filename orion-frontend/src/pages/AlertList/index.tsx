/**
 * Alert List Page (TASK-905)
 * - 布局编排: Header + Severity Summary + SearchFilterBar + Table + AlertDetailModal
 * - 5 文件拆分: constants.ts + useAlertListState.tsx + AlertColumns.tsx + AlertDetailModal.tsx + index.tsx
 * 抽取自 722 行原始文件 (P2-9 Phase 64)
 * P2-9 Phase 288: 165->108 行 (-35%), 新增 Components/PageHeader.tsx
 */
import React from 'react';
import { Spin, Empty } from 'antd';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useAlertListState } from './useAlertListState';
import { useAlertColumns } from './AlertColumns';
import { AlertDetailModal } from './AlertDetailModal';
import { PageHeader } from './Components/PageHeader';

const AlertList: React.FC = () => {
  const {
    canExecute,
    setSearchQuery,
    setFilters,
    loading,
    alerts,
    selectedAlert,
    detailModalVisible,
    setDetailModalVisible,
    selectedRowKeys,
    setSelectedRowKeys,
    filteredAlerts,
    filterDefs,
    severityCounts,
    batchableCount,
    handleAcknowledge,
    handleResolve,
    handleAIExplain,
    handleRefresh,
    handleBatchAcknowledge,
    handleBatchResolve,
    showDetail,
  } = useAlertListState();

  const columns = useAlertColumns({
    showDetail,
    handleAcknowledge,
    handleResolve,
    handleAIExplain,
  });

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    getCheckboxProps: (record: any) => ({
      disabled: record.status === 'resolved' || record.status === 'suppressed',
    }),
  };

  return (
    <div style={{ padding: 0 }}>
      <Spin spinning={loading}>
        <PageHeader
          alertsCount={alerts.length}
          severityCounts={severityCounts}
          selectedRowKeysCount={selectedRowKeys.length}
          batchableCount={batchableCount}
          canExecute={canExecute}
          loading={loading}
          onBatchAcknowledge={handleBatchAcknowledge}
          onBatchResolve={handleBatchResolve}
          onRefresh={handleRefresh}
        />

        <div style={{ marginBottom: spacing.md }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索指标名称、来源、消息..."
          />
        </div>

        {filteredAlerts.length > 0 ? (
          <Table
            columns={columns}
            dataSource={filteredAlerts}
            loading={loading}
            rowKey="id"
            size="middle"
            striped
            rowSelection={rowSelection}
          />
        ) : (
          !loading && <Empty description="暂无告警数据" />
        )}

        <AlertDetailModal
          open={detailModalVisible}
          alert={selectedAlert}
          onClose={() => setDetailModalVisible(false)}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
        />
      </Spin>
    </div>
  );
};

export default AlertList;
