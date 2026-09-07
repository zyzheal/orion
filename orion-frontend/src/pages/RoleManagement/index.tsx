/**
 * Role Management Page
 * Role CRUD, permission assignment, and assigned user viewing
 *
 * 组件化重构 (P2-9 Phase 165)
 */
import { useMemo } from 'react';
import { PermissionGuard } from '@/components/PermissionGuard';
import PageSkeleton from '@/components/PageSkeleton';
import { useRoleManagementState } from './useRoleManagementState';
import { buildRoleColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { RoleListCard } from './Components/RoleListCard';
import { CreateRoleModal } from './Components/CreateRoleModal';
import { DetailDrawer } from './Components/DetailDrawer';

function RoleManagementPage() {
  const state = useRoleManagementState();
  const {
    searchQuery,
    setSearchQuery,
    createModalVisible,
    setCreateModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedRole,
    createForm,
    submitting,
    loading,
    loadData,
    filteredData,
    handleCreate,
    handleDelete,
    openDetail,
    openCreateModal,
    isInitialLoading,
  } = state;

  const columns = useMemo(
    () => buildRoleColumns({ handleDelete, openDetail }),
    [handleDelete, openDetail]
  );

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          <PageHeader loading={loading} onRefresh={loadData} onCreate={openCreateModal} />

          <RoleListCard
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            columns={columns}
            dataSource={filteredData}
            loading={loading}
          />

          <CreateRoleModal
            open={createModalVisible}
            form={createForm}
            submitting={submitting}
            onOk={handleCreate}
            onCancel={() => setCreateModalVisible(false)}
          />

          <DetailDrawer
            open={detailDrawerVisible}
            role={selectedRole}
            onClose={() => setDetailDrawerVisible(false)}
          />
        </>
      )}
    </div>
  );
}

export default () => (
  <PermissionGuard requiredRoles={['admin', 'platform_admin']} pageLevel resourceName="角色管理">
    <RoleManagementPage />
  </PermissionGuard>
);
