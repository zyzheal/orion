/**
 * FlowVersions - 低代码流程版本管理页面
 *
 * 功能：
 * - 选择流程，查看版本历史
 * - 创建版本快照（带变更说明）
 * - 查看版本详情（快照对比）
 * - 恢复/回滚到指定版本
 *
 * P2-9 Phase 184: Extracted to columns.tsx + useFlowVersionsState.ts +
 * Components/*.tsx (5 components). 420 → 75 行 (-82%).
 */
import React from 'react';
import { spacing } from '@/tokens';
import type { FormInstance } from 'antd';
import { useFlowVersionsState } from './useFlowVersionsState';
import type { VersionCreateInput } from './useFlowVersionsState';
import { buildVersionColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { FlowSelector } from './Components/FlowSelector';
import { VersionTable } from './Components/VersionTable';
import { CreateVersionModal } from './Components/CreateVersionModal';
import { VersionDetailModal } from './Components/VersionDetailModal';

const FlowVersionsPage: React.FC = () => {
  const {
    flows,
    selectedFlow,
    versions,
    totalVersions,
    loading,
    versionLoading,
    createVisible,
    setCreateVisible,
    detailVisible,
    selectedVersion,
    createForm,
    loadFlows,
    handleSelectFlow,
    handleCreateVersion,
    handleViewVersion,
    handleRestoreVersion,
    closeCreate,
    closeDetail,
  } = useFlowVersionsState();

  const columns = buildVersionColumns({
    onViewVersion: handleViewVersion,
    onRestoreVersion: handleRestoreVersion,
  });

  const openCreate = () => setCreateVisible(true);

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />
      <FlowSelector
        flows={flows}
        selectedFlow={selectedFlow}
        loading={loading}
        onSelect={handleSelectFlow}
        onRefresh={loadFlows}
      />
      <VersionTable
        columns={columns}
        dataSource={versions}
        selectedFlow={selectedFlow}
        versionLoading={versionLoading}
        totalVersions={totalVersions}
        onCreateVersion={openCreate}
      />
      <CreateVersionModal
        open={createVisible}
        form={createForm as FormInstance<VersionCreateInput>}
        onFinish={handleCreateVersion}
        onCancel={closeCreate}
      />
      <VersionDetailModal
        open={detailVisible}
        selectedFlow={selectedFlow}
        selectedVersion={selectedVersion}
        onRestore={handleRestoreVersion}
        onClose={closeDetail}
      />
    </div>
  );
};

export default FlowVersionsPage;
