/**
 * IaC Workspace List - Workspace table with create/edit, environment filter, lock status
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
import {
  PlusOutlined,
  LayoutOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  LockOutlined,
  UnlockOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  type IaCWorkspace,
  type WorkspaceInput,
} from '@/api/iac';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const environmentOptions = [
  { label: '全部', value: 'all' },
  { label: 'Development', value: 'development' },
  { label: 'Staging', value: 'staging' },
  { label: 'Production', value: 'production' },
];

const providerOptions = [
  { label: 'Terraform', value: 'terraform' },
  { label: 'Pulumi', value: 'pulumi' },
  { label: 'CloudFormation', value: 'cloudformation' },
];

const envColorMap: Record<string, string> = {
  development: 'blue',
  staging: 'orange',
  production: 'red',
};

const WorkspaceList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<IaCWorkspace[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<IaCWorkspace | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getWorkspaces();
      setWorkspaces(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load workspaces：${error.message}`);
      } else {
        message.error('Failed to load workspaces');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredWorkspaces = useMemo(() => {
    return workspaces.filter((ws) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!ws.name.toLowerCase().includes(q) && !ws.projectId.toLowerCase().includes(q))
          return false;
      }
      if (
        filters.environment &&
        filters.environment !== 'all' &&
        ws.environment !== filters.environment
      )
        return false;
      if (filters.provider && filters.provider !== 'all' && ws.provider !== filters.provider)
        return false;
      if (filters.status && filters.status !== 'all' && ws.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, workspaces]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: WorkspaceInput = {
        name: values.name,
        projectId: values.projectId,
        environment: values.environment,
        provider: values.provider,
        config: values.config,
      };
      await createWorkspace(payload);
      message.success('工作空间创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
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
    if (!editingWorkspace) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await updateWorkspace(editingWorkspace.id, { name: values.name, config: values.config });
      message.success('工作空间更新成功');
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

  const openEdit = (ws: IaCWorkspace) => {
    setEditingWorkspace(ws);
    editForm.setFieldsValue({ name: ws.name, config: '' });
    setEditModalVisible(true);
  };

  const columns: TableColumn<IaCWorkspace>[] = [
    {
      key: 'name',
      title: '工作空间',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'environment',
      title: '环境',
      dataIndex: 'environment',
      width: 140,
      render: (v: unknown) => <Tag color={envColorMap[String(v)] || 'default'}>{String(v)}</Tag>,
    },
    {
      key: 'provider',
      title: '引擎',
      dataIndex: 'provider',
      width: 140,
      render: (v: unknown) => <Tag>{String(v)}</Tag>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (v: unknown) => <StatusBadge status={v as any} size="small" />,
    },
    {
      key: 'lockedBy',
      title: '锁定',
      dataIndex: 'lockedBy',
      width: 140,
      render: (v: unknown) =>
        v ? (
          <Space>
            <LockOutlined style={{ color: colors.warning[500] }} />
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              {String(v)}
            </Text>
          </Space>
        ) : (
          <Space>
            <UnlockOutlined style={{ color: colors.success[500] }} />
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              未锁定
            </Text>
          </Space>
        ),
    },
    {
      key: 'projectId',
      title: '项目',
      dataIndex: 'projectId',
      width: 140,
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
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
      width: 200,
      render: (_: unknown, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<PlayCircleOutlined />}>
            Plan
          </Button>
          <Button type="link" size="small" icon={<PlayCircleOutlined />}>
            Apply
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除?" onConfirm={() => message.info('删除功能待后端支持')}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    { key: 'environment', label: '环境', options: environmentOptions },
    {
      key: 'provider',
      label: '引擎',
      options: [{ label: '全部', value: 'all' }, ...providerOptions],
    },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Idle', value: 'idle' },
        { label: 'Planning', value: 'planning' },
        { label: 'Applying', value: 'applying' },
        { label: 'Error', value: 'error' },
        { label: 'Locked', value: 'locked' },
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
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <LayoutOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            工作空间
          </Title>
          <Text type="secondary">管理 IaC 工作空间</Text>
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
            创建工作空间
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ marginBottom: spacing[4] }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索工作空间..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredWorkspaces}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建工作空间"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="my-infra-workspace" />
          </Form.Item>
          <Form.Item name="projectId" label="项目 ID" rules={[{ required: true }]}>
            <Input placeholder="project-123" />
          </Form.Item>
          <Form.Item name="environment" label="环境" rules={[{ required: true }]}>
            <Select options={environmentOptions.slice(1)} />
          </Form.Item>
          <Form.Item name="provider" label="引擎" rules={[{ required: true }]}>
            <Select options={providerOptions} />
          </Form.Item>
          <Form.Item name="config" label="配置">
            <Input.TextArea rows={3} placeholder="工作空间配置 (JSON/YAML)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑工作空间"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEdit}
        confirmLoading={submitting}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="config" label="配置">
            <Input.TextArea rows={3} placeholder="更新配置..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkspaceList;
