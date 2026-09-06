/**
 * User Management Page
 * List, create, edit, enable/disable users, role assignment, and detail view
 *
 * 主入口 (P2-9 Phase 97 refactor: 已抽取 constants / useUserManagementState / columns / StatsPanel / DetailItems)
 */
import React, { useMemo } from 'react';
import { PermissionGuard } from '@/components/PermissionGuard';
import { Typography, Button, Space, Card } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { UserManagementModals } from './UserManagementModals';
import { roleOptions } from './constants';
import { makeUserColumns } from './columns';
import { StatsPanel } from './Components/StatsPanel';
import { DetailItems } from './Components/DetailItems';
import { useUserManagementState } from './useUserManagementState';

const { Title, Text } = Typography;

const filterDefs: FilterDefinition[] = [
  {
    key: 'role',
    label: '角色',
    options: [
      { label: '全部', value: 'all' },
      { label: '管理员', value: 'admin' },
      { label: '开发者', value: 'developer' },
      { label: '经理', value: 'manager' },
      { label: '观察者', value: 'viewer' },
      { label: '普通用户', value: 'user' },
    ],
  },
  {
    key: 'status',
    label: '状态',
    options: [
      { label: '全部', value: 'all' },
      { label: '已启用', value: 'active' },
      { label: '已禁用', value: 'inactive' },
      { label: '已锁定', value: 'locked' },
    ],
  },
];

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

  const detailItems = <DetailItems selectedUser={s.selectedUser} />;

  if (s.isInitialLoading) {
    return (
      <div style={{ padding: 0 }}>
        <PageSkeleton cards={4} rows={8} />
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <UserOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            用户管理
          </Title>
          <Text type="secondary">管理系统用户、角色分配和账户状态</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={s.loadData} loading={s.loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => s.setCreateModalVisible(true)}
          >
            创建用户
          </Button>
        </Space>
      </div>

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

      <UserManagementModals
        createModalVisible={s.createModalVisible}
        setCreateModalVisible={s.setCreateModalVisible}
        editModalVisible={s.editModalVisible}
        setEditModalVisible={s.setEditModalVisible}
        editingUser={s.editingUser}
        setEditingUser={s.setEditingUser}
        detailDrawerVisible={s.detailDrawerVisible}
        setDetailDrawerVisible={s.setDetailDrawerVisible}
        selectedUser={s.selectedUser}
        setSelectedUser={s.setSelectedUser}
        changePwModalVisible={s.changePwModalVisible}
        setChangePwModalVisible={s.setChangePwModalVisible}
        createForm={s.createForm}
        editForm={s.editForm}
        changePwForm={s.changePwForm}
        submitting={s.submitting}
        setSubmitting={s.setSubmitting}
        handleCreate={s.handleCreate}
        handleEdit={s.handleEdit}
        handleChangePassword={s.handleChangePassword}
        handleEnable={s.handleEnable}
        handleDisable={s.handleDisable}
        openEdit={s.openEdit}
        roleOptions={roleOptions}
        detailItems={detailItems}
      />
    </div>
  );
};

export default () => (
  <PermissionGuard requiredRoles={['admin', 'platform_admin']} pageLevel resourceName="用户管理">
    <UserManagement />
  </PermissionGuard>
);
