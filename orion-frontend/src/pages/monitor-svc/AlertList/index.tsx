/**
 * Alert List Page (TASK-905)
 * Alert listing with severity filters, alert detail, and acknowledge/resolve actions.
 *
 * Features:
 * - Table with alert data (severity, metric, value, threshold, status, time)
 * - Severity-based color coding
 * - Acknowledge/resolve action buttons
 * - Status filtering
 * - AI explanation for selected alert (TR-01)
 *
 * P2-9 Phase 53 重构:
 * - 全部 state + loadAlerts + 7 handlers + 4 memos 抽入 useAlertListState.ts
 * - 表格列配置抽入 AlertColumns.tsx (useAlertColumns hook)
 * - 详情 Modal (含 AI 解释面板) 抽入 AlertDetailModal.tsx
 * - 主页面仅保留 layout + header + SearchFilterBar + Table + rowSelection
 * P2-9 Phase 290: 180->117 行 (-35%), 新增 Components/PageHeader.tsx
 */
import React from 'react';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import type { Alert } from '@/types/pages';
import { useAlertListState } from './useAlertListState';
import { useAlertColumns } from './AlertColumns';
import { AlertDetailModal } from './AlertDetailModal';
import { PageHeader } from './Components/PageHeader';

const AlertList: React.FC = () => {
  const state = useAlertListState();
  const {
    setSearchQuery,
    setFilters,
    loading,
    alerts,
    selectedAlert,
    detailModalVisible,
    setDetailModalVisible,
    selectedRowKeys,
    setSelectedRowKeys,
    explaining,
    explanation,
    filteredAlerts,
    filterDefs,
    severityCounts,
    batchableCount,
    handleExplain,
    handleAcknowledge,
    handleResolve,
    handleRefresh,
    handleBatchAcknowledge,
    handleBatchResolve,
    showDetail,
  } = state;

  // Row selection config (kept in main page; UI-level)
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    getCheckboxProps: (record: Alert) => ({
      disabled: record.status === 'resolved' || record.status === 'suppressed',
    }),
  };

  // Columns (useMemo hook with handlers + explaining flag)
  const columns = useAlertColumns(
    { handleAcknowledge, handleResolve, handleExplain, showDetail },
    explaining,
  );

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        alertsCount={alerts.length}
        severityCounts={severityCounts}
        selectedRowKeysCount={selectedRowKeys.length}
        batchableCount={batchableCount}
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

      <Table
        columns={columns}
        dataSource={filteredAlerts}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        rowSelection={rowSelection}
      />

      <AlertDetailModal
        detailModalVisible={detailModalVisible}
        setDetailModalVisible={setDetailModalVisible}
        selectedAlert={selectedAlert}
        explaining={explaining}
        explanation={explanation}
        handleAcknowledge={handleAcknowledge}
        handleResolve={handleResolve}
        handleExplain={handleExplain}
      />
    </div>
  );
};

export default AlertList;
