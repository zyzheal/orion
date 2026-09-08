/**
 * Configuration Management Page
 * GitOps, config approval, diff analysis, and drift detection
 * 组件化重构 (P2-9 Phase 174): 439→120 行
 * P2-9 Phase 277 拆分: 186->79 行 (-58%), 新增 Components/TabItems.tsx + Components/ModalsBundle.tsx
 */
import React from 'react';
import { Tabs } from 'antd';
import { colors, spacing } from '@/tokens';
import { PermissionGuard } from '@/components/PermissionGuard';
import { useConfigManagementState } from './useConfigManagementState';
import { PageHeader } from './Components/PageHeader';
import { buildConfigTabItems } from './Components/TabItems';
import { ConfigModalsBundle } from './Components/ModalsBundle';

const ConfigManagementPage: React.FC = () => {
  const state = useConfigManagementState();
  const { form, activeTab, setActiveTab } = state;

  const tabItems = buildConfigTabItems(state);

  return (
    <div style={{ padding: spacing.lg, background: colors.neutral[0], minHeight: '100vh' }}>
      <PageHeader
        loading={state.loading}
        driftLoading={state.driftLoading}
        onRefresh={state.loadData}
        onSync={state.handleSync}
        onDriftDetect={state.handleDriftDetect}
        onCreate={() => state.setCreateModalOpen(true)}
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />

      <ConfigModalsBundle state={state} form={form} />
    </div>
  );
};

export default () => (
  <PermissionGuard requiredRoles={['admin', 'platform_admin']} pageLevel resourceName="配置管理">
    <ConfigManagementPage />
  </PermissionGuard>
);
