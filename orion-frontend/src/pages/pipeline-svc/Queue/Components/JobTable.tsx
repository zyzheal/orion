/**
 * JobTable - 任务列表表格
 * 抽取自 index.tsx (P2-9 Phase 105)
 */
import React, { useMemo } from 'react';
import { Card } from 'antd';
import Table from '@/components/Table';
import type { QueueState } from '../useQueueState';
import { buildQueueColumns } from '../columns';

interface JobTableProps {
  state: QueueState;
}

export const JobTable: React.FC<JobTableProps> = ({ state }) => {
  const columns = useMemo(
    () =>
      buildQueueColumns({
        openDetail: state.openDetail,
        handleComplete: state.handleComplete,
        handleFail: state.handleFail,
      }),
    [state.openDetail, state.handleComplete, state.handleFail]
  );

  return (
    <Card>
      <Table
        columns={columns}
        dataSource={state.filteredJobs}
        loading={state.loading}
        rowKey="id"
        size="middle"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total: number) => `共 ${total} 个任务`,
        }}
      />
    </Card>
  );
};
