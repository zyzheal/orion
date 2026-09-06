import { colors, spacing } from '@/tokens';

/**
 * Internal Library Management Page
 * M30 - 二方库管理：列表、创建、版本管理、依赖追踪
 * 抽取自 Phase 74 (P2-9): 状态 Hook + 4 Modal + 详情抽屉 + 表格
 */
import React from 'react';
import { Typography, Button, Space, Card } from 'antd';
import { PlusOutlined, ReloadOutlined, BookOutlined } from '@ant-design/icons';
import PageSkeleton from '@/components/PageSkeleton';
import SearchFilterBar from '@/components/SearchFilterBar';
import LibraryTable from './LibraryTable';
import CreateLibraryModal from './CreateLibraryModal';
import { getLibraryTabItems } from './LibraryDetail';
import { useInternalLibraryState } from './useInternalLibraryState';
import { DeprecateModal } from './DeprecateModal';
import { PublishVersionModal } from './PublishVersionModal';
import { DeprecateVersionModal } from './DeprecateVersionModal';
import { AddDependentModal } from './AddDependentModal';
import { LibraryDetailDrawer } from './LibraryDetailDrawer';

const { Title, Text } = Typography;

const InternalLibraryManagement: React.FC = () => {
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
    setSelectedLib,
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
    activeTab,
    setActiveTab,
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
    handleUpdateDependent,
    handleUpdateStats,
    openDetail,
  } = useInternalLibraryState();

  const {
    items: detailTabItems,
    activeKey: detailActiveKey,
    onChange: detailTabChange,
  } = getLibraryTabItems(
    selectedLib,
    versions,
    dependents,
    activeTab,
    setActiveTab,
    () => {
      versionForm.resetFields();
      setVersionModalVisible(true);
    },
    (targetVersion: string) => {
      versionForm.setFieldValue('_targetVersion', targetVersion);
      setDeprecateVersionModalVisible(true);
    },
    handleUpdateStats,
    () => {
      addDependentForm.resetFields();
      setAddDependentModalVisible(true);
    },
    handleUpdateDependent
  );

  const isInitialLoading = loading && libraries.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading && <PageSkeleton rows={8} />}

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
                <BookOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
                二方库管理
              </Title>
              <Text type="secondary">管理内部二方库的生命周期、版本发布和依赖追踪</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  setCreateModalVisible(true);
                }}
              >
                创建二方库
              </Button>
            </Space>
          </div>

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
              onDeprecate={(record) => {
                setSelectedLib(record);
                setDeprecateModalVisible(true);
              }}
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
