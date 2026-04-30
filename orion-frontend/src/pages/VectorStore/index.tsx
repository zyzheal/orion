/**
 * Vector Store Management Page
 * Collection management, document upload, similarity search, and collection details
 *
 * Architecture:
 * - index.tsx: State management and sub-component orchestration
 * - CollectionList.tsx: Collection table with search
 * - CollectionDetail.tsx: Detail drawer with info/doc tabs
 * - VectorSearch.tsx: Similarity search panel
 * - DocumentManager.tsx: Document upload panel
 * - CreateCollectionModal.tsx: Create collection modal
 * - utils.ts: Shared display utility maps
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Card, Row, Col, Statistic, message } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { VectorCollection, VectorDocument, SearchHit, VectorStats } from '@/api/vector-store';
import {
  getCollections,
  deleteCollection,
  getCollectionDocuments,
  addDocument,
  deleteDocument,
  searchVectors,
  getVectorStats,
} from '@/api/vector-store';

// Sub-components
import CollectionList from './CollectionList';
import CollectionDetail from './CollectionDetail';
import VectorSearch from './VectorSearch';
import DocumentManager from './DocumentManager';
import CreateCollectionModal from './CreateCollectionModal';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ============================================================================
// Main VectorStorePage Component
// ============================================================================

const VectorStorePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<VectorCollection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<VectorCollection | null>(null);
  const [collectionDocs, setCollectionDocs] = useState<VectorDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [stats, setStats] = useState<VectorStats | null>(null);

  // Search tab state
  const [searchText, setSearchText] = useState('');
  const [searchCollection, setSearchCollection] = useState<string | undefined>(undefined);
  const [searchTopK, setSearchTopK] = useState(5);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);

  // Upload tab state
  const [uploadContent, setUploadContent] = useState('');
  const [uploadCollection, setUploadCollection] = useState<string | undefined>(undefined);
  const [uploadMetadata, setUploadMetadata] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCollections();
      setCollections(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      setCollections([]);
      message.error(`加载集合数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await getVectorStats();
      setStats(res.data?.data || null);
    } catch (error: unknown) {
      setStats(null);
    }
  };

  useEffect(() => {
    loadData();
    loadStats();
  }, []);

  const filteredCollections = useMemo(() => {
    if (!searchQuery) return collections;
    const q = searchQuery.toLowerCase();
    return collections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [searchQuery, collections]);

  const handleCreateSuccess = async () => {
    setCreateModalVisible(false);
    await loadData();
    await loadStats();
  };

  const handleDeleteCollection = async (name: string) => {
    try {
      await deleteCollection(name);
      message.success('集合已删除');
      await loadData();
      await loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败，请稍后重试');
      }
    }
  };

  const openDetail = async (collection: VectorCollection) => {
    setSelectedCollection(collection);
    setDetailDrawerVisible(true);
    await loadCollectionDocs(collection.name);
  };

  const loadCollectionDocs = async (name: string) => {
    setDocsLoading(true);
    try {
      const res = await getCollectionDocuments(name);
      setCollectionDocs(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      setCollectionDocs([]);
      message.error(`加载文档列表失败: ${(error as Error).message}`);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await deleteDocument(id);
      message.success('文档已删除');
      if (selectedCollection) await loadCollectionDocs(selectedCollection.name);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败，请稍后重试');
      }
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim()) {
      message.warning('请输入搜索内容');
      return;
    }
    setSearchLoading(true);
    try {
      const res = await searchVectors({
        query: searchText,
        collection: searchCollection,
        topK: searchTopK,
      });
      setSearchResults(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      setSearchResults([]);
      message.error(`语义搜索失败: ${(error as Error).message}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadContent.trim()) {
      message.warning('请输入文档内容');
      return;
    }
    setUploadLoading(true);
    try {
      let metadataObj: Record<string, unknown> | undefined;
      if (uploadMetadata.trim()) {
        try {
          metadataObj = JSON.parse(uploadMetadata);
        } catch (error: unknown) {
          message.error('元数据 JSON 格式错误');
          setUploadLoading(false);
          return;
        }
      }
      await addDocument({
        content: uploadContent,
        collection: uploadCollection,
        metadata: metadataObj,
      });
      message.success('文档上传成功');
      setUploadContent('');
      setUploadMetadata('');
      await loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`上传失败：${error.message}`);
      } else {
        message.error('上传失败，请稍后重试');
      }
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <DatabaseOutlined style={{ marginRight: 8 }} />
            向量存储管理
          </Title>
          <Text type="secondary">管理向量集合、文档上传和语义相似度检索</Text>
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
            创建集合
          </Button>
        </Space>
      </div>

      {/* Stats Panel */}
      {stats && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="文档总数"
                value={stats.documentCount}
                prefix={<FileTextOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="集合数量"
                value={stats.collectionCount ?? 0}
                prefix={<DatabaseOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="向量嵌入数"
                value={stats.totalEmbeddings ?? 0}
                prefix={<RocketOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic title="平均维度" value={stats.avgDimensions ?? 0} />
            </Col>
          </Row>
        </Card>
      )}

      {/* Main Content: Collection List + Functional Panels */}
      <Row gutter={16}>
        {/* Left: Collection List */}
        <Col span={16}>
          <Card>
            <CollectionList
              collections={collections}
              filteredCollections={filteredCollections}
              loading={loading}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              onOpenDetail={openDetail}
              onDeleteCollection={handleDeleteCollection}
            />
          </Card>
        </Col>

        {/* Right: Search & Upload */}
        <Col span={8}>
          <VectorSearch
            collections={collections}
            searchText={searchText}
            searchCollection={searchCollection}
            searchTopK={searchTopK}
            searchLoading={searchLoading}
            searchResults={searchResults}
            onSearchTextChange={setSearchText}
            onCollectionChange={setSearchCollection}
            onTopKChange={setSearchTopK}
            onSearch={handleSearch}
          />
          <div style={{ marginTop: 16 }}>
            <DocumentManager
              collections={collections}
              uploadContent={uploadContent}
              uploadCollection={uploadCollection}
              uploadMetadata={uploadMetadata}
              uploadLoading={uploadLoading}
              onContentChange={setUploadContent}
              onCollectionChange={setUploadCollection}
              onMetadataChange={setUploadMetadata}
              onUpload={handleUpload}
            />
          </div>
        </Col>
      </Row>

      {/* Create Collection Modal */}
      <CreateCollectionModal
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
        collections={collections}
        onCollectionsChange={setCollections}
      />

      {/* Detail Drawer */}
      <CollectionDetail
        collection={selectedCollection}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        documents={collectionDocs}
        docsLoading={docsLoading}
        onDeleteDoc={handleDeleteDoc}
      />
    </div>
  );
};

export default VectorStorePage;
