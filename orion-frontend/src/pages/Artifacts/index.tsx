/**
 * Artifact Management Page (M29)
 * List, create, view details, promote, tag management, deprecate/quarantine
 * 抽取自 Phase 75 (P2-9): 状态 Hook + 4 Modal + 详情抽屉 + 表格
 *
 * Phase 247 拆分:
 * - Components/PageHeader.tsx: 标题 + 刷新 + 创建按钮
 * - Components/Modals.tsx: 4 个 Modal + DetailDrawer 组合
 */
import { useMemo } from 'react';
import { Card } from 'antd';
import { spacing } from '@/tokens';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import ArtifactStats from './ArtifactStats';
import ArtifactTable from './ArtifactTable';
import { getArtifactTabItems } from './ArtifactDetail';
import { useArtifactState } from './useArtifactState';
import { PageHeader } from './Components/PageHeader';
import { Modals } from './Components/Modals';

const ArtifactManagement: React.FC = () => {
  const {
    loading,
    artifacts,
    setSearchQuery,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedArtifact,
    promotionModalVisible,
    setPromotionModalVisible,
    tagModalVisible,
    setTagModalVisible,
    stats,
    namespaces,
    tags,
    promotionHistory,
    createForm,
    editForm,
    promotionForm,
    tagForm,
    submitting,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    total,
    filteredData,
    filterDefs,
    loadData,
    loadStats,
    handleCreate,
    handleEdit,
    handleDelete,
    handleDeprecate,
    handleQuarantine,
    handleDownload,
    handlePromote,
    handleAddTags,
    openEdit,
    openDetail,
    openPromotion,
    openTagModal,
  } = useArtifactState();

  const detailTabItems = useMemo(
    () => getArtifactTabItems(selectedArtifact, tags, promotionHistory, openTagModal),
    [selectedArtifact, tags, promotionHistory, openTagModal]
  );

  const isInitialLoading = loading && artifacts.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading && <PageSkeleton cards={7} rows={8} />}

      {isInitialLoading ? null : (
        <>
          <PageHeader
            loading={loading}
            onRefresh={() => {
              loadData();
              loadStats();
            }}
            onCreate={() => setCreateModalVisible(true)}
          />

          {stats && <ArtifactStats stats={stats} />}

          <Card>
            <div style={{ marginBottom: spacing.md }}>
              <SearchFilterBar
                onSearch={setSearchQuery}
                onFilter={setFilters}
                filters={filterDefs}
                searchPlaceholder="搜索制品..."
              />
            </div>
            <ArtifactTable
              dataSource={filteredData}
              loading={loading}
              currentPage={currentPage}
              pageSize={pageSize}
              total={total}
              onDetail={openDetail}
              onEdit={openEdit}
              onPromote={openPromotion}
              onTag={openTagModal}
              onDownload={handleDownload}
              onDeprecate={handleDeprecate}
              onQuarantine={handleQuarantine}
              onDelete={handleDelete}
              onPaginationChange={(page, size) => {
                setCurrentPage(page);
                setPageSize(size);
                loadData(page, size);
              }}
            />
          </Card>

          <Modals
            createModalVisible={createModalVisible}
            setCreateModalVisible={setCreateModalVisible}
            editModalVisible={editModalVisible}
            setEditModalVisible={setEditModalVisible}
            promotionModalVisible={promotionModalVisible}
            setPromotionModalVisible={setPromotionModalVisible}
            tagModalVisible={tagModalVisible}
            setTagModalVisible={setTagModalVisible}
            detailDrawerVisible={detailDrawerVisible}
            setDetailDrawerVisible={setDetailDrawerVisible}
            selectedArtifact={selectedArtifact}
            detailTabItems={detailTabItems}
            submitting={submitting}
            namespaces={namespaces}
            createForm={createForm}
            editForm={editForm}
            promotionForm={promotionForm}
            tagForm={tagForm}
            handleCreate={handleCreate}
            handleEdit={handleEdit}
            handlePromote={handlePromote}
            handleAddTags={handleAddTags}
          />
        </>
      )}
    </div>
  );
};

export default ArtifactManagement;
