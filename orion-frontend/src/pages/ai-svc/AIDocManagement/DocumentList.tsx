/**
 * Document List - Document table with search, filter by space/tag, CRUD
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getDocs,
  createDoc,
  updateDoc,
  deleteDoc,
  getSpaces,
  type Document,
  type DocumentInput,
} from '@/api/ai-docs';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const DocumentListPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [docRes, spaceRes] = await Promise.all([getDocs(), getSpaces()]);
      setDocuments(Array.isArray(docRes.data) ? docRes.data : []);
      const spaceList = Array.isArray(spaceRes.data) ? spaceRes.data : [];
      setSpaces(spaceList.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    } catch (error: unknown) {
      setDocuments([]);
      setSpaces([]);
      message.error(`加载文档数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!doc.title.toLowerCase().includes(q)) return false;
      }
      if (filters.spaceId && filters.spaceId !== 'all' && doc.spaceId !== filters.spaceId)
        return false;
      if (filters.status && filters.status !== 'all' && doc.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, documents]);

  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput]);
      setTagInput('');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: DocumentInput = {
        spaceId: values.spaceId,
        title: values.title,
        content: values.content,
        tags,
      };
      await createDoc(payload);
      message.success('文档创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      setTags([]);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '创建失败';
        message.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingDoc) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await updateDoc(editingDoc.id, {
        title: values.title,
        content: values.content,
        status: values.status,
      });
      message.success('文档更新成功');
      setEditModalVisible(false);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '更新失败';
        message.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(id);
      message.success('文档已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const openEdit = (doc: Document) => {
    setEditingDoc(doc);
    editForm.setFieldsValue({ title: doc.title, content: doc.content, status: doc.status });
    setEditModalVisible(true);
  };

  const getSpaceName = (spaceId: string) => spaces.find((s) => s.id === spaceId)?.name || spaceId;

  const columns: TableColumn<Document>[] = [
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      width: 220,
      sortable: true,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'space',
      title: '知识库',
      dataIndex: 'spaceId',
      width: 140,
      render: (v: unknown) => <Tag color="blue">{getSpaceName(String(v))}</Tag>,
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 60,
      render: (v: unknown) => <Tag>v{String(v)}</Tag>,
    },
    {
      key: 'tags',
      title: '标签',
      dataIndex: 'tags',
      width: 160,
      render: (v: unknown) => (
        <Space size={4} wrap>
          {Array.isArray(v) ? v.map((t) => <Tag key={t}>{t}</Tag>) : null}
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => {
        const status = String(v);
        const badgeStatus: 'running' | 'pending' | 'success' | 'failed' | 'warning' | 'cancelled' | 'unknown' =
          status === 'archived' ? 'cancelled' : status === 'published' ? 'success' : 'pending';
        return <StatusBadge status={badgeStatus} size="small" />;
      },
    },
    {
      key: 'authorId',
      title: '作者',
      dataIndex: 'authorId',
      width: 100,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_: unknown, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setViewingDoc(record);
              setViewModalVisible(true);
            }}
          >
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const spaceOptions = [
    { label: '全部', value: 'all' },
    ...spaces.map((s) => ({ label: s.name, value: s.id })),
  ];

  const filterDefs: FilterDefinition[] = [
    { key: 'spaceId', label: '知识库', options: spaceOptions },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
    },
  ];

  return (
    <div style={{ padding: 0 }}>
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
            <FileTextOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            文档管理
          </Title>
          <Text type="secondary">知识库文档浏览与管理</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建文档
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ marginBottom: spacing.md }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索文档..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredDocuments}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建文档"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="spaceId" label="知识库" rules={[{ required: true }]}>
            <Select options={spaces.map((s) => ({ label: s.name, value: s.id }))} />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="文档标题" />
          </Form.Item>
          <Form.Item label="标签">
            <Space wrap>
              {tags.map((tag) => (
                <Tag key={tag} closable onClose={() => setTags(tags.filter((t) => t !== tag))}>
                  {tag}
                </Tag>
              ))}
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onPressEnter={handleAddTag}
                style={{ width: 100 }}
                placeholder="+ 标签"
                size="small"
              />
            </Space>
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}>
            <Input.TextArea rows={6} placeholder="文档内容 (支持 Markdown)..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑文档"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEdit}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { label: 'Draft', value: 'draft' },
                { label: 'Published', value: 'published' },
                { label: 'Archived', value: 'archived' },
              ]}
            />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}>
            <Input.TextArea rows={8} />
          </Form.Item>
        </Form>
      </Modal>

      {/* View Modal */}
      <Modal
        title={viewingDoc?.title}
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={<Button onClick={() => setViewModalVisible(false)}>关闭</Button>}
        width={700}
      >
        {viewingDoc && (
          <div>
            <Space style={{ marginBottom: spacing.md }}>
              <Tag color="blue">{getSpaceName(viewingDoc.spaceId)}</Tag>
              <StatusBadge status={viewingDoc.status === 'archived' ? 'cancelled' : viewingDoc.status === 'published' ? 'success' : 'pending'} />
              <Tag>v{viewingDoc.version}</Tag>
            </Space>
            <Space size={4} style={{ marginBottom: spacing.md }}>
              {viewingDoc.tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </Space>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                background: colors.neutral[50],
                padding: spacing.md,
                borderRadius: 4,
              }}
            >
              {viewingDoc.content}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DocumentListPage;
