/**
 * Configuration Management Page
 * GitOps, config approval, diff analysis, and drift detection
 * 组件化重构 (P2-9 Phase 174): 439→120 行
 */
import React from 'react';
import { Tabs, Space } from 'antd';
import {
  FileTextOutlined,
  DiffOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { PermissionGuard } from '@/components/PermissionGuard';
import { useConfigManagementState } from './useConfigManagementState';
import { buildConfigColumns } from './columns';
import { buildConfigSelectOptions } from './config';
import { ConfigCreateModal, ConfigDetailDrawer } from './ConfigModals';
import { OverviewTab } from './OverviewTab';
import { DiffTab } from './DiffTab';
import { DriftTab } from './DriftTab';
import { PageHeader } from './Components/PageHeader';

const ConfigManagementPage: React.FC = () => {
  const state = useConfigManagementState();
  const {
    configs,
    gitOpsConfig,
    loading,
    form,
    selectedConfig,
    createModalOpen,
    setCreateModalOpen,
    editingConfig,
    submitting,
    detailDrawerOpen,
    setDetailDrawerOpen,
    activeTab,
    setActiveTab,
    sourceEnv,
    setSourceEnv,
    targetEnv,
    setTargetEnv,
    envDiffLoading,
    envDiffResult,
    versionDiffConfigId,
    setVersionDiffConfigId,
    versionA,
    setVersionA,
    versionB,
    setVersionB,
    versionDiffLoading,
    versionDiffResult,
    reportLoading,
    diffReport,
    driftLoading,
    driftResult,
    loadData,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSync,
    handleApproval,
    handleEnvCompare,
    handleVersionCompare,
    handleGenerateReport,
    handleDriftDetect,
    handleModalClose,
    openViewDetail,
  } = state;

  const columns = buildConfigColumns({
    onEdit: handleEdit,
    onDelete: handleDelete,
    onApproval: handleApproval,
    onViewDetail: openViewDetail,
  });

  const configSelectOptions = buildConfigSelectOptions(configs);

  const tabItems = [
    {
      key: 'overview',
      label: (
        <Space>
          <FileTextOutlined />
          配置概览
        </Space>
      ),
      children: (
        <OverviewTab
          configs={configs}
          gitOpsConfig={gitOpsConfig}
          loading={loading}
          columns={columns}
        />
      ),
    },
    {
      key: 'diff',
      label: (
        <Space>
          <DiffOutlined />
          差异对比
        </Space>
      ),
      children: (
        <DiffTab
          sourceEnv={sourceEnv}
          targetEnv={targetEnv}
          onSourceEnvChange={setSourceEnv}
          onTargetEnvChange={setTargetEnv}
          envDiffLoading={envDiffLoading}
          envDiffResult={envDiffResult}
          onEnvCompare={handleEnvCompare}
          versionDiffConfigId={versionDiffConfigId}
          versionA={versionA}
          versionB={versionB}
          onVersionDiffConfigIdChange={setVersionDiffConfigId}
          onVersionAChange={setVersionA}
          onVersionBChange={setVersionB}
          versionDiffLoading={versionDiffLoading}
          versionDiffResult={versionDiffResult}
          onVersionCompare={handleVersionCompare}
          configSelectOptions={configSelectOptions}
          reportLoading={reportLoading}
          diffReport={diffReport}
          onGenerateReport={handleGenerateReport}
        />
      ),
    },
    {
      key: 'drift',
      label: (
        <Space>
          <ScanOutlined />
          漂移检测
        </Space>
      ),
      children: (
        <DriftTab
          driftLoading={driftLoading}
          driftResult={driftResult}
          onDriftDetect={handleDriftDetect}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg, background: colors.neutral[0], minHeight: '100vh' }}>
      <PageHeader
        loading={loading}
        driftLoading={driftLoading}
        onRefresh={loadData}
        onSync={handleSync}
        onDriftDetect={handleDriftDetect}
        onCreate={() => setCreateModalOpen(true)}
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />

      <ConfigCreateModal
        open={createModalOpen}
        editingConfig={editingConfig}
        submitting={submitting}
        form={form}
        onCreate={handleCreate}
        onCancel={handleModalClose}
        onClose={handleModalClose}
      />

      <ConfigDetailDrawer
        open={detailDrawerOpen}
        selectedConfig={selectedConfig}
        onClose={() => setDetailDrawerOpen(false)}
      />
    </div>
  );
};

export default () => (
  <PermissionGuard requiredRoles={['admin', 'platform_admin']} pageLevel resourceName="配置管理">
    <ConfigManagementPage />
  </PermissionGuard>
);
