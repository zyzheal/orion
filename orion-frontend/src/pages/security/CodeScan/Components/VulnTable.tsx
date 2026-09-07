/**
 * CodeScan vulnerability findings table
 */
import React from 'react';
import { Card, Empty, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { VulnFinding } from '../types';

interface VulnTableProps {
  dataSource: VulnFinding[];
  columns: ColumnsType<VulnFinding>;
  loading: boolean;
}

export const VulnTable: React.FC<VulnTableProps> = ({ dataSource, columns, loading }) => (
  <Card title="漏洞发现列表">
    <Table
      dataSource={dataSource}
      columns={columns}
      rowKey="id"
      loading={loading}
      size="small"
      pagination={{ pageSize: 8, showSizeChanger: false }}
      locale={{ emptyText: <Empty description="暂无漏洞发现，请先执行代码扫描" /> }}
    />
  </Card>
);
