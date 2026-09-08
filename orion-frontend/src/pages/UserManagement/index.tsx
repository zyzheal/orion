/**
 * User Management Page
 * List, create, edit, enable/disable users, role assignment, and detail view
 *
 * 主入口 (P2-9 Phase 97 refactor: 已抽取 constants / useUserManagementState / columns / StatsPanel / DetailItems)
 * P2-9 Phase 279: 170->62 行 (-64%), 新增 Components/{PageHeader,ModalsBundle}.tsx + filterDefs 迁入 constants.ts
 */
import React, { useMemo } from 'react';
import { Card } from 'antd';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import { spacing } from '@/tokens';
import { PermissionGuard } from '@/components/PermissionGuard';
import { filterDefs } from './constants';
import { makeUserColumns } from './columns';
import { StatsPanel } from './Components/StatsPanel';
import { PageHeader } from './Components/PageHeader';
import { UserManagementModalsBundle } from './Components/ModalsBundle';
import { useUserManagementState } from './useUserManagementState';

const UserManagement: React.FC = () => {
  const s = useUserManagementState();

  const columns = useMemo(
    () =>
      makeUserColumns({
        handleDelete: s.handleDelete,
        handleDisable: s.handleDisable,
        handleEnable: s.handleEnable,
        openDetail: s.openDetail,
        openEdit: s.openEdit,
        onResetPassword: (u) => {
          s.setSelectedUser(u);
          s.setChangePwModalVisible(true);
        },
      }),
    [s.handleDelete, s.handleDisable, s.handleEnable, s.openDetail, s.openEdit, s.setSelectedUser, s.setChangePwModalVisible],
  );

  if (s.isInitialLoading) {
    return <PageSkeleton cards={4} rows={8} />;
  }

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        loading={s.loading}
        onRefresh={s.loadData}
        onCreateClick={() => s.setCreateModalVisible(true)}
      />

      <StatsPanel stats={s.stats} />

      <Card>
        <div style={{ marginBottom: spacing.md }}>
          <SearchFilterBar
            onSearch={s.setSearchQuery}
            onFilter={s.setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索用户名、邮箱或姓名..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={s.filteredData}
          loading={s.loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      <UserManagementModalsBundle s={s} />
    </div>
  );
};

export default () => (
  <PermissionGuard requiredRoles={['admin', 'platform_admin']} pageLevel resourceName="用户管理">
    <UserManagement />
  </PermissionGuard>
);
