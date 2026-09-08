/**
 * Pipeline Version History Page
 * 版本历史记录与对比,支持版本回滚、基线标记、版本对比。
 *
 * 样式已统一为 Design Token 规范。
 *
 * 拆分自 index.tsx (P2-9 Phase 227)
 * - usePipelineVersionHistoryState.ts: state + loadVersions + handleRollback/handleSetBaseline/handleDiff/handleSelectionChange
 * - columns.tsx: buildVersionColumns 7 列 version/change_summary/tags/is_baseline/created_at/created_by/actions
 * - Components/PageHeader.tsx: 标题 + 版本对比 + 刷新按钮
 * - index.tsx: 组合层
 */
import React, { useMemo } from 'react';
import { Empty } from 'antd';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import CardPanel from '@/components/CardPanel';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { usePipelineVersionHistoryState } from './usePipelineVersionHistoryState';
import { buildVersionColumns } from './columns';
import { PageHeader } from './Components/PageHeader';

dayjs.extend(relativeTime);

const PipelineVersionHistory: React.FC = () => {
  const {
    versions,
    loading,
    selectedRowKeys,
    loadVersions,
    handleRollback,
    handleSetBaseline,
    handleDiff,
    handleSelectionChange,
  } = usePipelineVersionHistoryState();

  const columns = useMemo(
    () => buildVersionColumns({ onRollback: handleRollback, onSetBaseline: handleSetBaseline }),
    [handleRollback, handleSetBaseline]
  );

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        versionCount={versions.length}
        selectedCount={selectedRowKeys.length}
        loading={loading}
        onDiff={() => {
          void handleDiff();
        }}
        onRefresh={() => {
          void loadVersions();
        }}
      />

      <CardPanel>
        {versions.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: spacing.xxl }}>
            <Empty description="暂无版本记录" />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={versions}
            loading={loading}
            rowKey="id"
            size="middle"
            striped
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys,
              onChange: handleSelectionChange,
            }}
          />
        )}
      </CardPanel>
    </div>
  );
};

export default PipelineVersionHistory;
