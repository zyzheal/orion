/**
 * RunsList - 左侧 Pipeline Run 列表
 * 抽取自 PipelineRetryRollback.tsx (P2-9 Phase 111)
 */
import React, { useMemo } from 'react';
import { Card, Table, Select, Button, Empty } from 'antd';
import type { PipelineRunItem } from '../types';
import { buildRetryColumns } from '../retryColumns';
import type { PipelineRetryRollbackState } from '../usePipelineRetryRollbackState';

const { Option } = Select;

interface RunsListProps {
  state: PipelineRetryRollbackState;
}

export const RunsList: React.FC<RunsListProps> = ({ state }) => {
  const columns = useMemo(
    () =>
      buildRetryColumns({
        handleRetry: state.handleRetry,
        handleRollback: state.handleRollback,
        handleCancel: state.handleCancel,
      }),
    [state.handleRetry, state.handleRollback, state.handleCancel]
  );

  return (
    <Card
      title="Pipeline Run 列表"
      bordered={false}
      extra={
        <Select
          value={state.statusFilter}
          onChange={state.setStatusFilter}
          style={{ width: 140 }}
          size="small"
        >
          <Option value="all">全部状态</Option>
          <Option value="success">成功</Option>
          <Option value="failed">失败</Option>
          <Option value="running">运行中</Option>
        </Select>
      }
    >
      {state.filteredRuns.length > 0 ? (
        <Table<PipelineRunItem>
          columns={columns}
          dataSource={state.filteredRuns}
          rowKey="id"
          rowSelection={{
            type: 'radio',
            selectedRowKeys: state.selectedRun ? [state.selectedRun.id] : [],
            onChange: (_keys, records) => {
              if (records.length > 0) state.setSelectedRun(records[0]);
            },
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="middle"
        />
      ) : (
        <Empty description="暂无匹配的 Pipeline Run 记录">
          <Button type="primary" onClick={() => state.setStatusFilter('all')}>
            显示全部
          </Button>
        </Empty>
      )}
    </Card>
  );
};
