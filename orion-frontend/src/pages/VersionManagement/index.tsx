import React from 'react';
import { Tabs } from 'antd';
import { spacing } from '@/tokens';
import { useVersionManagementState } from './useVersionManagementState';
import { PageHeader } from './Components/PageHeader';
import { VersionTabs } from './Components/VersionTabs';
import { CompareModal } from './Components/CompareModal';
import type { TabKey } from './useVersionManagementState';

const VersionManagement: React.FC = () => {
  const s = useVersionManagementState();
  const tabItems = VersionTabs({
    selectedRowKeys: s.selectedRowKeys,
    setSelectedRowKeys: s.setSelectedRowKeys,
    pipelineVersions: s.pipelineVersions,
    artifactVersions: s.artifactVersions,
    loading: s.loading,
    onCompare: s.handleCompare,
    onRollback: s.handleRollback,
    onSetBaseline: s.handleSetBaseline,
  });

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />
      <Tabs
        activeKey={s.activeTab}
        onChange={(key) => s.setActiveTab(key as TabKey)}
        items={tabItems}
        size="large"
      />
      <CompareModal
        open={s.compareModalVisible}
        onClose={() => s.setCompareModalVisible(false)}
        diffLoading={s.diffLoading}
        diffResult={s.diffResult}
      />
    </div>
  );
};

export default VersionManagement;
