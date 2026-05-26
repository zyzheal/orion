/**
 * Environment Management Page
 * Environment list, hibernate state, TTL config, environment templates
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
  Drawer,
  Descriptions,
  Tooltip,
  Popconfirm,
  Switch,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CloudServerOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import type { TableColumn } from '@/components/Table';
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
  type EnvironmentStatus,
} from '@/api/environments';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

// ---- Color and label maps ----

const typeColorMap: Record<string, string> = {
  dev: 'blue',
  development: 'blue',
  staging: 'orange',
  'pre-prod': 'gold',
  prod: 'red',
  production: 'red',
  testing: 'purple',
};

const typeLabelMap: Record<string, string> = {
  dev: '开发',
  development: '开发',
  staging: '预发',
  'pre-prod': '预生产',
  prod: '生产',
  production: '生产',
  testing: '测试',
};

const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  maintenance: 'orange',
  deprecated: 'red',
};

const statusLabelMap: Record<string, string> = {
  active: '运行中',
  inactive: '已停用',
  maintenance: '维护中',
  deprecated: '已废弃',
};

// ---- Environment template presets ----

interface EnvTemplate {
  name: string;
  description: string;
  config: Record<string, unknown>;
}

interface EnvironmentConfig {
  ttlHours?: number;
  replicas?: number;
  resources?: Record<string, unknown>;
  [key: string]: unknown;
}

const envTemplates: EnvTemplate[] = [
  {
    name: '开发环境标准',
    description: '1 副本、低资源配置、自动休眠',
    config: { replicas: 1, resources: { cpu: '100m', memory: '256Mi' }, autoSleep: true, sleepAfterHours: 2 },
  },
  {
    name: '测试环境标准',
    description: '2 副本、中等资源配置',
    config: { replicas: 2, resources: { cpu: '200m', memory: '512Mi' }, autoSleep: false },
  },
  {
    name: '预发环境标准',
    description: '3 副本、接近生产配置',
    config: { replicas: 3, resources: { cpu: '500m', memory: '1Gi' }, autoSleep: false },
  },
  {
    name: '生产环境标准',
    description: '3+ 副本、高可用配置',
    config: { replicas: 3, resources: { cpu: '1000m', memory: '2Gi' }, autoSleep: false, hpa: true },
  },
];

// ---- Stat Card ----

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}> = ({ title, value, icon, color }) => (
  <Card size="small">
    <Statistic
      title={<Text type="secondary">{title}</Text>}
      value={value}
      prefix={icon}
      valueStyle={{ color }}
    />
  </Card>
);

// ---- Main Component ----

const EnvironmentPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);
  const [_templateModalVisible, setTemplateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getEnvironments();
      setEnvironments(Array.isArray(res.data?.data) ? res.data.data : []);
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

  // Stats
  const stats = useMemo(() => {
    const total = environments.length;
    const active = environments.filter((e) => e.status === 'active').length;
    const hibernated = environments.filter((e) => e.status === 'inactive').length;
    const maintenance = environments.filter((e) => e.status === 'maintenance').length;
    return { total, active, hibernated, maintenance };
  }, [environments]);

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
              } catch {
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
        message.error(`创建失败: ${(error as Error).message}`);
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
              } catch {
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
        message.error(`更新失败: ${(error as Error).message}`);
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
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const handleStatusChange = async (id: string, status: EnvironmentStatus) => {
    try {
      await updateEnvironmentStatus(id, { status });
      message.success('状态更新成功');
      loadData();
    } catch (error: unknown) {
      message.error(`状态更新失败: ${(error as Error).message}`);
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

  const applyTemplate = (template: EnvTemplate) => {
    createForm.setFieldsValue({
      config: JSON.stringify(template.config, null, 2),
    });
    setTemplateModalVisible(false);
    message.success(`已应用模板: ${template.name}`);
  };

  // ---- Table columns ----

  const columns: TableColumn<Environment>[] = [
    {
      key: 'name',
      title: '环境名称',
      dataIndex: 'name',
      width: 180,
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
      width: 140,
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
      key: 'hibernate',
      title: '休眠',
      width: 80,
      render: (_: unknown, record: Environment) => {
        const config = record.config as { autoSleep?: boolean; ttlHours?: number; replicas?: number; resources?: Record<string, unknown> };
        const autoSleep = config?.autoSleep;
        return (
          <Switch
            size="small"
            checked={!!autoSleep}
            checkedChildren="自动"
            unCheckedChildren="手动"
          />
        );
      },
    },
    {
      key: 'ttl',
      title: 'TTL',
      width: 100,
      render: (_: unknown, record: Environment) => {
        const config = record.config as { autoSleep?: boolean; ttlHours?: number; replicas?: number; resources?: Record<string, unknown> };
        const ttl = config?.ttlHours;
        return ttl ? (
          <Tooltip title={`${ttl} 小时后自动销毁`}>
            <Tag icon={<ClockCircleOutlined />}>{ttl}h</Tag>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 140,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? dayjs(String(v)).format('YYYY-MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 260,
      render: (_: unknown, record: Environment) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          {record.status === 'active' && (
            <Tooltip title="休眠">
              <Button
                type="link"
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handleStatusChange(record.id, 'inactive')}
              >
                休眠
              </Button>
            </Tooltip>
          )}
          {record.status === 'inactive' && (
            <Tooltip title="唤醒">
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStatusChange(record.id, 'active')}
              >
                唤醒
              </Button>
            </Tooltip>
          )}
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
        { label: '休眠', value: 'inactive' },
        { label: '维护中', value: 'maintenance' },
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
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <CloudServerOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            环境管理
          </Title>
          <Text type="secondary">管理项目的部署环境、休眠状态、TTL 配置和环境模板</Text>
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

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <StatCard title="总环境数" value={stats.total} icon={<CloudServerOutlined />} />
        </Col>
        <Col span={6}>
          <StatCard title="运行中" value={stats.active} icon={<PlayCircleOutlined />} color="#52c41a" />
        </Col>
        <Col span={6}>
          <StatCard title="休眠中" value={stats.hibernated} icon={<PauseCircleOutlined />} color="#faad14" />
        </Col>
        <Col span={6}>
          <StatCard title="维护中" value={stats.maintenance} icon={<ClockCircleOutlined />} color="#faad14" />
        </Col>
      </Row>

      {/* Environment List */}
      <Card>
        <div style={{ marginBottom: 16 }}>
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
        width={640}
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
          <Form.Item label="应用模板">
            <Space wrap>
              {envTemplates.map((t) => (
                <Button
                  key={t.name}
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => applyTemplate(t)}
                >
                  {t.name}
                </Button>
              ))}
            </Space>
          </Form.Item>
          <Form.Item name="config" label="配置 (JSON 格式)">
            <Input.TextArea
              rows={5}
              placeholder={'{ "replicas": 1, "resources": { "cpu": "100m", "memory": "256Mi" }, "autoSleep": true, "ttlHours": 8 }'}
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
        width={640}
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
            <Input.TextArea rows={5} />
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

            {/* TTL & Hibernate Info */}
            {selectedEnv.config && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>高级配置</Title>
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="自动休眠">
                    <Switch
                      checked={!!(selectedEnv.config as { autoSleep?: boolean })?.autoSleep}
                      disabled
                      checkedChildren="开启"
                      unCheckedChildren="关闭"
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="TTL">
                    {(selectedEnv.config as { ttlHours?: number })?.ttlHours
                      ? `${(selectedEnv.config as EnvironmentConfig)?.ttlHours} 小时后自动销毁`
                      : '无限制'}
                  </Descriptions.Item>
                  <Descriptions.Item label="副本数">
                    {(selectedEnv.config as EnvironmentConfig)?.replicas || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="资源限制">
                    {(selectedEnv.config as EnvironmentConfig)?.resources
                      ? JSON.stringify((selectedEnv.config as EnvironmentConfig).resources)
                      : '-'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}

            {/* Raw Config */}
            {selectedEnv.config && Object.keys(selectedEnv.config).length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>环境配置</Title>
                <pre
                  style={{
                    background: colors.neutral[100],
                    padding: 16,
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
            <div style={{ marginTop: 24 }}>
              <Title level={5}>快捷操作</Title>
              <Space wrap>
                {selectedEnv.status !== 'active' && (
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => {
                      handleStatusChange(selectedEnv.id, 'active');
                      setDetailDrawerVisible(false);
                    }}
                  >
                    唤醒
                  </Button>
                )}
                {selectedEnv.status === 'active' && (
                  <Button
                    icon={<PauseCircleOutlined />}
                    onClick={() => {
                      handleStatusChange(selectedEnv.id, 'inactive');
                      setDetailDrawerVisible(false);
                    }}
                  >
                    休眠
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
              </Space>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default EnvironmentPage;
