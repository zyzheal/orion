/**
 * ServiceCatalog SLA breaches tab content
 */
import React from 'react';
import { Empty, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SLABreach } from '@/api/service-catalog';

interface SLATabProps {
  columns: ColumnsType<SLABreach>;
  dataSource: SLABreach[];
  loading: boolean;
}

export const SLATab: React.FC<SLATabProps> = ({ columns, dataSource, loading }) => (
  <div style={{ padding: '0 16px 16px' }}>
    <Table<SLABreach>
      columns={columns}
      dataSource={dataSource}
      rowKey="requestId"
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      locale={{ emptyText: <Empty description="暂无 SLA 违规记录" /> }}
      scroll={{ x: 900 }}
    />
  </div>
);
