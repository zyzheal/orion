/**
 * PandaWiki Knowledge Base Page
 * Manage knowledge spaces, documents, and search
 * Three-tab layout: 知识库空间 | 文档管理 | 搜索
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Spin,
  Popconfirm,
  Statistic,
  Row,
  Col,
  List,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  BookOutlined,
  FileTextOutlined,
  SearchOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import {
  listSpaces,
  createSpace,
  deleteSpace,
  listDocuments,
  createDocument,
  deleteDocument,
  searchDocuments,
  type WikiSpace,
  type WikiDocument,
  type CreateSpaceInput,
  type CreateDocumentInput,
  type SearchResult,
} from '@/api/pandawiki';
import { colors } from '@/tokens/colors';

const { Title, Text, Paragraph } = Typography;

// ---- Main Component ----

const PandawikiPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('spaces');

  // Spaces state
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spaceModalVisible, setSpaceModalVisible] = useState(false);
  const [spaceForm] = Form.useForm();
  const [spaceSubmitting, setSpaceSubmitting] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<WikiDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [docForm] = Form.useForm();
  const [docSubmitting, setDocSubmitting] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSpaceId, setSearchSpaceId] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // ---- Data Loading ----

  const loadSpaces = async () => {
    setSpacesLoading(true);
    try {
      const res = await listSpaces();
      const list = res.data?.data?.spaces;
      setSpaces(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setSpaces([]);
      message.error(`加载知识库空间失败: ${(error as Error).message}`);
    } finally {
      setSpacesLoading(false);
    }
  };

  const loadDocuments = async (spaceId: string) => {
    if (!spaceId) return;
    setDocsLoading(true);
    try {
      const res = await listDocuments(spaceId);
      const list = res.data?.data?.documents;
      setDocuments(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setDocuments([]);
      message.error(`加载文档列表失败: ${(error as Error).message}`);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadSpaces().finally(() => setLoading(false));
  }, []);

  // Reload documents when selected space changes
  useEffect(() => {
    if (selectedSpaceId && activeTab === 'documents') {
      loadDocuments(selectedSpaceId);
    }
  }, [selectedSpaceId, activeTab]);

  // ---- Space Handlers ----

  const handleCreateSpace = async () => {
    try {
      const values = await spaceForm.validateFields();
      setSpaceSubmitting(true);
      const payload: CreateSpaceInput = {
        name: values.name,
        description: values.description || '',
      };
      await createSpace(payload);
      message.success('知识库空间创建成功');
      setSpaceModalVisible(false);
      spaceForm.resetFields();
      loadSpaces();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSpaceSubmitting(false);
    }
  };

  const handleDeleteSpace = async (id: string) => {
    try {
      await deleteSpace(id);
      message.success('知识库空间已删除');
      if (selectedSpaceId === id) {
        setSelectedSpaceId('');
        setDocuments([]);
      }
      loadSpaces();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  // ---- Document Handlers ----

  const handleCreateDocument = async () => {
    try {
      const values = await docForm.validateFields();
      setDocSubmitting(true);
      const payload: CreateDocumentInput = {
        title: values.title,
        content: values.content,
        parentId: values.parentId || undefined,
      };
      await createDocument(selectedSpaceId, payload);
      message.success('文档创建成功');
      setDocModalVisible(false);
      docForm.resetFields();
      loadDocuments(selectedSpaceId);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setDocSubmitting(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await deleteDocument(selectedSpaceId, docId);
      message.success('文档已删除');
      loadDocuments(selectedSpaceId);
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  // ---- Search Handler ----

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }
    setSearching(true);
    try {
      const res = await searchDocuments(searchQuery, searchSpaceId || undefined);
      const list = res.data?.data?.results;
      setSearchResults(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setSearchResults([]);
      message.error(`搜索失败: ${(error as Error).message}`);
    } finally {
      setSearching(false);
    }
  };

  // ---- Stats ----

  const spaceStats = {
    total: spaces.length,
    totalDocs: spaces.reduce((sum, s) => sum + (s.documentCount || 0), 0),
  };

  // ---- Space Table Columns ----

  const spaceColumns: TableColumn<WikiSpace>[] = [
    {
      key: 'name',
      title: '空间名称',
      dataIndex: 'name',
      width: 200,
      render: (v: unknown) => (
        <Space>
          <BookOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{String(v)}</Text>
        </Space>
      ),
    },
    {
      key: 'description',
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
    },
    {
      key: 'documentCount',
      title: '文档数',
      dataIndex: 'documentCount',
      width: 100,
      render: (v: unknown) => (
        <Tag color="blue">{typeof v === 'number' ? v : 0}</Tag>
      ),
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record: WikiSpace) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedSpaceId(record.id);
              setActiveTab('documents');
            }}
          >
            查看文档
          </Button>
          <Popconfirm
            title="确认删除此知识库空间？关联文档将被一并删除。"
            onConfirm={() => handleDeleteSpace(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ---- Document Table Columns ----

  const documentColumns: TableColumn<WikiDocument>[] = [
    {
      key: 'title',
      title: '文档标题',
      dataIndex: 'title',
      width: 300,
      render: (v: unknown) => (
        <Space>
          <FileTextOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{String(v)}</Text>
        </Space>
      ),
    },
    {
      key: 'content',
      title: '内容预览',
      dataIndex: 'content',
      ellipsis: true,
      render: (v: unknown) => {
        const text = String(v);
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {text.slice(0, 80)}
            {text.length > 80 ? '...' : ''}
          </Text>
        );
      },
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: WikiDocument) => (
        <Popconfirm
          title="确认删除此文档？"
          onConfirm={() => handleDeleteDocument(record.id)}
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // ---- Tab Items ----

  const spacesTab = (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card size="small">
            <Statistic
              title="知识库空间总数"
              value={spaceStats.total}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <Statistic
              title="文档总数"
              value={spaceStats.totalDocs}
              valueStyle={{ color: colors.primary[500] }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadSpaces}
            loading={spacesLoading}
          >
            刷新
          </Button>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setSpaceModalVisible(true)}
        >
          新建知识库空间
        </Button>
      </div>

      {/* Spaces Table */}
      <Table
        columns={spaceColumns}
        dataSource={spaces}
        loading={spacesLoading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Create Space Modal */}
      <Modal
        title="新建知识库空间"
        open={spaceModalVisible}
        onCancel={() => {
          setSpaceModalVisible(false);
          spaceForm.resetFields();
        }}
        onOk={handleCreateSpace}
        confirmLoading={spaceSubmitting}
        width={500}
        destroyOnClose
      >
        <Form form={spaceForm} layout="vertical">
          <Form.Item
            name="name"
            label="空间名称"
            rules={[{ required: true, message: '请输入空间名称' }]}
          >
            <Input placeholder="如: 技术文档库" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea
              rows={3}
              placeholder="描述该知识库空间的用途..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  const documentsTab = (
    <div>
      {/* Space Selector */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>选择知识库空间:</Text>
          <Select
            style={{ width: 300 }}
            value={selectedSpaceId || undefined}
            onChange={(v) => setSelectedSpaceId(v)}
            placeholder="请选择一个空间"
            options={spaces.map((s) => ({ label: s.name, value: s.id }))}
            loading={spacesLoading}
            allowClear
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => selectedSpaceId && loadDocuments(selectedSpaceId)}
            loading={docsLoading}
            disabled={!selectedSpaceId}
          >
            刷新
          </Button>
        </Space>
      </div>

      {selectedSpaceId ? (
        <>
          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setDocModalVisible(true)}
            >
              新建文档
            </Button>
          </div>

          {/* Documents Table */}
          <Table
            columns={documentColumns}
            dataSource={documents}
            loading={docsLoading}
            rowKey="id"
            size="middle"
            striped
          />

          {/* Create Document Modal */}
          <Modal
            title="新建文档"
            open={docModalVisible}
            onCancel={() => {
              setDocModalVisible(false);
              docForm.resetFields();
            }}
            onOk={handleCreateDocument}
            confirmLoading={docSubmitting}
            width={700}
            destroyOnClose
          >
            <Form form={docForm} layout="vertical">
              <Form.Item
                name="title"
                label="文档标题"
                rules={[{ required: true, message: '请输入文档标题' }]}
              >
                <Input placeholder="如: 项目架构说明" />
              </Form.Item>
              <Form.Item
                name="content"
                label="文档内容"
                rules={[{ required: true, message: '请输入文档内容' }]}
              >
                <Input.TextArea rows={10} placeholder="输入文档内容（支持 Markdown）..." />
              </Form.Item>
            </Form>
          </Modal>
        </>
      ) : (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <BookOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
          <p style={{ marginTop: 16, color: colors.neutral[500] }}>
            请先选择一个知识库空间
          </p>
        </Card>
      )}
    </div>
  );

  const searchTab = (
    <div>
      {/* Search Box */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%' }}>
          <Input
            style={{ flex: 1, maxWidth: 500 }}
            placeholder="输入关键词搜索知识库..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
            allowClear
          />
          <Select
            style={{ width: 200 }}
            value={searchSpaceId || undefined}
            onChange={(v) => setSearchSpaceId(v)}
            placeholder="全部空间"
            options={[{ label: '全部空间', value: '' }, ...spaces.map((s) => ({ label: s.name, value: s.id }))]}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={searching}
          >
            搜索
          </Button>
        </Space>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 ? (
        <div>
          <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
            找到 {searchResults.length} 条结果
          </Text>
          <List
            dataSource={searchResults}
            renderItem={(item: SearchResult) => (
              <List.Item>
                <Card size="small" style={{ width: '100%' }} hoverable>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <FileTextOutlined style={{ color: colors.primary[500] }} />
                      <Text strong>{item.title}</Text>
                      <Tag color="geekblue">
                        {spaces.find((s) => s.id === item.spaceId)?.name || item.spaceId}
                      </Tag>
                      <Tag color="orange">
                        相关度: {(item.score * 100).toFixed(1)}%
                      </Tag>
                    </Space>
                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      style={{ marginBottom: 0, marginLeft: 24 }}
                    >
                      {item.content}
                    </Paragraph>
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        </div>
      ) : searching ? null : (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <SearchOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
          <p style={{ marginTop: 16, color: colors.neutral[500] }}>
            输入关键词开始搜索知识库
          </p>
        </Card>
      )}
    </div>
  );

  const tabItems = [
    {
      key: 'spaces',
      label: (
        <span>
          <BookOutlined /> 知识库空间
        </span>
      ),
      children: spacesTab,
    },
    {
      key: 'documents',
      label: (
        <span>
          <FileTextOutlined /> 文档管理
        </span>
      ),
      children: documentsTab,
    },
    {
      key: 'search',
      label: (
        <span>
          <SearchOutlined /> 搜索
        </span>
      ),
      children: searchTab,
    },
  ];

  const isInitialLoading = loading && spaces.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading ? (
        <PageSkeleton cards={4} rows={8} />
      ) : (
        <>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <Title level={2} style={{ marginBottom: 8 }}>
              <BookOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
              PandaWiki 知识库
            </Title>
            <Text type="secondary">管理知识库空间、文档和全文搜索</Text>
          </div>

          {/* Tabs */}
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
        </>
      )}
    </div>
  );
};

export default PandawikiPage;
