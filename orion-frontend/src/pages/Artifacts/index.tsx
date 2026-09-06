/**
 * Artifact Management Page (M29)
 * List, create, view details, promote, tag management, deprecate/quarantine
 * 抽取自 Phase 75 (P2-9): 状态 Hook + 4 Modal + 详情抽屉 + 表格
 */
import React, { useMemo } from 'react';
import { Typography, Button, Space, Card } from 'antd';
import { colors, spacing } from '@/tokens';
import { PlusOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import ArtifactStats from './ArtifactStats';
import ArtifactTable from './ArtifactTable';
import { getArtifactTabItems } from './ArtifactDetail';
import { useArtifactState } from './useArtifactState';
import { CreateArtifactModal } from './CreateArtifactModal';
import { EditArtifactModal } from './EditArtifactModal';
import { PromotionModal } from './PromotionModal';
import { TagModal } from './TagModal';
import { ArtifactDetailDrawer } from './ArtifactDetailDrawer';

const { Title, Text } = Typography;

const ArtifactManagement: React.FC = () => {
  const {
    loading,
    artifacts,
    searchQuery,
    setSearchQuery,
    filters,
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
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: spacing.lg,
            }}
          >
            <div>
              <Title level={2} style={{ marginBottom: spacing.sm }}>
                <InboxOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
                制品管理
              </Title>
              <Text type="secondary">管理制品仓库、生命周期晋升、标签和安全扫描</Text>
            </div>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  loadData();
                  loadStats();
                }}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建制品
              </Button>
            </Space>
          </div>

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

          <CreateArtifactModal
            visible={createModalVisible}
            form={createForm}
            submitting={submitting}
            namespaces={namespaces}
            onCancel={() => setCreateModalVisible(false)}
            onOk={handleCreate}
          />

          <EditArtifactModal
            visible={editModalVisible}
            form={editForm}
            submitting={submitting}
            onCancel={() => setEditModalVisible(false)}
            onOk={handleEdit}
          />

          <PromotionModal
            visible={promotionModalVisible}
            form={promotionForm}
            submitting={submitting}
            selectedArtifact={selectedArtifact}
            onCancel={() => setPromotionModalVisible(false)}
            onOk={handlePromote}
          />

          <TagModal
            visible={tagModalVisible}
            form={tagForm}
            submitting={submitting}
            onCancel={() => setTagModalVisible(false)}
            onOk={handleAddTags}
          />

          <ArtifactDetailDrawer
            visible={detailDrawerVisible}
            selectedArtifact={selectedArtifact}
            detailTabItems={detailTabItems}
            onClose={() => setDetailDrawerVisible(false)}
          />
        </>
      )}
    </div>
  );
};

export default ArtifactManagement;
