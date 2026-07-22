/**
 * Environment Management Page
 * List, create, edit, view detail, and manage status of deployment environments
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
  Drawer,
  Tooltip,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CloudServerOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  updateEnvironmentStatus,
  type Environment,
  type CreateEnvironmentInput,
  type UpdateEnvironmentInput,
  type EnvironmentType,
  type EnvironmentStatus,
} from '@/api/environments';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

// ---- Color and label maps ----

const typeColorMap: Record<EnvironmentType, string> = {
  dev: 'blue',
  development: 'blue',
  staging: 'orange',
  'pre-prod': 'gold',
  prod: 'red',
  production: 'red',
  testing: 'purple',
};

const typeLabelMap: Record<EnvironmentType, string> = {
  dev: '开发',
  development: '开发',
  staging: '预发',
  'pre-prod': '预生产',
  prod: '生产',
  production: '生产',
  testing: '测试',
};

const statusColorMap: Record<EnvironmentStatus, string> = {
  active: 'green',
  inactive: 'default',
  maintenance: 'orange',
  deprecated: 'red',
};

const statusLabelMap: Record<EnvironmentStatus, string> = {
  active: '运行中',
  inactive: '已停用',
  maintenance: '维护中',
  deprecated: '已废弃',
};

// ---- Main Component ----

const EnvironmentManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getEnvironments();
      setEnvironments(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setEnvironments([]);
      message.error(`加载环境列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return environments.filter((env) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !env.name.toLowerCase().includes(q) &&
          !(env.cluster && env.cluster.toLowerCase().includes(q)) &&
          !(env.namespace && env.namespace.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.type && filters.type !== 'all' && env.type !== filters.type) return false;
      if (filters.status && filters.status !== 'all' && env.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, environments]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateEnvironmentInput = {
        projectId: values.projectId,
        name: values.name,
        type: values.type,
        cluster: values.cluster || undefined,
        namespace: values.namespace || undefined,
        config: values.config
          ? (() => {
              try {
                return JSON.parse(values.config);
              } catch (error: unknown) {
                return undefined;
              }
            })()
          : undefined,
      };
      await createEnvironment(payload);
      message.success('环境创建成功');
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
    if (!editingEnv) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const payload: UpdateEnvironmentInput = {
        name: values.name || undefined,
        type: values.type || undefined,
        cluster: values.cluster || undefined,
        namespace: values.namespace || undefined,
        config: values.config
          ? (() => {
              try {
                return JSON.parse(values.config);
              } catch (error: unknown) {
                return undefined;
              }
            })()
          : undefined,
      };
      await updateEnvironment(editingEnv.id, payload);
      message.success('环境更新成功');
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
      await deleteEnvironment(id);
      message.success('环境已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const handleStatusChange = async (id: string, status: EnvironmentStatus) => {
    try {
      await updateEnvironmentStatus(id, { status });
      message.success('状态更新成功');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`状态更新失败：${error.message}`);
      } else {
        message.error('状态更新失败');
      }
    }
  };

  const openEdit = (env: Environment) => {
    setEditingEnv(env);
    editForm.setFieldsValue({
      name: env.name,
      type: env.type,
      cluster: env.cluster,
      namespace: env.namespace,
      config: env.config ? JSON.stringify(env.config, null, 2) : undefined,
    });
    setEditModalVisible(true);
  };

  const openDetail = (env: Environment) => {
    setSelectedEnv(env);
    setDetailDrawerVisible(true);
  };

  // ---- Table columns ----

  const columns: TableColumn<Environment>[] = [
    {
      key: 'name',
      title: '环境名称',
      dataIndex: 'name',
      width: 180,
      sortable: true,
      render: (v: unknown, record: Environment) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            <CloudServerOutlined style={{ marginRight: 6, color: typeColorMap[record.type] }} />
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.project_id}
          </Text>
        </Space>
      ),
    },
    {
      key: 'type',
      title: '类型',
      width: 100,
      render: (_: unknown, record: Environment) => (
        <Tag color={typeColorMap[record.type] || 'default'}>
          {typeLabelMap[record.type] || record.type}
        </Tag>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: Environment) => (
        <Tag color={statusColorMap[record.status] || 'default'}>
          {statusLabelMap[record.status] || record.status}
        </Tag>
      ),
    },
    {
      key: 'cluster',
      title: '集群',
      width: 150,
      render: (_: unknown, record: Environment) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.cluster || '-'}
        </Text>
      ),
    },
    {
      key: 'namespace',
      title: '命名空间',
      width: 120,
      render: (_: unknown, record: Environment) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.namespace || '-'}
        </Text>
      ),
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 140,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? dayjs(String(v)).format('YYYY-MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 240,
      render: (_: unknown, record: Environment) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetail(record)}
            >
              详情
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          {record.status === 'active' && (
            <Tooltip title="设为维护中">
              <Button
                type="link"
                size="small"
                onClick={() => handleStatusChange(record.id, 'maintenance')}
              >
                维护
              </Button>
            </Tooltip>
          )}
          {record.status === 'maintenance' && (
            <Tooltip title="恢复运行">
              <Button
                type="link"
                size="small"
                onClick={() => handleStatusChange(record.id, 'active')}
              >
                恢复
              </Button>
            </Tooltip>
          )}
          {record.status === 'active' && (
            <Tooltip title="停用">
              <Button
                type="link"
                size="small"
                danger
                onClick={() => handleStatusChange(record.id, 'inactive')}
              >
                停用
              </Button>
            </Tooltip>
          )}
          <Tooltip title="删除">
            <Popconfirm
              title="确认删除该环境?"
              description="删除后不可恢复，请确认"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'type',
      label: '环境类型',
      options: [
        { label: '全部', value: 'all' },
        { label: '开发', value: 'dev' },
        { label: '测试', value: 'testing' },
        { label: '预发', value: 'staging' },
        { label: '预生产', value: 'pre-prod' },
        { label: '生产', value: 'prod' },
      ],
    },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '运行中', value: 'active' },
        { label: '维护中', value: 'maintenance' },
        { label: '已停用', value: 'inactive' },
        { label: '已废弃', value: 'deprecated' },
      ],
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
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <EnvironmentOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            环境管理
          </Title>
          <Text type="secondary">管理项目的部署环境（开发、测试、预发、生产）</Text>
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
            创建环境
          </Button>
        </Space>
      </div>

      {/* Environment List */}
      <Card>
        <div style={{ marginBottom: spacing.md }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索环境名称、集群、命名空间..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建环境"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="projectId"
            label="项目 ID"
            rules={[{ required: true, message: '请输入项目 ID' }]}
          >
            <Input placeholder="如: proj-1" />
          </Form.Item>
          <Form.Item
            name="name"
            label="环境名称"
            rules={[{ required: true, message: '请输入环境名称' }]}
          >
            <Input placeholder="如: dev-default, staging, production" />
          </Form.Item>
          <Form.Item
            name="type"
            label="环境类型"
            rules={[{ required: true, message: '请选择环境类型' }]}
          >
            <Select
              options={[
                { label: '开发 (dev)', value: 'dev' },
                { label: '测试 (testing)', value: 'testing' },
                { label: '预发 (staging)', value: 'staging' },
                { label: '预生产 (pre-prod)', value: 'pre-prod' },
                { label: '生产 (prod)', value: 'prod' },
              ]}
            />
          </Form.Item>
          <Form.Item name="cluster" label="集群">
            <Input placeholder="如: k8s-dev-01" />
          </Form.Item>
          <Form.Item name="namespace" label="命名空间">
            <Input placeholder="如: default" />
          </Form.Item>
          <Form.Item name="config" label="配置 (JSON 格式)">
            <Input.TextArea
              rows={4}
              placeholder={'{ "replicas": 1, "resources": { "cpu": "100m", "memory": "256Mi" } }'}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑环境"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEdit}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="环境名称">
            <Input />
          </Form.Item>
          <Form.Item name="type" label="环境类型">
            <Select
              options={[
                { label: '开发 (dev)', value: 'dev' },
                { label: '测试 (testing)', value: 'testing' },
                { label: '预发 (staging)', value: 'staging' },
                { label: '预生产 (pre-prod)', value: 'pre-prod' },
                { label: '生产 (prod)', value: 'prod' },
              ]}
            />
          </Form.Item>
          <Form.Item name="cluster" label="集群">
            <Input />
          </Form.Item>
          <Form.Item name="namespace" label="命名空间">
            <Input />
          </Form.Item>
          <Form.Item name="config" label="配置 (JSON 格式)">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedEnv ? `${selectedEnv.name}` : '环境详情'}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={700}
        destroyOnClose
      >
        {selectedEnv && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="环境名称">{selectedEnv.name}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={typeColorMap[selectedEnv.type]}>
                  {typeLabelMap[selectedEnv.type] || selectedEnv.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedEnv.status]}>
                  {statusLabelMap[selectedEnv.status] || selectedEnv.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="项目 ID">{selectedEnv.project_id}</Descriptions.Item>
              <Descriptions.Item label="集群">{selectedEnv.cluster || '-'}</Descriptions.Item>
              <Descriptions.Item label="命名空间">{selectedEnv.namespace || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {selectedEnv.created_at
                  ? dayjs(selectedEnv.created_at).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {selectedEnv.updated_at
                  ? dayjs(selectedEnv.updated_at).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            {selectedEnv.config && Object.keys(selectedEnv.config).length > 0 && (
              <div style={{ marginTop: spacing.lg }}>
                <Title level={5}>环境配置</Title>
                <pre
                  style={{
                    background: colors.neutral[100],
                    padding: spacing.md,
                    borderRadius: 4,
                    fontSize: 13,
                    overflow: 'auto',
                    maxHeight: 300,
                  }}
                >
                  {JSON.stringify(selectedEnv.config, null, 2)}
                </pre>
              </div>
            )}

            {/* Quick status actions */}
            <div style={{ marginTop: spacing.lg }}>
              <Title level={5}>快捷操作</Title>
              <Space wrap>
                {selectedEnv.status !== 'active' && (
                  <Button
                    type="primary"
                    onClick={() => {
                      handleStatusChange(selectedEnv.id, 'active');
                      setDetailDrawerVisible(false);
                    }}
                  >
                    设为运行中
                  </Button>
                )}
                {selectedEnv.status === 'active' && (
                  <Button
                    danger
                    onClick={() => {
                      handleStatusChange(selectedEnv.id, 'maintenance');
                      setDetailDrawerVisible(false);
                    }}
                  >
                    设为维护中
                  </Button>
                )}
                {selectedEnv.status === 'active' && (
                  <Button
                    onClick={() => {
                      handleStatusChange(selectedEnv.id, 'inactive');
                      setDetailDrawerVisible(false);
                    }}
                  >
                    停用
                  </Button>
                )}
              </Space>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default EnvironmentManagement;
