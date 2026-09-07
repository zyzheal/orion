/**
 * EnvProfile Management Page
 * Environment-specific configuration profiles with variable resolution
 * 组件化重构 (P2-9 Phase 178): 427→103 行
 */
import React from 'react';
import { Table, Empty } from 'antd';
import { useEnvProfilesState } from './useEnvProfilesState';
import { buildEnvColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { EditModal } from './Components/EditModal';
import { ResolveModal } from './Components/ResolveModal';
import { EnvironmentListModal } from './Components/EnvironmentListModal';

const EnvProfilesPage: React.FC = () => {
  const {
    data,
    loading,
    loadData,
    modalVisible,
    setModalVisible,
    editingItem,
    resolveVisible,
    setResolveVisible,
    resolveResult,
    selectedProfile,
    setSelectedProfile,
    submitting,
    resolving,
    environments,
    envLoading,
    envError,
    form,
    resolveForm,
    handleCreate,
    handleEdit,
    handleDelete,
    handleViewEnvironments,
    handleSubmit,
    handleResolve,
    handleResolveOpen,
  } = useEnvProfilesState();

  const columns = buildEnvColumns({
    handleEdit,
    handleDelete,
    handleViewEnvironments,
    handleResolveOpen,
    envLoading,
    selectedProfileId: selectedProfile?.id ?? null,
  });

  return (
    <div style={{ padding: 0 }}>
      <PageHeader onCreate={handleCreate} onRefresh={loadData} loading={loading} />

      <Table
        columns={columns}
        dataSource={data ?? []}
        loading={loading}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="暂无环境配置，点击「创建配置」添加" /> }}
      />

      <EditModal
        form={form}
        open={modalVisible}
        submitting={submitting}
        editingItem={editingItem}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />

      <ResolveModal
        form={resolveForm}
        open={resolveVisible}
        resolving={resolving}
        selectedProfile={selectedProfile}
        result={resolveResult}
        onClose={() => setResolveVisible(false)}
        onSubmit={handleResolve}
      />

      <EnvironmentListModal
        selectedProfile={selectedProfile}
        environments={environments}
        envLoading={envLoading}
        envError={envError}
        onClose={() => setSelectedProfile(null)}
        onRetry={() => {
          if (selectedProfile) handleViewEnvironments(selectedProfile);
        }}
      />
    </div>
  );
};

export default EnvProfilesPage;
