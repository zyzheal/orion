/**
 * Alert List Page (TASK-905)
 * - 布局编排: Header + Severity Summary + SearchFilterBar + Table + AlertDetailModal
 * - 5 文件拆分: constants.ts + useAlertListState.tsx + AlertColumns.tsx + AlertDetailModal.tsx + index.tsx
 * 抽取自 722 行原始文件 (P2-9 Phase 64)
 */
import React from 'react';
import { Typography, Button, Space, Tag, Popconfirm, Spin, Empty } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  BellOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useAlertListState } from './useAlertListState';
import { useAlertColumns } from './AlertColumns';
import { AlertDetailModal } from './AlertDetailModal';

const { Title, Text } = Typography;

const AlertList: React.FC = () => {
  const {
    canExecute,
    setSearchQuery,
    setFilters,
    loading,
    alerts,
    selectedAlert,
    detailModalVisible, setDetailModalVisible,
    selectedRowKeys, setSelectedRowKeys,
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
        {/* Page header with severity summary */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: spacing.lg,
          }}
        >
          <div>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              <BellOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
              监控告警
            </Title>
            <Text type="secondary">共 {alerts.length} 条告警记录</Text>
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
                  {severityCounts.info > 0 && (
                    <Tag color="blue">{severityCounts.info} 个提示</Tag>
                  )}
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
                  disabled={!canExecute}
                >
                  <Button icon={<CheckOutlined />} type="primary" ghost disabled={!canExecute}>
                    批量确认 ({selectedRowKeys.length})
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title={`解决 ${batchableCount} 条告警?`}
                  onConfirm={handleBatchResolve}
                  disabled={!canExecute}
                >
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

        {/* Alert detail modal */}
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
