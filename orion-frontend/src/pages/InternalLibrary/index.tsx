/**
 * Internal Library Management Page
 * M30 - 二方库管理：列表、创建、版本管理、依赖追踪
 * 抽取自 Phase 74 (P2-9): 状态 Hook + 4 Modal + 详情抽屉 + 表格
 *
 * P2-9 Phase 243 拆分:
 * - useInternalLibraryHandlers.ts: modal open wrappers + getLibraryTabItems memo
 * - Components/PageHeader.tsx: 标题栏 + 刷新/创建按钮
 * - index.tsx: 组合层
 */
import { Card } from 'antd';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import SearchFilterBar from '@/components/SearchFilterBar';
import LibraryTable from './LibraryTable';
import CreateLibraryModal from './CreateLibraryModal';
import { useInternalLibraryState } from './useInternalLibraryState';
import { useInternalLibraryHandlers } from './useInternalLibraryHandlers';
import { DeprecateModal } from './DeprecateModal';
import { PublishVersionModal } from './PublishVersionModal';
import { DeprecateVersionModal } from './DeprecateVersionModal';
import { AddDependentModal } from './AddDependentModal';
import { LibraryDetailDrawer } from './LibraryDetailDrawer';
import { PageHeader } from './Components/PageHeader';

const InternalLibraryManagement: React.FC = () => {
  const state = useInternalLibraryState();
  const {
    loading,
    libraries,
    setSearchQuery,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedLib,
    versions,
    dependents,
    versionModalVisible,
    setVersionModalVisible,
    deprecateModalVisible,
    setDeprecateModalVisible,
    deprecateVersionModalVisible,
    setDeprecateVersionModalVisible,
    addDependentModalVisible,
    setAddDependentModalVisible,
    createForm,
    versionForm,
    deprecateForm,
    deprecateVersionForm,
    addDependentForm,
    submitting,
    filteredData,
    filterDefs,
    loadData,
    handleCreate,
    handleDelete,
    handleActivate,
    handleDeprecate,
    handlePublishVersion,
    handleDeprecateVersion,
    handleAddDependent,
    openDetail,
  } = state;

  const {
    handleOpenCreate,
    handleTableDeprecate,
    detailTabItems,
    detailActiveKey,
    detailTabChange,
  } = useInternalLibraryHandlers({ state });

  const isInitialLoading = loading && libraries.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          <PageHeader loading={loading} onRefresh={loadData} onCreate={handleOpenCreate} />

          <Card>
            <div style={{ marginBottom: spacing.md }}>
              <SearchFilterBar
                onSearch={setSearchQuery}
                onFilter={setFilters}
                filters={filterDefs}
                searchPlaceholder="搜索二方库..."
              />
            </div>
            <LibraryTable
              dataSource={filteredData}
              loading={loading}
              onDetail={openDetail}
              onActivate={handleActivate}
              onDeprecate={handleTableDeprecate}
              onDelete={handleDelete}
            />
          </Card>

          <CreateLibraryModal
            visible={createModalVisible}
            form={createForm}
            submitting={submitting}
            onCancel={() => setCreateModalVisible(false)}
            onOk={handleCreate}
          />

          <DeprecateModal
            visible={deprecateModalVisible}
            form={deprecateForm}
            submitting={submitting}
            onCancel={() => setDeprecateModalVisible(false)}
            onOk={handleDeprecate}
          />

          <PublishVersionModal
            visible={versionModalVisible}
            form={versionForm}
            submitting={submitting}
            onCancel={() => setVersionModalVisible(false)}
            onOk={handlePublishVersion}
          />

          <DeprecateVersionModal
            visible={deprecateVersionModalVisible}
            form={deprecateVersionForm}
            submitting={submitting}
            onCancel={() => setDeprecateVersionModalVisible(false)}
            onOk={handleDeprecateVersion}
          />

          <AddDependentModal
            visible={addDependentModalVisible}
            form={addDependentForm}
            submitting={submitting}
            onCancel={() => setAddDependentModalVisible(false)}
            onOk={handleAddDependent}
          />

          <LibraryDetailDrawer
            visible={detailDrawerVisible}
            selectedLib={selectedLib}
            onClose={() => setDetailDrawerVisible(false)}
            detailActiveKey={detailActiveKey}
            detailTabChange={detailTabChange}
            detailTabItems={detailTabItems}
          />
        </>
      )}
    </div>
  );
};

export default InternalLibraryManagement;
