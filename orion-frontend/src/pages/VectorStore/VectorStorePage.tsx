import { colors, spacing } from '@/tokens';

/**
 * Vector Store Management Page
 * 主入口 - 抽取自 845 行 monolith (P2-9 Phase 93)
 * 拆分为:
 * - useVectorStoreState.ts (状态/handler)
 * - columns.tsx (表格列)
 * - constants.ts (常量)
 * - Modals/CreateCollectionModal.tsx (创建弹窗)
 * - Components/DetailDrawer.tsx (详情抽屉)
 * - Components/SearchPanel.tsx (搜索面板)
 * - Components/UploadPanel.tsx (上传面板)
 * - Components/StatsPanel.tsx (统计面板)
 */
import React, { useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Row,
  Col,
  Table,
  Empty,
} from 'antd';
import {
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useVectorStoreState } from './useVectorStoreState';
import { makeCollectionColumns } from './columns';
import { CreateCollectionModal } from './Modals/CreateCollectionModal';
import { DetailDrawer } from './Components/DetailDrawer';
import { SearchPanel } from './Components/SearchPanel';
import { UploadPanel } from './Components/UploadPanel';
import { StatsPanel } from './Components/StatsPanel';
import type { VectorCollection } from '@/api/vector-store';

const { Title, Text } = Typography;

const VectorStorePage: React.FC = () => {
  const s = useVectorStoreState();

  const collectionColumns = useMemo(
    () => makeCollectionColumns(s.openDetail, s.handleDeleteCollection),
    [s.openDetail, s.handleDeleteCollection]
  );

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
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
            <DatabaseOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            向量存储管理
          </Title>
          <Text type="secondary">管理向量集合、文档上传和语义相似度检索</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              s.loadData();
              s.loadStats();
            }}
            loading={s.loading}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => s.setCreateModalVisible(true)}>
            创建集合
          </Button>
        </Space>
      </div>

      {/* Stats Panel */}
      <StatsPanel stats={s.stats} />

      {/* Main Content */}
      <Row gutter={16}>
        {/* Left: Collection List */}
        <Col span={16}>
          <Card>
            {s.filteredCollections.length === 0 && !s.loading ? (
              <Empty description="暂无向量集合" style={{ margin: `${spacing.xl} 0` }}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => s.setCreateModalVisible(true)}
                >
                  创建集合
                </Button>
              </Empty>
            ) : (
              <Table<VectorCollection>
                columns={collectionColumns}
                dataSource={s.filteredCollections}
                rowKey="name"
                loading={s.loading}
                size="middle"
                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
              />
            )}
          </Card>
        </Col>

        {/* Right: Search & Upload */}
        <Col span={8}>
          <SearchPanel
            collections={s.collections}
            searchText={s.searchText}
            setSearchText={s.setSearchText}
            searchCollection={s.searchCollection}
            setSearchCollection={s.setSearchCollection}
            searchTopK={s.searchTopK}
            setSearchTopK={s.setSearchTopK}
            searchLoading={s.searchLoading}
            searchResults={s.searchResults}
            onSearch={s.handleSearch}
          />
          <UploadPanel
            collections={s.collections}
            uploadContent={s.uploadContent}
            setUploadContent={s.setUploadContent}
            uploadCollection={s.uploadCollection}
            setUploadCollection={s.setUploadCollection}
            uploadMetadata={s.uploadMetadata}
            setUploadMetadata={s.setUploadMetadata}
            uploadLoading={s.uploadLoading}
            onUpload={s.handleUpload}
          />
        </Col>
      </Row>

      {/* Create Collection Modal */}
      <CreateCollectionModal
        open={s.createModalVisible}
        confirmLoading={s.uploadLoading}
        onCancel={() => s.setCreateModalVisible(false)}
        onFinish={s.handleCreateSuccess}
      />

      {/* Detail Drawer */}
      <DetailDrawer
        open={s.detailDrawerVisible}
        selectedCollection={s.selectedCollection}
        collectionDocs={s.collectionDocs}
        handleDeleteDoc={s.handleDeleteDoc}
        onClose={() => s.setDetailDrawerVisible(false)}
      />
    </div>
  );
};

export default VectorStorePage;
