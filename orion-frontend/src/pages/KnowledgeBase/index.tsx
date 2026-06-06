/**
 * AI 知识库管理页面 (Phase 4)
 * 知识条目 CRUD、搜索、分类浏览
 */
import _React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Card, Modal, Form, Input, Select, message,
  Table as _AntTable, Tag, Row, Col, Input as AntInput, Popconfirm, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, BookOutlined, FolderOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeListResponse {
  items: KnowledgeItem[];
  total: number;
}

interface KnowledgeSearchResponse {
  results: Array<{
    item: KnowledgeItem;
    similarity: number;
  }>;
}

// API calls — 使用 /api/v1/knowledge/docs 端点
async function fetchKnowledgeList(category?: string, limit = 50, offset = 0): Promise<KnowledgeListResponse> {
  const params = new URLSearchParams({ pageSize: String(limit), offset: String(offset) });
  if (category) params.set('tag', category);
  const res = await fetch(`/api/v1/knowledge/docs?${params}`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, 'x-tenant-id': '00000000-0000-0000-0000-000000000001' },
  });
  if (!res.ok) throw new Error(`Failed to fetch knowledge list (${res.status})`);
  const json = await res.json();
  return { items: (json.data || []).map((d: any) => ({
    id: d.id,
    title: d.title,
    content: d.content,
    category: d.type || 'default',
    tags: d.tags || [],
    createdBy: d.author_id || 'system',
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  })), total: json.meta?.total || 0 };
}

async function fetchKnowledgeCategories(): Promise<string[]> {
  const res = await fetch('/api/v1/knowledge/docs/tags', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, 'x-tenant-id': '00000000-0000-0000-0000-000000000001' },
  });
  if (!res.ok) throw new Error(`Failed to fetch categories (${res.status})`);
  const json = await res.json();
  return json.data || [];
}

async function searchKnowledge(q: string, limit = 10): Promise<KnowledgeSearchResponse> {
  const res = await fetch('/api/v1/knowledge/rag/retrieve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, 'x-tenant-id': '00000000-0000-0000-0000-000000000001' },
    body: JSON.stringify({ query: q, topK: limit }),
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const json = await res.json();
  return { results: (json.data?.results || []).map((r: any) => ({
    item: { id: r.docId, title: r.title, content: r.snippet, category: '', tags: [], createdBy: '', createdAt: '', updatedAt: '' },
    similarity: r.score,
  })) };
}

async function createKnowledge(data: { title: string; content: string; category: string; tags: string[] }): Promise<KnowledgeItem> {
  // Need a space_id — use the first available space or create one
  const res = await fetch('/api/v1/knowledge/docs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, 'x-tenant-id': '00000000-0000-0000-0000-000000000001' },
    body: JSON.stringify({ title: data.title, content: data.content, spaceId: 'default', tags: data.tags, status: 'draft' }),
  });
  if (!res.ok) throw new Error(`Failed to create (${res.status})`);
  const json = await res.json();
  const d = json.data;
  return { id: d.id, title: d.title, content: d.content, category: d.type, tags: d.tags || [], createdBy: d.author_id, createdAt: d.created_at, updatedAt: d.updated_at };
}

async function updateKnowledge(id: string, data: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
  const res = await fetch(`/api/v1/knowledge/docs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, 'x-tenant-id': '00000000-0000-0000-0000-000000000001' },
    body: JSON.stringify({ title: data.title, content: data.content, tags: data.tags }),
  });
  if (!res.ok) throw new Error(`Failed to update (${res.status})`);
  const json = await res.json();
  const d = json.data;
  return { id: d.id, title: d.title, content: d.content, category: d.type, tags: d.tags || [], createdBy: d.author_id, createdAt: d.created_at, updatedAt: d.updated_at };
}

async function deleteKnowledge(id: string): Promise<void> {
  const res = await fetch(`/api/v1/knowledge/docs/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, 'x-tenant-id': '00000000-0000-0000-0000-000000000001' },
  });
  if (!res.ok) throw new Error(`Failed to delete (${res.status})`);
}

export default function KnowledgeBase() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<KnowledgeItem | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, catRes] = await Promise.all([
        fetchKnowledgeList(selectedCategory),
        fetchKnowledgeCategories(),
      ]);
      setItems(listRes.items);
      setCategories(catRes);
    } catch (error) {
      message.error(`加载失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    setLoading(true);
    try {
      const res = await searchKnowledge(searchQuery);
      setItems(res.results.map((r) => r.item));
    } catch (error) {
      message.error(`搜索失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await createKnowledge({
        title: values.title,
        content: values.content,
        category: values.category,
        tags: values.tags || [],
      });
      message.success('创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`创建失败：${(error as Error).message}`);
      }
    }
  };

  const handleEdit = async () => {
    if (!editItem) return;
    try {
      const values = await editForm.validateFields();
      await updateKnowledge(editItem.id, {
        title: values.title,
        content: values.content,
        category: values.category,
        tags: values.tags || [],
      });
      message.success('更新成功');
      setEditModalVisible(false);
      setEditItem(null);
      loadData();
    } catch (error) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`更新失败：${(error as Error).message}`);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKnowledge(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error(`删除失败：${(error as Error).message}`);
    }
  };

  const openEdit = (record: KnowledgeItem) => {
    setEditItem(record);
    editForm.setFieldsValue({
      title: record.title,
      content: record.content,
      category: record.category,
      tags: record.tags,
    });
    setEditModalVisible(true);
  };

  const columns: TableColumn<KnowledgeItem>[] = [
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      width: 250,
      render: (value: unknown) => <Text strong>{String(value)}</Text>,
    },
    {
      key: 'category',
      title: '分类',
      width: 120,
      render: (_: unknown, record: KnowledgeItem) => (
        <Tag icon={<FolderOutlined />} color="blue">{record.category}</Tag>
      ),
    },
    {
      key: 'tags',
      title: '标签',
      width: 200,
      render: (_: unknown, record: KnowledgeItem) => (
        <Space wrap>
          {record.tags.map((tag, i) => (
            <Tag key={i}>{tag}</Tag>
          ))}
        </Space>
      ),
    },
    {
      key: 'createdBy',
      title: '创建人',
      dataIndex: 'createdBy',
      width: 100,
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (value: unknown) => dayjs(String(value)).format('YYYY-MM-DD HH:mm'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record: KnowledgeItem) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[6] }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BookOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            AI 知识库
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>知识沉淀与智能检索</Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新建知识
          </Button>
        </Space>
      </div>

      {/* Search & Filter */}
      <Card style={{ marginBottom: spacing[4] }}>
        <Row gutter={spacing[4]}>
          <Col span={12}>
            <AntInput.Search
              placeholder="搜索知识库..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearch}
              enterButton={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="选择分类"
              value={selectedCategory}
              onChange={(v) => { setSelectedCategory(v); setSearchQuery(''); }}
              allowClear
              options={categories.map((c) => ({ label: c, value: c }))}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table columns={columns} dataSource={items} loading={loading} rowKey="id" size="middle" striped />
      </Card>

      {/* Create Modal */}
      <Modal
        title="新建知识条目"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => setCreateModalVisible(false)}
        width={600}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="知识条目标题" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择或输入分类' }]}>
            <Select
              showSearch
              placeholder="选择或输入新分类"
              options={categories.map((c) => ({ label: c, value: c }))}
            />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <TextArea rows={6} placeholder="知识内容..." />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑知识条目"
        open={editModalVisible}
        onOk={handleEdit}
        onCancel={() => { setEditModalVisible(false); setEditItem(null); }}
        width={600}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={categories.map((c) => ({ label: c, value: c }))} />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <TextArea rows={6} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
