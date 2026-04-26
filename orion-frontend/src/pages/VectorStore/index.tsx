/**
 * Vector Store Management Page
 * Collection management, document upload, similarity search, and collection details
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input, Select, message, Alert,
  Popconfirm, Tabs, Descriptions, Drawer, Tooltip, Statistic, Row, Col,
  Upload, Table as AntTable, Spin,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, SearchOutlined, DeleteOutlined,
  EyeOutlined, UploadOutlined, DatabaseOutlined,
  FileTextOutlined, RocketOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getCollections, createCollection, deleteCollection, getCollectionDocuments,
  addDocument, deleteDocument, searchVectors, getVectorStats,
  type VectorCollection, type VectorDocument, type SearchHit,
  type VectorStats,
} from '@/api/vector-store';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

// ---- Color maps ----

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

// ---- Mock data ----

const MOCK_COLLECTIONS: VectorCollection[] = [
  {
    name: 'orion-knowledge',
    displayName: 'Orion 知识库',
    description: 'Orion 平台技术文档和操作手册的向量集合',
    documentCount: 1250,
    dimensions: 1536,
    indexType: 'hnsw',
    distanceMetric: 'cosine',
    status: 'active',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2026-04-25T14:30:00Z',
  },
  {
    name: 'code-snippets',
    displayName: '代码片段库',
    description: '常用代码片段和最佳实践的语义检索集合',
    documentCount: 3420,
    dimensions: 1536,
    indexType: 'hnsw',
    distanceMetric: 'cosine',
    status: 'active',
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2026-04-24T09:15:00Z',
  },
  {
    name: 'incident-reports',
    displayName: '故障报告库',
    description: '历史故障报告和解决方案的向量集合',
    documentCount: 867,
    dimensions: 768,
    indexType: 'ivf_flat',
    distanceMetric: 'euclidean',
    status: 'active',
    createdAt: '2024-03-10T12:00:00Z',
    updatedAt: '2026-04-20T16:45:00Z',
  },
  {
    name: 'api-docs',
    displayName: 'API 文档库',
    description: 'API 接口文档和示例的向量集合',
    documentCount: 2100,
    dimensions: 1536,
    indexType: 'hnsw',
    distanceMetric: 'cosine',
    status: 'active',
    createdAt: '2024-04-05T08:30:00Z',
    updatedAt: '2026-04-26T08:00:00Z',
  },
  {
    name: 'user-feedback',
    displayName: '用户反馈库',
    description: '用户反馈和建议的语义分析集合',
    documentCount: 543,
    dimensions: 384,
    indexType: 'flat',
    distanceMetric: 'dot_product',
    status: 'creating',
    createdAt: '2026-04-26T10:00:00Z',
    updatedAt: '2026-04-26T10:00:00Z',
  },
];

const MOCK_DOCUMENTS: VectorDocument[] = [
  {
    id: 'doc-1', content: 'Orion 平台使用 Tekton 进行 CI/CD 流水线编排，支持多阶段构建和部署...',
    metadata: { source: 'tekton-guide.md', category: 'pipeline' },
    collection: 'orion-knowledge', dimensions: 1536, status: 'active',
    createdAt: '2026-04-20T10:00:00Z', updatedAt: '2026-04-20T10:00:00Z',
  },
  {
    id: 'doc-2', content: 'Knative 自动扩缩容配置：通过设置 minScale 和 maxScale 控制实例数量...',
    metadata: { source: 'knative-scaling.md', category: 'deployment' },
    collection: 'orion-knowledge', dimensions: 1536, status: 'active',
    createdAt: '2026-04-21T14:00:00Z', updatedAt: '2026-04-21T14:00:00Z',
  },
  {
    id: 'doc-3', content: 'Prometheus 告警规则配置示例：针对 CPU 使用率、内存占用和磁盘空间的监控...',
    metadata: { source: 'prometheus-alerts.md', category: 'monitoring' },
    collection: 'orion-knowledge', dimensions: 1536, status: 'active',
    createdAt: '2026-04-22T09:00:00Z', updatedAt: '2026-04-22T09:00:00Z',
  },
  {
    id: 'doc-4', content: '数据库连接池优化建议：使用 PgBouncer 进行连接复用，设置合适的 pool_size...',
    metadata: { source: 'db-optimization.md', category: 'database' },
    collection: 'orion-knowledge', dimensions: 1536, status: 'processing',
    createdAt: '2026-04-25T16:00:00Z', updatedAt: '2026-04-25T16:00:00Z',
  },
];

const MOCK_SEARCH_RESULTS: SearchHit[] = [
  {
    id: 'doc-1', content: 'Orion 平台使用 Tekton 进行 CI/CD 流水线编排，支持多阶段构建和部署。Tekton 提供了原生的 Kubernetes 资源定义，使流水线可以无缝集成到集群环境中。',
    score: 0.92, metadata: { source: 'tekton-guide.md', category: 'pipeline' },
    collection: 'orion-knowledge',
  },
  {
    id: 'doc-2', content: 'Knative 自动扩缩容配置：通过设置 minScale 和 maxScale 控制实例数量，配合 HPA 实现基于请求量的弹性伸缩。',
    score: 0.85, metadata: { source: 'knative-scaling.md', category: 'deployment' },
    collection: 'orion-knowledge',
  },
  {
    id: 'doc-3', content: 'Prometheus 告警规则配置示例：针对 CPU 使用率、内存占用和磁盘空间的监控，设置合理的阈值和告警策略。',
    score: 0.78, metadata: { source: 'prometheus-alerts.md', category: 'monitoring' },
    collection: 'orion-knowledge',
  },
];

const MOCK_STATS: VectorStats = {
  documentCount: 8180,
  collectionCount: 5,
  totalEmbeddings: 8180,
  avgDimensions: 1152,
};

// ---- Main Component ----

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
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);

  // Search tab state
  const [searchText, setSearchText] = useState('');
  const [searchCollection, setSearchCollection] = useState<string | undefined>(undefined);
  const [searchTopK, setSearchTopK] = useState(5);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [_searchForm] = Form.useForm();

  // Upload tab state
  const [uploadContent, setUploadContent] = useState('');
  const [uploadCollection, setUploadCollection] = useState<string | undefined>(undefined);
  const [uploadMetadata, setUploadMetadata] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCollections();
      setCollections(Array.isArray(res.data?.data) ? res.data.data : MOCK_COLLECTIONS);
    } catch {
      setUsingMockData(true);
      setCollections(MOCK_COLLECTIONS);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await getVectorStats();
      setStats(res.data?.data || MOCK_STATS);
    } catch {
      setUsingMockData(true);
      setStats(MOCK_STATS);
    }
  };

  useEffect(() => { loadData(); loadStats(); }, []);

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

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await createCollection({
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        dimensions: parseInt(values.dimensions) || 1536,
        indexType: values.indexType || 'hnsw',
        distanceMetric: values.distanceMetric || 'cosine',
      });
      message.success('集合创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
      loadStats();
    } catch {
      message.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCollection = async (name: string) => {
    try {
      await deleteCollection(name);
      message.success('集合已删除');
      loadData();
      loadStats();
    } catch {
      message.error('删除失败');
    }
  };

  const openDetail = async (collection: VectorCollection) => {
    setSelectedCollection(collection);
    setDetailDrawerVisible(true);
    loadCollectionDocs(collection.name);
  };

  const loadCollectionDocs = async (name: string) => {
    setDocsLoading(true);
    try {
      const res = await getCollectionDocuments(name);
      setCollectionDocs(Array.isArray(res.data?.data) ? res.data.data : MOCK_DOCUMENTS);
    } catch {
      setCollectionDocs(MOCK_DOCUMENTS);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await deleteDocument(id);
      message.success('文档已删除');
      if (selectedCollection) loadCollectionDocs(selectedCollection.name);
    } catch {
      message.error('删除失败');
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
      setSearchResults(Array.isArray(res.data?.data) ? res.data.data : MOCK_SEARCH_RESULTS);
    } catch {
      setSearchResults(MOCK_SEARCH_RESULTS);
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
      let metadataObj: Record<string, any> | undefined;
      if (uploadMetadata.trim()) {
        try {
          metadataObj = JSON.parse(uploadMetadata);
        } catch {
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
      loadStats();
    } catch {
      message.error('上传失败');
    } finally {
      setUploadLoading(false);
    }
  };

  // ---- Table columns ----

  const collectionColumns: ColumnsType<VectorCollection> = [
    {
      title: '集合名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 180,
      render: (text: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => <Text type="secondary" style={{ fontSize: 12 }}>{text || '-'}</Text>,
    },
    {
      title: '文档数',
      dataIndex: 'documentCount',
      key: 'documentCount',
      width: 100,
      sorter: (a, b) => a.documentCount - b.documentCount,
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
      sorter: (a, b) => dayjs(a.updatedAt).unix() - dayjs(b.updatedAt).unix(),
      render: (val: string) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(val).fromNow()}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>详情</Button>
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

  const docColumns: ColumnsType<VectorDocument> = [
    {
      title: '文档内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (val: string, record) => (
        <Space direction="vertical" size={2}>
          <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, fontSize: 13 }}>
            {val}
          </Paragraph>
          {record.metadata && record.metadata.source && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              来源: <code>{record.metadata.source}</code>
              {record.metadata.category && ` | 分类: ${record.metadata.category}`}
            </Text>
          )}
        </Space>
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
      render: (val: number) => <Text code style={{ fontSize: 12 }}>{val}</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (val: string) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(val).fromNow()}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Popconfirm title="确认删除该文档？" onConfirm={() => handleDeleteDoc(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // ---- Detail Drawer Tabs ----

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
            <Descriptions.Item label="描述" span={2}>{c.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="文档数量">{c.documentCount.toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="向量维度">{c.dimensions}</Descriptions.Item>
            <Descriptions.Item label="索引类型">{indexTypeLabelMap[c.indexType] || c.indexType}</Descriptions.Item>
            <Descriptions.Item label="距离度量">{metricLabelMap[c.distanceMetric] || c.distanceMetric}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[c.status]}>{c.status === 'active' ? '活跃' : c.status === 'creating' ? '创建中' : '错误'}</Tag>
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
          <Spin spinning={docsLoading}>
            <AntTable<VectorDocument>
              columns={docColumns}
              dataSource={collectionDocs}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
            />
          </Spin>
        ),
      },
    ];
  }, [selectedCollection, collectionDocs, docsLoading]);

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <DatabaseOutlined style={{ marginRight: 8 }} />
            向量存储管理
          </Title>
          <Text type="secondary">管理向量集合、文档上传和语义相似度检索</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadData(); loadStats(); }} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建集合
          </Button>
        </Space>
      </div>

      {/* Mock data warning banner */}
      {usingMockData && (
        <Alert
          message="使用模拟数据"
          description="后端服务暂时不可用，当前显示的是模拟数据，可能不是最新状态。"
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => setUsingMockData(false)}
        />
      )}

      {/* Stats Panel */}
      {stats && (
        <Card size="small" style={{ marginBottom: 16 }}>
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

      {/* Main Content: Collection List + Functional Tabs */}
      <Row gutter={16}>
        {/* Left: Collection List */}
        <Col span={16}>
          <Card>
            <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
              <Input.Search
                placeholder="搜索集合..."
                allowClear
                style={{ maxWidth: 300 }}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <AntTable<VectorCollection>
              columns={collectionColumns}
              dataSource={filteredCollections}
              rowKey="name"
              loading={loading}
              size="middle"
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            />
          </Card>
        </Col>

        {/* Right: Search & Upload */}
        <Col span={8}>
          <Card title="相似度检索" style={{ marginBottom: 16 }}>
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
                  options={collections.filter((c) => c.status === 'active').map((c) => ({ label: c.displayName, value: c.name }))}
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
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={searchLoading} block>
                  语义搜索
                </Button>
              </Form.Item>
            </Form>

            {searchResults.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>搜索结果 ({searchResults.length} 条)</Text>
                {searchResults.map((hit, idx) => (
                  <Card size="small" key={hit.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Tag color={idx === 0 ? 'green' : idx === 1 ? 'blue' : 'default'}>
                        相似度 {(hit.score * 100).toFixed(1)}%
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {hit.collection}
                        {hit.metadata?.source && ` | ${hit.metadata.source}`}
                      </Text>
                    </div>
                    <Paragraph ellipsis={{ rows: 3 }} style={{ marginBottom: 0, fontSize: 12 }}>
                      {hit.content}
                    </Paragraph>
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
                  options={collections.filter((c) => c.status === 'active').map((c) => ({ label: c.displayName, value: c.name }))}
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
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={handleUpload}
                    loading={uploadLoading}
                  >
                    上传文档
                  </Button>
                  <Tooltip title="支持 .txt, .md, .json 等文本文件">
                    <Upload
                      accept=".txt,.md,.json,.yaml,.yml"
                      showUploadList={false}
                      beforeUpload={(file) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          const text = e.target?.result as string;
                          setUploadContent(text.substring(0, 10000));
                          setUploadMetadata(JSON.stringify({ source: file.name }, null, 2));
                          message.success(`文件 ${file.name} 已读取`);
                        };
                        reader.readAsText(file);
                        return false;
                      }}
                    >
                      <Button icon={<UploadOutlined />}>选择文件</Button>
                    </Upload>
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
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={560}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="集合名称 (唯一标识)" rules={[{ required: true, message: '请输入集合名称' }]}>
            <Input placeholder="如: my-knowledge-base" />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
            <Input placeholder="如: 我的知识库" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="集合描述..." />
          </Form.Item>
          <Form.Item
            name="dimensions"
            label="向量维度"
            rules={[{ required: true, message: '请输入向量维度' }]}
            tooltip="OpenAI embeddings 使用 1536 维度"
          >
            <Select options={[
              { label: '384 (all-MiniLM)', value: '384' },
              { label: '768 (BGE-base)', value: '768' },
              { label: '1024 (BGE-large)', value: '1024' },
              { label: '1536 (OpenAI/Ada)', value: '1536' },
              { label: '3072 (GTE-large)', value: '3072' },
            ]} />
          </Form.Item>
          <Form.Item name="indexType" label="索引类型" initialValue="hnsw">
            <Select options={[
              { label: 'HNSW (推荐)', value: 'hnsw' },
              { label: 'IVF_FLAT', value: 'ivf_flat' },
              { label: 'FLAT (精确)', value: 'flat' },
              { label: 'Annoy', value: 'annoy' },
            ]} />
          </Form.Item>
          <Form.Item name="distanceMetric" label="距离度量" initialValue="cosine">
            <Select options={[
              { label: '余弦相似度', value: 'cosine' },
              { label: '欧氏距离', value: 'euclidean' },
              { label: '点积', value: 'dot_product' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedCollection ? `${selectedCollection.displayName}` : '集合详情'}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={800}
        destroyOnClose
      >
        <Tabs items={detailTabs} />
      </Drawer>
    </div>
  );
};

export default VectorStorePage;
