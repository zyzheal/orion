/**
 * RDM current-tab table
 */
import React from 'react';
import { Empty } from 'antd';
import type { TableColumn } from '@/components/Table';
import TableWrapper from '@/components/Table';

interface RDMTableProps {
  dataSource: Record<string, unknown>[];
  columns: TableColumn[];
  loading: boolean;
}

export const RDMTable: React.FC<RDMTableProps> = ({ dataSource, columns, loading }) => (
  <TableWrapper
    dataSource={dataSource}
    columns={columns}
    rowKey="id"
    loading={loading}
    locale={{ emptyText: <Empty description="暂无数据" /> }}
    pagination={{ pageSize: 20, showTotal: (t: number) => `共 ${t} 条` } as any}
  />
);
