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
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Popconfirm,
} from 'antd';
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import type { Alert } from '@/types/pages';
import { useAlertListState } from './useAlertListState';
import { useAlertColumns } from './AlertColumns';
import { AlertDetailModal } from './AlertDetailModal';

const { Title, Text } = Typography;

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
      {/* Page header with severity summary */}
      <div
        style={
          {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: spacing.lg,
          } as React.CSSProperties
        }
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BellOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            监控告警
          </Title>
          <Text type="secondary">共 {alerts.length} 条告警记录</Text>
          {/* Active alert summary */}
          {(severityCounts.critical > 0 || severityCounts.warning > 0) && (
            <div style={{ marginTop: spacing.sm }}>
              <Space size={12}>
                {severityCounts.critical > 0 && (
                  <Tag color="red" style={{ fontWeight: 600 }}>
                    {severityCounts.critical} 个严重告警
                  </Tag>
                )}
                {severityCounts.warning > 0 && (
                  <Tag color="orange">{severityCounts.warning} 个警告</Tag>
                )}
                {severityCounts.info > 0 && <Tag color="blue">{severityCounts.info} 个提示</Tag>}
              </Space>
            </div>
          )}
        </div>
        <Space>
          {selectedRowKeys.length > 0 && (
            <>
              <Popconfirm
                title={`确认 ${selectedRowKeys.length} 条告警?`}
                onConfirm={handleBatchAcknowledge}
              >
                <Button icon={<CheckOutlined />} type="primary" ghost>
                  批量确认 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
              <Popconfirm title={`解决 ${batchableCount} 条告警?`} onConfirm={handleBatchResolve}>
                <Button danger icon={<CloseOutlined />}>
                  批量解决
                </Button>
              </Popconfirm>
            </>
          )}
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Search and filter bar */}
      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索指标名称、来源、消息..."
        />
      </div>

      {/* Alert table */}
      <Table
        columns={columns}
        dataSource={filteredAlerts}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        rowSelection={rowSelection}
      />

      {/* Alert detail modal */}
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
