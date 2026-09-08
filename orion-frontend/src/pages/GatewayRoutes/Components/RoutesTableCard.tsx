/**
 * RoutesTableCard.tsx - 主表格卡（含 FilterBar）
 * 抽取自 index.tsx (P2-9 Phase 231)
 */
import React from 'react';
import { Card, Table } from 'antd';
import type { TableProps } from 'antd';
import { componentRadius, shadows } from '@/tokens';
import type { GatewayRoute } from '@/api/gateway-routes';
import { FilterBar } from './FilterBar';

interface Props {
  columns: TableProps<GatewayRoute>['columns'];
  dataSource: GatewayRoute[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  methodFilter?: string;
  setMethodFilter: (v?: string) => void;
  statusFilter?: string;
  setStatusFilter: (v?: string) => void;
  authFilter?: string;
  setAuthFilter: (v?: string) => void;
  serviceFilter?: string;
  setServiceFilter: (v?: string) => void;
  uniqueServices: string[];
  onClearFilters: () => void;
}

export const RoutesTableCard: React.FC<Props> = ({
  columns,
  dataSource,
  loading,
  searchQuery,
  setSearchQuery,
  methodFilter,
  setMethodFilter,
  statusFilter,
  setStatusFilter,
  authFilter,
  setAuthFilter,
  serviceFilter,
  setServiceFilter,
  uniqueServices,
  onClearFilters,
}) => (
  <Card
    style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
    styles={{ body: { padding: 0 } }}
  >
    <FilterBar
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      methodFilter={methodFilter}
      setMethodFilter={setMethodFilter}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      authFilter={authFilter}
      setAuthFilter={setAuthFilter}
      serviceFilter={serviceFilter}
      setServiceFilter={setServiceFilter}
      uniqueServices={uniqueServices}
      onClearFilters={onClearFilters}
    />
    <Table
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      rowKey="id"
      size="middle"
      scroll={{ x: 1200 }}
      pagination={{
        pageSize: 20,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '50', '100'],
        showTotal: (total) => `共 ${total} 条`,
      }}
    />
  </Card>
);
