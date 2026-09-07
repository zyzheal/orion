/**
 * PR Trigger rules table
 */
import React from 'react';
import { Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { PRTriggerRule } from '@/api/prTriggers';

interface PRTriggerTableProps {
  columns: ColumnsType<PRTriggerRule>;
  dataSource: PRTriggerRule[];
  loading: boolean;
}

export const PRTriggerTable: React.FC<PRTriggerTableProps> = ({
  columns,
  dataSource,
  loading,
}) => (
  <Card>
    <Table<PRTriggerRule>
      columns={columns}
      dataSource={dataSource}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 10, showSizeChanger: true }}
    />
  </Card>
);
