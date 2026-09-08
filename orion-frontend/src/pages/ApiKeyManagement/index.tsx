/**
 * API Key Management Page
 *
 * Admin page for API key CRUD: create, revoke, view stats.
 * Uses api/api-key.ts for all data operations.
 *
 * Route: /console/api-keys
 * Access: admin, platform_admin
 *
 * 拆分自 index.tsx (P2-9 Phase 204)
 * - types.ts: ApiKeyDashboardData
 * - useApiKeyManagementState.ts: state + queries + handlers
 * - columns.tsx: 表格列定义
 * - Components/PageHeader.tsx: 标题+刷新+新建
 * - Components/StatsRow.tsx: 3 张统计卡片
 * - Components/KeysTable.tsx: 密钥列表
 * - Components/CreateKeyModal.tsx: 新建 Key 弹窗 (含创建后 key 展示)
 */
import { useMemo } from 'react';
import { PermissionGuard } from '@/components/PermissionGuard';
import { DataState } from '@/components/DataState';
import { useApiKeyManagementState } from './useApiKeyManagementState';
import { buildColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { KeysTable } from './Components/KeysTable';
import { CreateKeyModal } from './Components/CreateKeyModal';

const ApiKeyManagement = () => {
  const {
    isLoading,
    isError,
    error,
    keys,
    stats,
    modalVisible,
    setModalVisible,
    createdKey,
    form,
    loadData,
    handleCreate,
    handleRevoke,
    copyKey,
    openCreate,
  } = useApiKeyManagementState();

  const columns = useMemo(
    () => buildColumns({ onCopyKey: copyKey, onRevoke: handleRevoke }),
    [copyKey, handleRevoke]
  );

  return (
    <div style={{ padding: 0 }}>
      <PageHeader loading={isLoading} onRefresh={loadData} onCreate={openCreate} />

      <DataState
        loading={isLoading && keys.length === 0}
        error={isError ? (error as Error | null) : null}
        empty={keys.length === 0 && !isLoading}
        emptyText="暂无 API Key"
        loadingText="加载 API Key..."
        retry={() => loadData()}
      >
        {stats && <StatsRow total={stats.total} active={stats.active} expired={stats.expired} />}

        <KeysTable keys={keys} columns={columns} loading={isLoading} />
      </DataState>

      <CreateKeyModal
        open={modalVisible}
        form={form}
        createdKey={createdKey}
        onCopyKey={copyKey}
        onSubmit={handleCreate as any}
        onCancel={() => setModalVisible(false)}
      />
    </div>
  );
};

export default () => (
  <PermissionGuard
    requiredRoles={ ['admin', 'platform_admin'] }
    pageLevel
    resourceName="API 密钥管理"
  >
    <ApiKeyManagement />
  </PermissionGuard>
);
