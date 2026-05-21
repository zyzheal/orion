/**
 * Developer Portal Page
 *
 * Central hub for API documentation, SDK downloads, getting started guides,
 * and developer resources. Backed by PortalDocumentService (PostgreSQL).
 *
 * Features:
 * - Tabbed navigation: API Docs, SDK Downloads, Getting Started, Resources
 * - Full-text search across all documents
 * - Document CRUD operations (create, edit, delete)
 * - Publish/unpublish workflow
 * - Category filtering and tag display
 * - Popular documents showcase
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Tabs,
  Tag,
  Badge,
  Input,
  message,
  Descriptions,
  Typography,
  Space,
  Modal,
  Form,
  Select,
  Drawer,
  Alert,
  Row,
  Col,
  Statistic,
  Empty,
  Popconfirm,
} from 'antd';
import {
  ApiOutlined,
  DownloadOutlined,
  RocketOutlined,
  FileTextOutlined,
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CloudUploadOutlined,
  StarOutlined,
  ThunderboltOutlined,
  CodeOutlined,} from '@ant-design/icons';
import {
  developerPortalApi,
  PortalDocument,
  PortalDocumentCreateRequest,
  PortalDocumentUpdateRequest,
  CategoryInfo,
} from '../../api/developer-portal';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

// Document type configuration
const documentTypeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  api_doc: { label: 'API 文档', color: 'blue', icon: <ApiOutlined /> },
  sdk: { label: 'SDK', color: 'green', icon: <DownloadOutlined /> },
  guide: { label: '指南', color: 'orange', icon: <RocketOutlined /> },
  tutorial: { label: '教程', color: 'purple', icon: <FileTextOutlined /> },
  reference: { label: '参考', color: 'cyan', icon: <FileTextOutlined /> },
  sample: { label: '示例', color: 'gold', icon: <ThunderboltOutlined /> },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  published: { label: '已发布', color: 'green' },
  draft: { label: '草稿', color: 'default' },
};

// Tab definitions
const TAB_KEYS = {
  ALL: 'all',
  API_DOCS: 'api-docs',
  SDK_DOWNLOADS: 'sdk-downloads',
  GETTING_STARTED: 'getting-started',
  RESOURCES: 'resources',
};

const DeveloperPortalPage: React.FC = () => {
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [popularDocs, setPopularDocs] = useState<PortalDocument[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState(TAB_KEYS.ALL);
  const [createModal, setCreateModal] = useState(false);
  const [editDrawer, setEditDrawer] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<PortalDocument | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  useEffect(() => {
    loadData();
    loadCategories();
    loadPopular();
  }, []);

  const loadData = async (params?: { page?: number; pageSize?: number; search?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const listParams: Record<string, unknown> = {
        page: params?.page || pagination.current,
        perPage: params?.pageSize || pagination.pageSize,
      };

      if (params?.search) {
        const searchResp = await developerPortalApi.searchDocuments(params.search);
        setDocuments(searchResp.data || []);
        setPagination((prev) => ({ ...prev, total: searchResp.total || 0 }));
      } else {
        const listResp = await developerPortalApi.listDocuments(listParams);
        setDocuments(listResp.data || []);
        setPagination((prev) => ({ ...prev, total: listResp.total || 0 }));
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || '未知错误';
      setError(`加载文档失败: ${errorMsg}`);
      message.error(`加载文档失败: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const resp = await developerPortalApi.getCategories();
      setCategories(resp.data || []);
    } catch {
      // Silently fail - categories are non-critical
    }
  };

  const loadPopular = async () => {
    try {
      const resp = await developerPortalApi.getPopularDocuments(5);
      setPopularDocs(resp.data || []);
    } catch {
      // Silently fail
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    if (value.trim()) {
      loadData({ search: value.trim(), page: 1 });
    } else {
      loadData({ page: 1 });
    }
  };

  const handleRefresh = () => {
    loadData({ search: searchText || undefined, page: pagination.current });
    loadCategories();
    loadPopular();
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const payload: PortalDocumentCreateRequest = {
        title: values.title as string,
        slug: values.slug as string,
        content: values.content as string,
        contentFormat: (values.contentFormat as string) || 'markdown',
        documentType: values.documentType as string,
        category: values.category as string | undefined,
        tags: (values.tags as string[]) || [],
        version: values.version as string | undefined,
      };
      await developerPortalApi.createDocument(payload);
      message.success('文档创建成功');
      setCreateModal(false);
      form.resetFields();
      handleRefresh();
    } catch (err: unknown) {
      message.error(`创建失败: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (values: Record<string, unknown>) => {
    if (!selectedDoc) return;
    setSubmitting(true);
    try {
      const payload: PortalDocumentUpdateRequest = {
        title: values.title as string,
        slug: values.slug as string,
        content: values.content as string,
        documentType: values.documentType as string,
        category: values.category as string | undefined,
        tags: (values.tags as string[]) || [],
      };
      await developerPortalApi.updateDocument(selectedDoc.id, payload);
      message.success('文档更新成功');
      setEditDrawer(false);
      editForm.resetFields();
      handleRefresh();
    } catch (err: unknown) {
      message.error(`更新失败: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await developerPortalApi.deleteDocument(id);
      message.success('文档已删除');
      handleRefresh();
    } catch (err: unknown) {
      message.error(`删除失败: ${(err as Error).message}`);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await developerPortalApi.publishDocument(id);
      message.success('文档已发布');
      handleRefresh();
    } catch (err: unknown) {
      message.error(`发布失败: ${(err as Error).message}`);
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await developerPortalApi.unpublishDocument(id);
      message.success('文档已取消发布');
      handleRefresh();
    } catch (err: unknown) {
      message.error(`取消发布失败: ${(err as Error).message}`);
    }
  };

  const openDetail = (doc: PortalDocument) => {
    setSelectedDoc(doc);
    setDetailDrawer(true);
  };

  const openEdit = (doc: PortalDocument) => {
    setSelectedDoc(doc);
    editForm.setFieldsValue({
      title: doc.title,
      slug: doc.slug,
      content: doc.content,
      documentType: doc.documentType,
      category: doc.category,
      tags: doc.tags,
    });
    setEditDrawer(true);
  };

  // Filter documents by tab
  const filteredDocuments = useMemo(() => {
    switch (activeTab) {
      case TAB_KEYS.API_DOCS:
        return documents.filter((d) => d.documentType === 'api_doc' || d.documentType === 'reference');
      case TAB_KEYS.SDK_DOWNLOADS:
        return documents.filter((d) => d.documentType === 'sdk' || d.documentType === 'sample');
      case TAB_KEYS.GETTING_STARTED:
        return documents.filter((d) => d.documentType === 'guide' || d.documentType === 'tutorial');
      case TAB_KEYS.RESOURCES:
        return documents.filter((d) => !['api_doc', 'sdk', 'guide', 'tutorial', 'reference', 'sample'].includes(d.documentType));
      default:
        return documents;
    }
  }, [documents, activeTab]);

  // Stats
  const stats = useMemo(
    () => ({
      total: documents.length,
      published: documents.filter((d) => d.published).length,
      draft: documents.filter((d) => !d.published).length,
      categories: categories.length,
    }),
    [documents, categories]
  );

  // Table columns
  const columns: ColumnsType<PortalDocument> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      render: (text: string, record: PortalDocument) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: '#1677ff' }}
            onClick={() => openDetail(record)}
          >
            {documentTypeConfig[record.documentType]?.icon}
            <span style={{ marginLeft: 6 }}>{text}</span>
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.slug}
          </Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'documentType',
      key: 'documentType',
      width: 100,
      render: (type: string) => {
        const cfg = documentTypeConfig[type] || { label: type, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (cat: string) => cat || <Text type="secondary">未分类</Text>,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 180,
      render: (tags: string[]) => (
        <Space wrap>
          {(tags || []).slice(0, 2).map((t: string, i: number) => (
            <Tag key={i}>{t}</Tag>
          ))}
          {(tags || []).length > 2 && <Tag>+{(tags || []).length - 2}</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'published',
      key: 'published',
      width: 90,
      render: (published: boolean) => {
        const cfg = published ? statusConfig.published : statusConfig.draft;
        return <Badge status={published ? 'success' : 'default'} text={cfg.label} />;
      },
    },
    {
      title: '帮助数',
      dataIndex: 'helpfulCount',
      key: 'helpfulCount',
      width: 80,
      render: (count: number) => (
        <Text>
          <StarOutlined style={{ color: '#faad14', marginRight: 4 }} />
          {count || 0}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: PortalDocument) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="确认删除此文档？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Tab items
  const tabItems = [
    {
      key: TAB_KEYS.ALL,
      label: (
        <span>
          <FileTextOutlined /> 全部文档
        </span>
      ),
    },
    {
      key: TAB_KEYS.API_DOCS,
      label: (
        <span>
          <ApiOutlined /> API 文档
        </span>
      ),
    },
    {
      key: TAB_KEYS.SDK_DOWNLOADS,
      label: (
        <span>
          <DownloadOutlined /> SDK 下载
        </span>
      ),
    },
    {
      key: TAB_KEYS.GETTING_STARTED,
      label: (
        <span>
          <RocketOutlined /> 入门指南
        </span>
      ),
    },
    {
      key: TAB_KEYS.RESOURCES,
      label: (
        <span>
          <FileTextOutlined /> 其他资源
        </span>
      ),
    },
  ];

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
          <Title level={2} style={{ marginBottom: 8 }}>
            <CodeOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            <ApiOutlined style={{ marginRight: 8 }} />
            开发者门户
          </Title>
          <Text type="secondary">API 文档、SDK 下载、入门指南与开发者资源</Text>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setCreateModal(true);
            }}
          >
            创建文档
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Error display */}
      {error && (
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Search Bar */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <Search
              placeholder="搜索 API 文档、SDK、指南..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={handleSearch}
            />
          </Col>
          <Col span={12}>
            <Space wrap style={{ justifyContent: 'flex-end' }}>
              {categories.slice(0, 5).map((cat) => (
                <Tag key={cat.name} style={{ cursor: 'pointer' }}>
                  {cat.name} ({cat.count})
                </Tag>
              ))}
              {categories.length > 5 && <Tag>+{categories.length - 5}</Tag>}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="文档总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已发布"
              value={stats.published}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="草稿"
              value={stats.draft}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="分类数" value={stats.categories} />
          </Card>
        </Col>
      </Row>

      {/* Popular Documents */}
      {popularDocs.length > 0 && (
        <Card
          title={
            <>
              <StarOutlined style={{ marginRight: 8, color: '#faad14' }} />
              热门文档
            </>
          }
          style={{ marginBottom: 24 }}
          bodyStyle={{ padding: '12px 24px' }}
        >
          <Space wrap>
            {popularDocs.map((doc) => (
              <Tag
                key={doc.id}
                color="blue"
                style={{ cursor: 'pointer', padding: '4px 12px' }}
                onClick={() => openDetail(doc)}
              >
                {doc.title}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {/* Main Content with Tabs */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

        <Table
          columns={columns}
          dataSource={filteredDocuments}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  searchText
                    ? `未找到匹配 "${searchText}" 的文档`
                    : '暂无文档数据，点击"创建文档"开始添加'
                }
              >
                {!searchText && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      form.resetFields();
                      setCreateModal(true);
                    }}
                  >
                    创建文档
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      </Card>

      {/* Create Document Modal */}
      <Modal
        title={
          <>
            <CloudUploadOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            创建文档
          </>
        }
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="如: Orion Pipeline API 参考" />
          </Form.Item>
          <Form.Item
            name="slug"
            label="URL 别名"
            rules={[{ required: true, message: '请输入 URL 别名' }]}
          >
            <Input placeholder="如: pipeline-api-reference" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="documentType"
                label="文档类型"
                rules={[{ required: true, message: '请选择文档类型' }]}
              >
                <Select
                  placeholder="选择类型"
                  options={Object.entries(documentTypeConfig).map(([k, v]) => ({
                    value: k,
                    label: v.label,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Select
                  placeholder="选择分类"
                  options={categories.map((c) => ({ value: c.name, label: c.name }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="contentFormat" label="内容格式" initialValue="markdown">
            <Select
              options={[
                { value: 'markdown', label: 'Markdown' },
                { value: 'html', label: 'HTML' },
                { value: 'plain', label: '纯文本' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <Input.TextArea rows={6} placeholder="输入文档内容（支持 Markdown）..." />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              placeholder="输入标签后回车"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="version" label="版本">
            <Input placeholder="如: v1.0.0" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Document Drawer */}
      <Drawer
        title={
          <>
            <EditOutlined style={{ marginRight: 8 }} />
            编辑文档
          </>
        }
        open={editDrawer}
        onClose={() => setEditDrawer(false)}
        width={720}
        destroyOnClose
        extra={
          <Space>
            {selectedDoc && (
              <>
                {selectedDoc.published ? (
                  <Button onClick={() => handleUnpublish(selectedDoc.id)}>
                    取消发布
                  </Button>
                ) : (
                  <Button type="primary" onClick={() => handlePublish(selectedDoc.id)}>
                    发布
                  </Button>
                )}
              </>
            )}
            <Button onClick={() => editForm.submit()} loading={submitting} type="primary">
              保存
            </Button>
          </Space>
        }
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="slug"
            label="URL 别名"
            rules={[{ required: true, message: '请输入 URL 别名' }]}
          >
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="documentType"
                label="文档类型"
                rules={[{ required: true, message: '请选择文档类型' }]}
              >
                <Select
                  options={Object.entries(documentTypeConfig).map(([k, v]) => ({
                    value: k,
                    label: v.label,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Select
                  options={categories.map((c) => ({ value: c.name, label: c.name }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <Input.TextArea rows={10} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        title={selectedDoc?.title || '文档详情'}
        open={detailDrawer}
        onClose={() => setDetailDrawer(false)}
        width={720}
        destroyOnClose
        extra={
          <Space>
            {selectedDoc && (
              <>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    setDetailDrawer(false);
                    openEdit(selectedDoc);
                  }}
                >
                  编辑
                </Button>
                {selectedDoc.published ? (
                  <Popconfirm title="确认取消发布？" onConfirm={() => handleUnpublish(selectedDoc.id)}>
                    <Button danger>取消发布</Button>
                  </Popconfirm>
                ) : (
                  <Popconfirm title="确认发布？" onConfirm={() => handlePublish(selectedDoc.id)}>
                    <Button type="primary" icon={<CloudUploadOutlined />}>
                      发布
                    </Button>
                  </Popconfirm>
                )}
              </>
            )}
          </Space>
        }
      >
        {selectedDoc && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="标题" span={2}>
                {selectedDoc.title}
              </Descriptions.Item>
              <Descriptions.Item label="URL 别名" span={2}>
                <Text code>{selectedDoc.slug}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="文档类型">
                {(() => {
                  const cfg = documentTypeConfig[selectedDoc.documentType] || { label: selectedDoc.documentType, color: 'default' };
                  return <Tag color={cfg.color}>{cfg.label}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {selectedDoc.published ? (
                  <Tag color="green">已发布</Tag>
                ) : (
                  <Tag color="default">草稿</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="分类">
                {selectedDoc.category || '未分类'}
              </Descriptions.Item>
              <Descriptions.Item label="版本">
                {selectedDoc.version || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="标签" span={2}>
                <Space wrap>
                  {(selectedDoc.tags || []).map((t: string, i: number) => (
                    <Tag key={i}>{t}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="帮助数">
                <StarOutlined style={{ color: '#faad14' }} /> {selectedDoc.helpfulCount || 0}
              </Descriptions.Item>
              <Descriptions.Item label="作者">
                {selectedDoc.authorId}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {new Date(selectedDoc.createdAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间" span={2}>
                {new Date(selectedDoc.updatedAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>

            {/* Content Preview */}
            <Card size="small" title="内容预览">
              <Paragraph>
                {selectedDoc.content?.substring(0, 500) || '无内容'}
                {(selectedDoc.content?.length || 0) > 500 && '...'}
              </Paragraph>
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default DeveloperPortalPage;
