/**
 * useInternalLibraryHandlers.ts - 二方库 处理 Hook
 * 抽取自 index.tsx (P2-9 Phase 243)
 * 聚合 modal open wrappers + getLibraryTabItems 计算
 */
import { useMemo } from 'react';
import { getLibraryTabItems } from './LibraryDetail';
import type { useInternalLibraryState } from './useInternalLibraryState';

type InternalLibraryState = ReturnType<typeof useInternalLibraryState>;

interface Props {
  state: InternalLibraryState;
}

export function useInternalLibraryHandlers({ state: s }: Props) {
  // 打开创建 Modal
  const handleOpenCreate = () => {
    s.createForm.resetFields();
    s.setCreateModalVisible(true);
  };

  // 打开版本发布 Modal
  const handleOpenPublishVersion = () => {
    s.versionForm.resetFields();
    s.setVersionModalVisible(true);
  };

  // 打开版本弃用 Modal (带 targetVersion)
  const handleOpenDeprecateVersion = (targetVersion: string) => {
    s.versionForm.setFieldValue('_targetVersion', targetVersion);
    s.setDeprecateVersionModalVisible(true);
  };

  // 打开添加依赖 Modal
  const handleOpenAddDependent = () => {
    s.addDependentForm.resetFields();
    s.setAddDependentModalVisible(true);
  };

  // 表格行: 打开弃用 Modal (先 setSelectedLib)
  const handleTableDeprecate = (record: Parameters<typeof s.handleDeprecate>[0]) => {
    s.setSelectedLib(record);
    s.setDeprecateModalVisible(true);
  };

  // 详情 Drawer 的 Tab items
  const { items: detailTabItems, activeKey: detailActiveKey, onChange: detailTabChange } = useMemo(
    () =>
      getLibraryTabItems(
        s.selectedLib,
        s.versions,
        s.dependents,
        s.activeTab,
        s.setActiveTab,
        handleOpenPublishVersion,
        handleOpenDeprecateVersion,
        s.handleUpdateStats,
        handleOpenAddDependent,
        s.handleUpdateDependent
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.selectedLib, s.versions, s.dependents, s.activeTab]
  );

  return {
    handleOpenCreate,
    handleOpenPublishVersion,
    handleOpenDeprecateVersion,
    handleOpenAddDependent,
    handleTableDeprecate,
    detailTabItems,
    detailActiveKey,
    detailTabChange,
  };
}
