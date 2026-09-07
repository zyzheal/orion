/**
 * Tenant List Page
 * Admin view: create, manage, and switch between tenants
 *
 * 主入口 (P2-9 Phase 109 refactor: 已抽取 types/constants/columns/hook/Components)
 */
import React from 'react';
import { spacing } from '@/tokens';
import { useTenantListState } from './useTenantListState';
import { QUOTA_TEMPLATES } from './constants';
import { TenantListModals } from './TenantListModals';
import { Header } from './Components/Header';
import { SearchFilterPanel } from './Components/SearchFilterPanel';
import { TenantTable } from './Components/TenantTable';

const TenantListPage: React.FC<{ onTenantSelect?: (tenantId: string) => void }> = ({
  onTenantSelect,
}) => {
  const state = useTenantListState({ onTenantSelect });

  return (
    <div style={{ padding: spacing.lg }}>
      <Header state={state} />
      <SearchFilterPanel state={state} />
      <TenantTable state={state} />
      <TenantListModals
        createModalOpen={state.createModalOpen}
        setCreateModalOpen={state.setCreateModalOpen}
        editModalOpen={state.editModalOpen}
        setEditModalOpen={state.setEditModalOpen}
        editingTenant={state.editingTenant}
        setEditingTenant={state.setEditingTenant}
        submitting={state.submitting}
        createForm={state.createForm}
        editForm={state.editForm}
        handleCreate={state.handleCreate}
        handleEdit={state.handleEdit}
        selectedTemplate={state.selectedTemplate}
        setSelectedTemplate={state.setSelectedTemplate}
        userModalOpen={state.userModalOpen}
        setUserModalOpen={state.setUserModalOpen}
        userModalTenant={state.userModalTenant}
        users={state.users}
        usersLoading={state.usersLoading}
        QUOTA_TEMPLATES={QUOTA_TEMPLATES}
        setUserModalTenant={state.setUserModalTenant}
        setUsers={state.setUsers}
      />
    </div>
  );
};

export default TenantListPage;
