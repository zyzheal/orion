/**
 * Webhook Management Page
 *
 * Admin page for webhook CRUD: create, edit, delete, test webhooks.
 * Uses api/webhook.ts for all data operations.
 *
 * Route: /console/webhooks
 * Access: admin, platform_admin
 *
 * 拆分自 index.tsx (P2-9 Phase 185)
 */
import { useMemo } from 'react';
import { useWebhookManagementState } from './useWebhookManagementState';
import { buildWebhookColumns, buildLogColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { WebhookTable } from './Components/WebhookTable';
import { WebhookFormModal } from './Components/WebhookFormModal';
import { LogDrawer } from './Components/LogDrawer';

const WebhookManagement = () => {
  const {
    loading,
    error,
    webhooks,
    modalVisible,
    editingWebhook,
    logDrawerVisible,
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
    closeModal,
    setLogDrawerVisible,
  } = useWebhookManagementState();

  const columns = useMemo(
    () =>
      buildWebhookColumns({
        onTest: handleTest,
        onViewLogs: handleViewLogs,
        onEdit: openEdit,
        onDelete: handleDelete,
      }),
    [handleTest, handleViewLogs, openEdit, handleDelete]
  );

  const logColumns = useMemo(() => buildLogColumns(), []);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader loading={loading} onRefresh={loadWebhooks} onCreate={openCreate} />

      <WebhookTable
        columns={columns}
        webhooks={webhooks}
        loading={loading}
        error={error}
        onRetry={loadWebhooks}
      />

      <WebhookFormModal
        form={form}
        open={modalVisible}
        editingWebhook={editingWebhook}
        onSubmit={editingWebhook ? handleUpdate : handleCreate}
        onClose={closeModal}
      />

      <LogDrawer
        open={logDrawerVisible}
        selectedWebhook={selectedWebhook}
        logs={logs}
        columns={logColumns}
        onClose={() => setLogDrawerVisible(false)}
      />
    </div>
  );
};

export default WebhookManagement;
