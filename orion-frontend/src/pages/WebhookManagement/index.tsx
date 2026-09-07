import { PermissionGuard } from '@/components/PermissionGuard';
/**
 * Webhook Management Page
 * 组件化重构 (P2-9 Phase 172): 425→87 行
 */
import { useMemo } from 'react';
import { PageHeader } from './Components/PageHeader';
import { WebhookTable } from './Components/WebhookTable';
import { WebhookModal } from './Components/WebhookModal';
import { LogDrawer } from './Components/LogDrawer';
import { buildColumns, buildLogColumns } from './columns';
import { useWebhookManagementState } from './useWebhookManagementState';

const WebhookManagement = () => {
  const {
    webhooks,
    loading,
    errorState,
    modalVisible,
    setModalVisible,
    editingWebhook,
    setEditingWebhook,
    submitting,
    logDrawerVisible,
    setLogDrawerVisible,
    selectedWebhook,
    logs,
    form,
    loadWebhooks,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleTest,
    handleViewLogs,
    openEdit,
    openCreate,
  } = useWebhookManagementState();

  const columns = useMemo(
    () => buildColumns({ handleTest, handleViewLogs, openEdit, handleDelete }),
    [handleTest, handleViewLogs, openEdit, handleDelete]
  );

  const logColumns = useMemo(() => buildLogColumns(), []);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader loading={loading} onRefresh={loadWebhooks} onCreate={openCreate} />

      <WebhookTable
        columns={columns}
        dataSource={webhooks}
        loading={loading}
        error={errorState}
        onRetry={loadWebhooks}
      />

      <WebhookModal
        open={modalVisible}
        isEdit={!!editingWebhook}
        form={form}
        submitting={submitting}
        onOk={() => form.submit()}
        onCancel={() => {
          setModalVisible(false);
          setEditingWebhook(null);
        }}
        onFinish={editingWebhook ? handleUpdate : handleCreate}
      />

      <LogDrawer
        open={logDrawerVisible}
        title={selectedWebhook?.url ?? ''}
        onClose={() => setLogDrawerVisible(false)}
        logColumns={logColumns}
        logs={logs}
      />
    </div>
  );
};

export default () => (
  <PermissionGuard
    requiredRoles={['admin', 'platform_admin']}
    pageLevel
    resourceName="Webhook 管理"
  >
    <WebhookManagement />
  </PermissionGuard>
);
