/**
 * ServiceCatalog catalog tab content
 */
import React from 'react';
import { Empty, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ServiceCatalog } from '@/api/service-catalog';

interface CatalogTabProps {
  columns: ColumnsType<ServiceCatalog>;
  dataSource: ServiceCatalog[];
  loading: boolean;
}

export const CatalogTab: React.FC<CatalogTabProps> = ({
  columns,
  dataSource,
  loading,
}) => (
  <div style={{ padding: '0 16px 16px' }}>
    <Table<ServiceCatalog>
      columns={columns}
      dataSource={dataSource}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 项` }}
      locale={{ emptyText: <Empty description="暂无服务目录数据" /> }}
      scroll={{ x: 900 }}
    />
  </div>
);
