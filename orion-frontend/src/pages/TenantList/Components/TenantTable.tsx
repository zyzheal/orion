/**
 * TenantTable - 租户列表表格
 * 抽取自 index.tsx (P2-9 Phase 109)
 */
import React, { useMemo } from 'react';
import { Card, Table, Button, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { buildTenantColumns } from '../columns';
import type { TenantEntity } from '@/api/tenant';
import type { TenantListState } from '../useTenantListState';

interface TenantTableProps {
  state: TenantListState;
}

export const TenantTable: React.FC<TenantTableProps> = ({ state }) => {
  const columns = useMemo(
    () =>
      buildTenantColumns({
        handleSwitchTenant: state.handleSwitchTenant,
        handleOpenEditModal: state.handleOpenEditModal,
        handleOpenUserModal: state.handleOpenUserModal,
        handleDelete: state.handleDelete,
      }),
    [
      state.handleSwitchTenant,
      state.handleOpenEditModal,
      state.handleOpenUserModal,
      state.handleDelete,
    ]
  );

  const dataSource = state.searchText || state.statusFilter ? state.filteredTenants : state.tenants;

  return (
    <Card>
      <Table<TenantEntity>
        dataSource={dataSource}
        loading={state.loading}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: state.selectedRowKeys,
          onChange: (keys: React.Key[]) => state.setSelectedRowKeys(keys),
          preserveSelectedRowKeys: true,
        }}
        pagination={{
          current: state.page,
          pageSize: state.pageSize,
          total: state.searchText || state.statusFilter ? state.filteredTenants.length : state.total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 个租户`,
          onChange: (p, ps) => {
            state.setPage(p);
            state.setPageSize(ps);
          },
        }}
        columns={columns}
        locale={
          {
            emptyText: (
              <Empty description="暂无租户" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => state.setCreateModalOpen(true)}
                >
                  创建第一个租户
                </Button>
              </Empty>
            ),
          }
        }
      />
    </Card>
  );
};
