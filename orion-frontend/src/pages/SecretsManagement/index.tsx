/**
 * Secrets Management Page
 * Create, view, edit, and delete pipeline secrets.
 *
 * Security: Secret values are NEVER displayed in any form — only '***' masked.
 * Uses Ant Design's Password input for secret value fields.
 *
 * P2-9 Phase 124 拆分:
 * - useSecretsManagementState.tsx  状态 hook (8 useState + 2 Form.useForm + loadSecrets + 6 handlers + filteredSecrets/filterDefs useMemo)
 * - constants.tsx                  MASKED_VALUE/scopeLabelMap/scopeColorMap
 * - secretColumns.tsx              buildSecretColumns 6列
 * - Components/SecretsManagementHeader.tsx
 * - Components/SearchFilter.tsx
 * - Components/SecretsTable.tsx
 * - Components/CreateSecretModal.tsx
 * - Components/EditConfirmModal.tsx
 * - Components/EditSecretModal.tsx
 */
import React from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { PermissionGuard } from '@/components/PermissionGuard';
import { useSecretsManagementState } from './useSecretsManagementState';
import { SecretsManagementHeader } from './Components/SecretsManagementHeader';
import { SearchFilter } from './Components/SearchFilter';
import { SecretsTable } from './Components/SecretsTable';
import { CreateSecretModal } from './Components/CreateSecretModal';
import { EditConfirmModal } from './Components/EditConfirmModal';
import { EditSecretModal } from './Components/EditSecretModal';

dayjs.extend(relativeTime);

const SecretsManagementInner: React.FC = () => {
  const state = useSecretsManagementState();

  return (
    <div style={{ padding: 0 }} data-testid="secrets-management-page">
      <SecretsManagementHeader state={state} />
      <SearchFilter state={state} />
      <SecretsTable state={state} />
      <CreateSecretModal state={state} />
      <EditConfirmModal state={state} />
      <EditSecretModal state={state} />
    </div>
  );
};

export default () => (
  <PermissionGuard resource="secrets" action="read" pageLevel resourceName="Secret 管理">
    <SecretsManagementInner />
  </PermissionGuard>
);
