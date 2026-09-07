/**
 * APK Credentials Management Page
 * Manage app market upload credentials for APK upload tasks.
 *
 * Credentials are stored as encrypted secrets with naming convention:
 * - apk-huawei-credentials
 * - apk-xiaomi-credentials
 * - etc.
 *
 * 拆分自原单文件 (P2-9 Phase 137)
 */
import React from 'react';
import { spacing } from '@/tokens';
import { useApkCredentialsState } from './useApkCredentialsState';
import { ApkCredentialsHeader } from './Components/ApkCredentialsHeader';
import { SecurityAlert } from './Components/SecurityAlert';
import { CredentialsTableCard } from './Components/CredentialsTableCard';
import { QuickAddRow } from './Components/QuickAddRow';
import { CreateCredentialModal } from './Components/CreateCredentialModal';
import { EditCredentialModal } from './Components/EditCredentialModal';

const ApkCredentialsManagement: React.FC = () => {
  const state = useApkCredentialsState();

  const marketDisabledInCreate =
    !!state.credentials.find((c) => c.market === state.selectedMarket);

  return (
    <div style={{ padding: spacing.lg }}>
      <ApkCredentialsHeader onAdd={() => state.openCreateModal()} />
      <SecurityAlert />
      <CredentialsTableCard
        credentials={state.credentials}
        loading={state.loading}
        openEditModal={state.openEditModal}
        handleDelete={state.handleDelete}
      />
      <QuickAddRow unconfiguredMarkets={state.unconfiguredMarkets} onAdd={state.openCreateModal} />

      <CreateCredentialModal
        open={state.createModalVisible}
        submitting={state.submitting}
        selectedMarket={state.selectedMarket}
        onMarketChange={state.setSelectedMarket}
        marketDisabled={marketDisabledInCreate}
        form={state.form}
        onOk={state.handleCreate}
        onCancel={() => state.setCreateModalVisible(false)}
      />

      <EditCredentialModal
        open={state.editModalVisible}
        submitting={state.submitting}
        selectedMarket={state.selectedMarket}
        onMarketChange={state.setSelectedMarket}
        editingMarket={state.editingCredential?.market || ''}
        form={state.form}
        onOk={state.handleUpdate}
        onCancel={state.closeEditModal}
      />
    </div>
  );
};

export default ApkCredentialsManagement;
