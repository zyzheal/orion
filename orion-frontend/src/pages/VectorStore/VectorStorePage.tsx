import { colors, spacing } from '@/tokens';

/**
 * Vector Store Management Page
 * Collection management, document upload, similarity search, and collection details
 */
import React, { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Input,
  Modal,
  Form,
  Select,
  Tag,
  Drawer,
  Descriptions,
  Tabs,
  Empty,
  message,
  Tooltip,
  Popconfirm,
} from 'antd';
import {
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
  FileTextOutlined,
  RocketOutlined,
  EyeOutlined,
  DeleteOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import dayjsRelativeTime from 'dayjs/plugin/relativeTime';
import type {
  VectorCollection,
  VectorDocument,
  SearchHit,
  VectorStats,
  CreateCollectionInput,
  AddDocumentInput,
  SearchInput,
} from '@/api/vector-store';
import {
  getCollections,
  createCollection,
  deleteCollection,
  getCollectionDocuments,
  addDocument,
  deleteDocument,
  searchVectors,
  getVectorStats,
} from '@/api/vector-store';

const { Title, Text } = Typography;

dayjs.extend(dayjsRelativeTime);

const statusColorMap: Record<string, string> = {
  active: 'green',
  creating: 'blue',
  processing: 'blue',
  error: 'red',
  failed: 'red',
};

const indexTypeLabelMap: Record<string, string> = {
  flat: 'FLAT',
  ivf_flat: 'IVF_FLAT',
  hnsw: 'HNSW',
  annoy: 'Annoy',
};

const metricLabelMap: Record<string, string> = {
  cosine: '余弦相似度',
  euclidean: '欧氏距离',
  dot_product: '点积',
};

const VectorStorePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<VectorCollection[]>([]);
  const [searchQuery, _setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<VectorCollection | null>(null);
  const [collectionDocs, setCollectionDocs] = useState<VectorDocument[]>([]);
  const [, setDocsLoading] = useState(false);
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

  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCollections();
      setCollections(Array.isArray(res.data) ? res.data : []);
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
      setStats(res.data || null);
    } catch {
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

  const handleCreate = async (values: { name: string; displayName: string; description?: string; dimensions: number; indexType?: string; distanceMetric?: string }) => {
    try {
      const data: CreateCollectionInput = {
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        dimensions: values.dimensions,
        indexType: (values.indexType as CreateCollectionInput['indexType']) || 'hnsw',
        distanceMetric: (values.distanceMetric as CreateCollectionInput['distanceMetric']) || 'cosine',
      };
      await createCollection(data);
      message.success('集合创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
      loadStats();
    } catch (error: unknown) {
      message.error(`创建失败：${(error as Error).message}`);
    }
  };

  const handleDeleteCollection = async (name: string) => {
    try {
      await deleteCollection(name);
      message.success('集合已删除');
      loadData();
      loadStats();
    } catch (error: unknown) {
      message.error(`删除失败：${(error as Error).message}`);
    }
  };

  const handleUpdateCollection_ = async (
    name: string,
    data: { displayName?: string; description?: string; dimensions?: number; indexType?: string; distanceMetric?: string }
  ) => {
    // TODO: Replace with actual update API when available: updateCollection(name, data)
    console.warn('[VectorStore] updateCollection API not yet implemented', name, data);
    message.info('集合配置更新功能开发中');
  };

  const openDetail = async (collection: VectorCollection) => {
    setSelectedCollection(collection);
    setDetailDrawerOpen(true);
    await loadCollectionDocs(collection.name);
  };

  const loadCollectionDocs = async (name: string) => {
    setDocsLoading(true);
    try {
      const res = await getCollectionDocuments(name);
      setCollectionDocs(Array.isArray(res.data) ? res.data : []);
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
      message.error(`删除失败：${(error as Error).message}`);
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim()) {
      message.warning('请输入搜索内容');
      return;
    }
    setSearchLoading(true);
    try {
      const data: SearchInput = {
        query: searchText,
        collection: searchCollection,
        topK: searchTopK,
      };
      const res = await searchVectors(data);
      setSearchResults(Array.isArray(res.data) ? res.data : []);
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
        } catch {
          message.error('元数据 JSON 格式错误');
          setUploadLoading(false);
          return;
        }
      }
      const data: AddDocumentInput = {
        content: uploadContent,
        collection: uploadCollection,
        metadata: metadataObj,
      };
      await addDocument(data);
      message.success('文档上传成功');
      setUploadContent('');
      setUploadMetadata('');
      loadStats();
    } catch (error: unknown) {
      message.error(`上传失败：${(error as Error).message}`);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setUploadContent(text.substring(0, 10000));
      setUploadMetadata(JSON.stringify({ source: file.name }, null, 2));
      message.success(`文件 ${file.name} 已读取`);
    };
    reader.readAsText(file);
    return false;
  };

  const collectionColumns = [
    {
      title: '集合名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 180,
      render: (text: string, record: VectorCollection) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer', color: colors.primary[500] }} onClick={() => openDetail(record)}>
            {text}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.name}
          </Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {text || '-'}
        </Text>
      ),
    },
    {
      title: '文档数',
      dataIndex: 'documentCount',
      key: 'documentCount',
      width: 100,
      sorter: (a: VectorCollection, b: VectorCollection) => a.documentCount - b.documentCount,
      render: (val: number) => <Text strong>{val.toLocaleString()}</Text>,
    },
    {
      title: '维度',
      dataIndex: 'dimensions',
      key: 'dimensions',
      width: 90,
      render: (val: number) => <Text code>{val}</Text>,
    },
    {
      title: '索引类型',
      dataIndex: 'indexType',
      key: 'indexType',
      width: 110,
      render: (val: string) => <Tag>{indexTypeLabelMap[val] || val}</Tag>,
    },
    {
      title: '距离度量',
      dataIndex: 'distanceMetric',
      key: 'distanceMetric',
      width: 120,
      render: (val: string) => <Text type="secondary">{metricLabelMap[val] || val}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (val: string) => (
        <Tag color={statusColorMap[val] || 'default'}>
          {val === 'active' ? '活跃' : val === 'creating' ? '创建中' : '错误'}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      sorter: (a: VectorCollection, b: VectorCollection) => dayjs(a.updatedAt).unix() - dayjs(b.updatedAt).unix(),
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(val).fromNow()}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: VectorCollection) => (
        <Space size="small">
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm title="确认删除该集合？此操作不可撤销。" onConfirm={() => handleDeleteCollection(record.name)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const detailTabs = useMemo(() => {
    if (!selectedCollection) return [];
    const c = selectedCollection;
    return [
      {
        key: 'info',
        label: '基本信息',
        children: (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="集合名称">{c.name}</Descriptions.Item>
            <Descriptions.Item label="显示名称">{c.displayName}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {c.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="文档数量">{c.documentCount.toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="向量维度">{c.dimensions}</Descriptions.Item>
            <Descriptions.Item label="索引类型">{indexTypeLabelMap[c.indexType] || c.indexType}</Descriptions.Item>
            <Descriptions.Item label="距离度量">{metricLabelMap[c.distanceMetric] || c.distanceMetric}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[c.status] || 'default'}>
                {c.status === 'active' ? '活跃' : c.status === 'creating' ? '创建中' : '错误'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{dayjs(c.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{dayjs(c.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        ),
      },
      {
        key: 'documents',
        label: '文档列表',
        children: (
          <Table<VectorDocument>
            columns={[
              {
                title: '文档内容',
                dataIndex: 'content',
                key: 'content',
                ellipsis: true,
                render: (val: string, record: VectorDocument) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text ellipsis={{ rows: 2 as any }} style={{ fontSize: 13 }}>
                      {val}
                    </Text>
                    {record.metadata?.source && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        来源: <code>{record.metadata.source as ReactNode}</code>
                        {record.metadata.category && ` | 分类: ${record.metadata.category as ReactNode}`}
                      </Text>
                    )}
                  </div>
                ),
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                width: 90,
                render: (val: string) => (
                  <Tag color={statusColorMap[val] || 'default'}>
                    {val === 'active' ? '就绪' : val === 'processing' ? '处理中' : '失败'}
                  </Tag>
                ),
              },
              {
                title: '维度',
                dataIndex: 'dimensions',
                key: 'dimensions',
                width: 80,
                render: (val: number) => (
                  <Text code style={{ fontSize: 12 }}>
                    {val}
                  </Text>
                ),
              },
              {
                title: '创建时间',
                dataIndex: 'createdAt',
                key: 'createdAt',
                width: 140,
                render: (val: string) => (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(val).fromNow()}
                  </Text>
                ),
              },
              {
                title: '操作',
                key: 'actions',
                width: 80,
                render: (_: unknown, record: VectorDocument) => (
                  <Popconfirm title="确认删除该文档？" onConfirm={() => handleDeleteDoc(record.id)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
              },
            ]}
            dataSource={collectionDocs}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        ),
      },
    ];
  }, [selectedCollection, collectionDocs, handleDeleteDoc]);

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
          <Button icon={<ReloadOutlined />} onClick={() => { loadData(); loadStats(); }} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建集合
          </Button>
        </Space>
      </div>

      {/* Stats Panel */}
      {stats && (
        <Card size="small" style={{ marginBottom: spacing.md }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="文档总数" value={stats.documentCount} prefix={<FileTextOutlined />} />
            </Col>
            <Col span={6}>
              <Statistic title="集合数量" value={stats.collectionCount ?? 0} prefix={<DatabaseOutlined />} />
            </Col>
            <Col span={6}>
              <Statistic title="向量嵌入数" value={stats.totalEmbeddings ?? 0} prefix={<RocketOutlined />} />
            </Col>
            <Col span={6}>
              <Statistic title="平均维度" value={stats.avgDimensions ?? 0} />
            </Col>
          </Row>
        </Card>
      )}

      {/* Main Content */}
      <Row gutter={16}>
        {/* Left: Collection List */}
        <Col span={16}>
          <Card>
            {filteredCollections.length === 0 && !loading ? (
              <Empty
                description="暂无向量集合"
                style={{ margin: `${spacing.xl} 0` }}
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                  创建集合
                </Button>
              </Empty>
            ) : (
              <Table<VectorCollection>
                columns={collectionColumns}
                dataSource={filteredCollections}
                rowKey="name"
                loading={loading}
                size="middle"
                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
              />
            )}
          </Card>
        </Col>

        {/* Right: Search & Upload */}
        <Col span={8}>
          <Card title="相似度检索" style={{ marginBottom: spacing.md }}>
            <Form layout="vertical" onFinish={handleSearch}>
              <Form.Item label="搜索内容">
                <Input.TextArea
                  rows={3}
                  placeholder="输入搜索文本进行语义匹配..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </Form.Item>
              <Form.Item label="目标集合 (可选)">
                <Select
                  placeholder="选择集合"
                  allowClear
                  value={searchCollection}
                  onChange={setSearchCollection}
                  options={collections
                    .filter((c) => c.status === 'active')
                    .map((c) => ({ label: c.displayName, value: c.name }))}
                />
              </Form.Item>
              <Form.Item label="返回数量 (Top K)">
                <Select
                  value={searchTopK}
                  onChange={setSearchTopK}
                  options={[
                    { label: 'Top 3', value: 3 },
                    { label: 'Top 5', value: 5 },
                    { label: 'Top 10', value: 10 },
                    { label: 'Top 20', value: 20 },
                  ]}
                />
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={searchLoading} block>
                  语义搜索
                </Button>
              </Form.Item>
            </Form>

            {searchResults.length > 0 && (
              <div style={{ marginTop: spacing[3] }}>
                <Text strong style={{ marginBottom: spacing.sm, display: 'block' }}>
                  搜索结果 ({searchResults.length} 条)
                </Text>
                {searchResults.map((hit, idx) => (
                  <Card size="small" key={hit.id} style={{ marginBottom: spacing.sm }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                      }}
                    >
                      <Tag color={idx === 0 ? 'green' : idx === 1 ? 'blue' : 'default'}>
                        相似度 {(hit.score * 100).toFixed(1)}%
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {hit.collection}
                        {hit.metadata?.source && ` | ${hit.metadata.source as string}`}
                      </Text>
                    </div>
                    <Text ellipsis={{ rows: 3 as any }} style={{ fontSize: 12, display: 'block' }}>
                      {hit.content}
                    </Text>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          <Card title="上传文档">
            <Form layout="vertical">
              <Form.Item label="目标集合 (可选)">
                <Select
                  placeholder="选择集合"
                  allowClear
                  value={uploadCollection}
                  onChange={setUploadCollection}
                  options={collections
                    .filter((c) => c.status === 'active')
                    .map((c) => ({ label: c.displayName, value: c.name }))}
                />
              </Form.Item>
              <Form.Item label="文档内容">
                <Input.TextArea
                  rows={4}
                  placeholder="输入或粘贴文档内容..."
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                />
              </Form.Item>
              <Form.Item label="元数据 (JSON, 可选)">
                <Input.TextArea
                  rows={2}
                  placeholder='{"source": "file.md", "category": "docs"}'
                  value={uploadMetadata}
                  onChange={(e) => setUploadMetadata(e.target.value)}
                />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" icon={<UploadOutlined />} onClick={handleUpload} loading={uploadLoading}>
                    上传文档
                  </Button>
                  <Tooltip title="支持 .txt, .md, .json 等文本文件">
                    <label>
                      <Button icon={<UploadOutlined />}>选择文件</Button>
                      <input
                        type="file"
                        accept=".txt,.md,.json,.yaml,.yml"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                    </label>
                  </Tooltip>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* Create Collection Modal */}
      <Modal
        title="创建向量集合"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={uploadLoading}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="name"
            label="集合名称 (唯一标识)"
            rules={[{ required: true, message: '请输入集合名称' }]}
          >
            <Input placeholder="如: my-knowledge-base" />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="如: 我的知识库" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="集合描述..." />
          </Form.Item>
          <Form.Item
            name="dimensions"
            label="向量维度"
            rules={[{ required: true, message: '请输入向量维度' }]}
            initialValue={1536}
          >
            <Select
              options={[
                { label: '384 (all-MiniLM)', value: 384 },
                { label: '768 (BGE-base)', value: 768 },
                { label: '1024 (BGE-large)', value: 1024 },
                { label: '1536 (OpenAI/Ada)', value: 1536 },
                { label: '3072 (GTE-large)', value: 3072 },
              ]}
            />
          </Form.Item>
          <Form.Item name="indexType" label="索引类型" initialValue="hnsw">
            <Select
              options={[
                { label: 'HNSW (推荐)', value: 'hnsw' },
                { label: 'IVF_FLAT', value: 'ivf_flat' },
                { label: 'FLAT (精确)', value: 'flat' },
                { label: 'Annoy', value: 'annoy' },
              ]}
            />
          </Form.Item>
          <Form.Item name="distanceMetric" label="距离度量" initialValue="cosine">
            <Select
              options={[
                { label: '余弦相似度', value: 'cosine' },
                { label: '欧氏距离', value: 'euclidean' },
                { label: '点积', value: 'dot_product' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedCollection ? `${selectedCollection.displayName} - 集合详情` : '集合详情'}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={800}
        destroyOnClose
      >
        <Tabs items={detailTabs} />
      </Drawer>
    </div>
  );
};

export default VectorStorePage;
