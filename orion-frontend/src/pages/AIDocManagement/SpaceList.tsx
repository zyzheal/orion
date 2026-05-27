/**
 * Space List - Knowledge base spaces, create/edit, type badges
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
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { colors } from '@/tokens';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getSpaces,
  createSpace,
  updateSpace,
  deleteSpace,
  type Space as SpaceType,
  type SpaceInput,
} from '@/api/ai-docs';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const typeColorMap: Record<string, string> = {
  public: 'green',
  internal: 'blue',
  private: 'red',
};

const typeOptions = [
  { label: '全部', value: 'all' },
  { label: '公开', value: 'public' },
  { label: '内部', value: 'internal' },
  { label: '私有', value: 'private' },
];

const SpaceList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [spaces, setSpaces] = useState<SpaceType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSpace, setEditingSpace] = useState<SpaceType | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getSpaces();
      setSpaces(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setSpaces([]);
      message.error(`加载知识库数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSpaces = useMemo(() => {
    return spaces.filter((s) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !(s.description && s.description.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.type && filters.type !== 'all' && s.type !== filters.type) return false;
      return true;
    });
  }, [searchQuery, filters, spaces]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: SpaceInput = {
        name: values.name,
        type: values.type,
        description: values.description,
        teamId: values.teamId,
      };
      await createSpace(payload);
      message.success('知识库创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch {
      message.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingSpace) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await updateSpace(editingSpace.id, {
        name: values.name,
        type: values.type,
        description: values.description,
      });
      message.success('知识库更新成功');
      setEditModalVisible(false);
      loadData();
    } catch {
      message.error('更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSpace(id);
      message.success('知识库已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const openEdit = (space: SpaceType) => {
    setEditingSpace(space);
    editForm.setFieldsValue({ name: space.name, type: space.type, description: space.description });
    setEditModalVisible(true);
  };

  const columns: TableColumn<SpaceType>[] = [
    {
      key: 'name',
      title: '知识库名称',
      dataIndex: 'name',
      width: 180,
      sortable: true,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (v: unknown) => <Tag color={typeColorMap[String(v)]}>{String(v)}</Tag>,
    },
    {
      key: 'description',
      title: '描述',
      dataIndex: 'description',
      width: 200,
      render: (v: unknown) => <Text type="secondary">{String(v || '-')}</Text>,
    },
    {
      key: 'documentCount',
      title: '文档数',
      dataIndex: 'documentCount',
      width: 80,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'ownerId',
      title: '所有者',
      dataIndex: 'ownerId',
      width: 120,
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
      width: 160,
      render: (_: unknown, record: any) => (
        <Space size="small">
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

  const filterDefs: FilterDefinition[] = [{ key: 'type', label: '类型', options: typeOptions }];

  return (
    <div style={{ padding: 0 }}>
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
            <FolderOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            知识库
          </Title>
          <Text type="secondary">管理知识库空间</Text>
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
            创建知识库
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索知识库..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredSpaces}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建知识库"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="知识库名称" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={typeOptions.slice(1)} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="知识库描述..." />
          </Form.Item>
          <Form.Item name="teamId" label="团队 ID">
            <Input placeholder="team-id (可选)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑知识库"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEdit}
        confirmLoading={submitting}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={typeOptions.slice(1)} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SpaceList;
