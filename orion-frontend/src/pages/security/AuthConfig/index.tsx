/**
 * Auth Configuration Page (H1.1 认证授权)
 * OAuth2/OIDC/MFA/SSO provider management and authentication policy configuration
 *
 * 拆分自 index.tsx (P2-9 Phase 203)
 */
import { useMemo } from 'react';
import { spacing } from '@/tokens';
import { useAuthConfigState } from './useAuthConfigState';
import { buildPolicyColumns, buildProviderColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { ProvidersCard } from './Components/ProvidersCard';
import { PoliciesCard } from './Components/PoliciesCard';
import { CreateProviderModal } from './Components/CreateProviderModal';

const AuthConfigPage = () => {
  const {
    loading,
    providers,
    policies,
    totalUsers,
    activeProviders,
    createModalOpen,
    creating,
    createForm,
    refetch,
    setCreateModalOpen,
    handleCreateSubmit,
    closeCreate,
  } = useAuthConfigState();

  const providerColumns = useMemo(() => buildProviderColumns(), []);
  const policyColumns = useMemo(() => buildPolicyColumns(), []);

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />
      <StatsRow
        totalProviders={providers.length}
        activeProviders={activeProviders}
        totalUsers={totalUsers}
        policyCount={policies.length}
      />
      <ProvidersCard
        providers={providers}
        columns={providerColumns}
        loading={loading}
        onRefresh={refetch}
        onCreate={() => setCreateModalOpen(true)}
      />
      <PoliciesCard policies={policies} columns={policyColumns} loading={loading} />
      <CreateProviderModal
        open={createModalOpen}
        creating={creating}
        form={createForm}
        onOk={handleCreateSubmit}
        onCancel={closeCreate}
      />
    </div>
  );
};

export default AuthConfigPage;
