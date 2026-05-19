/**
 * CMDB Service - Configuration Management Database
 * CI management with type filtering, CRUD operations, and detail panel
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  type TableColumnsType,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Modal,
  Form,
  Drawer,
  Descriptions,
  Badge,
  message,
  Spin,
  Empty,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  AppstoreOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  ApiOutlined,
  DatabaseOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  getCIs,
  createCI,
  updateCI,
  deleteCI,
  getRelations,
  type CI,
  type Relation,
  type CreateCIInput,
  type UpdateCIInput,
} from '@/api/cmdb-service';
import PageSkeleton from '@/components/PageSkeleton';

const { Title, Text } = Typography;

// CI 类型定义
const CI_TYPES = [
  { value: 'host', label: '主机', icon: <CloudServerOutlined />, color: 'blue' },
  { value: 'k8s', label: 'Kubernetes', icon: <ClusterOutlined />, color: 'cyan' },
  { value: 'service', label: '服务', icon: <ApiOutlined />, color: 'green' },
  { value: 'application', label: '应用', icon: <AppstoreOutlined />, color: 'purple' },
  { value: 'database', label: '数据库', icon: <DatabaseOutlined />, color: 'orange' },
  { value: 'middleware', label: '中间件', icon: <SettingOutlined />, color: 'magenta' },
];

// CI 状态定义
const CI_STATUSES = [
  { value: 'active', label: '运行中', color: 'success' },
  { value: 'inactive', label: '已停止', color: 'default' },
  { value: 'maintenance', label: '维护中', color: 'warning' },
  { value: 'deprecated', label: '已废弃', color: 'error' },
];

// 环境定义
const ENVIRONMENTS = [
  { value: 'production', label: '生产环境', color: 'red' },
  { value: 'staging', label: '预发环境', color: 'orange' },
  { value: 'testing', label: '测试环境', color: 'blue' },
  { value: 'development', label: '开发环境', color: 'default' },
];

// 获取 CI 类型图标
const getTypeIcon = (type: string) => {
  const ciType = CI_TYPES.find((t) => t.value === type);
  return ciType?.icon || <AppstoreOutlined />;
};

// 获取 CI 类型颜色
const getTypeColor = (type: string) => {
  const ciType = CI_TYPES.find((t) => t.value === type);
  return ciType?.color || 'blue';
};

// 获取状态颜色
const getStatusColor = (status: string) => {
  const s = CI_STATUSES.find((st) => st.value === status);
  return s?.color || 'default';
};

// 获取状态标签
const getStatusLabel = (status: string) => {
  const s = CI_STATUSES.find((st) => st.value === status);
  return s?.label || status;
};

// 获取环境标签
const getEnvLabel = (env: string) => {
  const e = ENVIRONMENTS.find((en) => en.value === env);
  return e?.label || env;
};

// 获取环境颜色
const getEnvColor = (env: string) => {
  const e = ENVIRONMENTS.find((en) => en.value === env);
  return e?.color || 'default';
};

// ============================================================================
// CI Table Page Component
// ============================================================================

const CITablePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [cis, setCIs] = useState<CI[]>([]);
  const [selectedCI, setSelectedCI] = useState<CI | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCI, setEditingCI] = useState<CI | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 加载 CI 数据
  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { pageSize: 100 };
      if (selectedType) {
        params.ci_type = selectedType;
      }
      if (searchKeyword) {
        params.keyword = searchKeyword;
      }
      const res = await getCIs(params);
      const data = (res.data as { data?: CI[] })?.data || [];
      setCIs(data);
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message.includes('401') || err.message.includes('403')) {
        message.error('权限不足，请重新登录或联系管理员');
      } else {
        message.error(`加载配置项失败：${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedType]);

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
  };

  useEffect(() => {
    if (searchKeyword !== undefined) {
      loadData();
    }
  }, [searchKeyword]);

  // 创建 CI
  const handleCreate = async (values: unknown) => {
    const formValues = values as CreateCIInput;
    try {
      await createCI({
        name: formValues.name,
        ci_type: formValues.ci_type,
        description: formValues.description,
        environment: formValues.environment,
        tags: formValues.tags,
        attributes: {},
      });
      message.success('配置项创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as Error;
      message.error(`创建配置项失败：${err.message}`);
    }
  };

  // 编辑 CI
  const openEdit = (ci: CI) => {
    setEditingCI(ci);
    editForm.setFieldsValue({
      name: ci.name,
      ci_type: ci.ci_type,
      description: ci.description,
      status: ci.status,
      environment: ci.environment,
      tags: ci.tags?.join(', ') || '',
    });
    setEditModalOpen(true);
  };

  const handleUpdate = async (values: unknown) => {
    if (!editingCI) return;
    const formValues = values as UpdateCIInput;
    try {
      const payload: UpdateCIInput = {
        name: formValues.name,
        description: formValues.description,
        status: formValues.status,
        environment: formValues.environment,
        tags: formValues.tags?.split(',').map((t) => t.trim()).filter(Boolean),
        attributes: editingCI.attributes,
      };
      await updateCI(editingCI.id, payload);
      message.success('配置项更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      setEditingCI(null);
      loadData();
    } catch (error: unknown) {
      const err = error as Error;
      message.error(`更新配置项失败：${err.message}`);
    }
  };

  // 删除 CI
  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      onOk: async () => {
        try {
          await deleteCI(id);
          message.success('删除成功');
          loadData();
        } catch (error: unknown) {
          const err = error as Error;
          message.error(`删除失败：${err.message}`);
        }
      },
    });
  };

  // 表格列定义
  const columns: TableColumnsType<CI> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: CI) => (
        <Space>
          <span style={{ color: getTypeColor(record.ci_type) }}>
            {getTypeIcon(record.ci_type)}
          </span>
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'ci_type',
      key: 'ci_type',
      width: 100,
      render: (type: string) => (
        <Tag color={getTypeColor(type)}>{CI_TYPES.find((t) => t.value === type)?.label || type}</Tag>
      ),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 100,
      render: (env: string) =>
        env ? <Tag color={getEnvColor(env)}>{getEnvLabel(env)}</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Badge color={getStatusColor(status)} text={getStatusLabel(status)} />
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => desc || '-',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (tags: string[]) => (
        <Space wrap>
          {(tags || []).slice(0, 3).map((tag) => (
            <Tag key={tag} color="blue">{tag}</Tag>
          ))}
          {(tags || []).length > 3 && <Tag>+{tags.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_: unknown, record: CI) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedCI(record);
              setDetailDrawerOpen(true);
            }}
          >
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 统计数据
  const stats = useMemo(() => {
    const total = cis.length;
    const active = cis.filter((c) => c.status === 'active').length;
    const maintenance = cis.filter((c) => c.status === 'maintenance').length;
    const inactive = cis.filter((c) => c.status === 'inactive').length;
    return { total, active, maintenance, inactive };
  }, [cis]);

  const isInitialLoading = loading && cis.length === 0;

  return (
    <div>
      {isInitialLoading && <PageSkeleton cards={5} rows={8} />}

      {!isInitialLoading && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <Title level={4}>配置项管理</Title>
              <Text type="secondary">管理所有配置项 (CI) 及其生命周期</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新
              </Button>
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={() => setCreateModalOpen(true)}
              >
                新建配置项
              </Button>
            </Space>
          </div>

          {/* Summary Stats */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <StatisticWithIcon
                  title="配置项总数"
                  value={stats.total}
                  icon={<AppstoreOutlined />}
                  color="blue"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <StatisticWithIcon
                  title="运行中"
                  value={stats.active}
                  icon={<CloudServerOutlined />}
                  color="green"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <StatisticWithIcon
                  title="维护中"
                  value={stats.maintenance}
                  icon={<SettingOutlined />}
                  color="orange"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <StatisticWithIcon
                  title="已停止"
                  value={stats.inactive}
                  icon={<CloudServerOutlined />}
                  color="default"
                />
              </Card>
            </Col>
          </Row>

          {/* CI Table */}
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Input
                placeholder="搜索配置项名称"
                prefix={<SearchOutlined />}
                style={{ width: 240 }}
                onPressEnter={(e) => handleSearch((e.target as HTMLInputElement).value)}
                allowClear
              />
              <Select
                placeholder="筛选类型"
                style={{ width: 140 }}
                allowClear
                value={selectedType}
                onChange={setSelectedType}
              >
                {CI_TYPES.map((type) => (
                  <Select.Option key={type.value} value={type.value}>
                    <Space>
                      {type.icon}
                      {type.label}
                    </Space>
                  </Select.Option>
                ))}
              </Select>
            </Space>

            <Table
              columns={columns}
              dataSource={cis}
              loading={loading}
              rowKey="id"
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
              scroll={{ x: 1200 }}
            />
          </Card>

          {/* Create Modal */}
          <Modal
            title="新建配置项"
            open={createModalOpen}
            onCancel={() => {
              setCreateModalOpen(false);
              form.resetFields();
            }}
            onOk={() => form.submit()}
            width={600}
          >
            <Form form={form} layout="vertical" onFinish={handleCreate}>
              <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入配置项名称' }]}>
                <Input placeholder="例如：prod-api-server-01" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="类型" name="ci_type" rules={[{ required: true, message: '请选择类型' }]}>
                    <Select placeholder="选择类型">
                      {CI_TYPES.map((type) => (
                        <Select.Option key={type.value} value={type.value}>
                          <Space>
                            {type.icon}
                            {type.label}
                          </Space>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="环境" name="environment">
                    <Select placeholder="选择环境" allowClear>
                      {ENVIRONMENTS.map((env) => (
                        <Select.Option key={env.value} value={env.value}>
                          {env.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="描述" name="description">
                <Input.TextArea rows={2} placeholder="可选描述" />
              </Form.Item>
              <Form.Item label="标签" name="tags">
                <Input placeholder="逗号分隔，例如：web,api,v2" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Edit Modal */}
          <Modal
            title="编辑配置项"
            open={editModalOpen}
            onCancel={() => {
              setEditModalOpen(false);
              editForm.resetFields();
              setEditingCI(null);
            }}
            onOk={() => editForm.submit()}
            width={600}
          >
            <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
              <Form.Item label="名称" name="name" rules={[{ required: true }]}>
                <Input placeholder="例如：prod-api-server-01" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="类型" name="ci_type">
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="状态" name="status">
                    <Select>
                      {CI_STATUSES.map((status) => (
                        <Select.Option key={status.value} value={status.value}>
                          {status.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="环境" name="environment">
                    <Select allowClear>
                      {ENVIRONMENTS.map((env) => (
                        <Select.Option key={env.value} value={env.value}>
                          {env.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="标签" name="tags">
                    <Input placeholder="逗号分隔，例如：web,api,v2" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="描述" name="description">
                <Input.TextArea rows={2} placeholder="可选描述" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Detail Drawer */}
          <Drawer
            title="配置项详情"
            placement="right"
            width={700}
            open={detailDrawerOpen}
            onClose={() => setDetailDrawerOpen(false)}
          >
            {selectedCI && (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="ID">{selectedCI.id}</Descriptions.Item>
                <Descriptions.Item label="CI ID">{selectedCI.ci_id}</Descriptions.Item>
                <Descriptions.Item label="名称">{selectedCI.name}</Descriptions.Item>
                <Descriptions.Item label="类型">
                  <Tag color={getTypeColor(selectedCI.ci_type)}>
                    {getTypeIcon(selectedCI.ci_type)}
                    {' '}
                    {CI_TYPES.find((t) => t.value === selectedCI.ci_type)?.label || selectedCI.ci_type}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="环境">
                  {selectedCI.environment ? (
                    <Tag color={getEnvColor(selectedCI.environment)}>{getEnvLabel(selectedCI.environment)}</Tag>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Badge color={getStatusColor(selectedCI.status)} text={getStatusLabel(selectedCI.status)} />
                </Descriptions.Item>
                <Descriptions.Item label="描述">{selectedCI.description || '-'}</Descriptions.Item>
                <Descriptions.Item label="标签">
                  <Space wrap>
                    {(selectedCI.tags || []).map((tag) => (
                      <Tag key={tag} color="blue">{tag}</Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
                {selectedCI.attributes && Object.keys(selectedCI.attributes).length > 0 && (
                  <Descriptions.Item label="属性">
                    <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                      {JSON.stringify(selectedCI.attributes, null, 2)}
                    </pre>
                  </Descriptions.Item>
                )}
                {selectedCI.created_at && (
                  <Descriptions.Item label="创建时间">
                    {new Date(selectedCI.created_at).toLocaleString()}
                  </Descriptions.Item>
                )}
                {selectedCI.updated_at && (
                  <Descriptions.Item label="更新时间">
                    {new Date(selectedCI.updated_at).toLocaleString()}
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}
          </Drawer>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Statistic Component
// ============================================================================

interface StatisticWithIconProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

const StatisticWithIcon: React.FC<StatisticWithIconProps> = ({ title, value, icon, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div>
      <Text type="secondary">{title}</Text>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
    <div style={{ fontSize: 32, color }}>{icon}</div>
  </div>
);

// ============================================================================
// Main Page Component
// ============================================================================

const CMDBServicePage: React.FC = () => {
  const [activeKey, setActiveKey] = useState('cis');

  const tabItems = [
    {
      key: 'cis',
      label: (
        <span>
          <AppstoreOutlined />
          配置项
        </span>
      ),
      children: <CITablePage />,
    },
    {
      key: 'topology',
      label: (
        <span>
          <ClusterOutlined />
          拓扑图
        </span>
      ),
      children: React.lazy(() => import('./Topology')),
    },
    {
      key: 'relations',
      label: (
        <span>
          <ApiOutlined />
          关系管理
        </span>
      ),
      children: <RelationsPage />,
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>CMDB 配置管理</Title>
      <Card>
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          items={tabItems}
          size="large"
        />
      </Card>
    </div>
  );
};

// ============================================================================
// Relations Page (Placeholder)
// ============================================================================

const RelationsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [selectedCI, setSelectedCI] = useState<string | null>(null);

  const loadRelations = async () => {
    setLoading(true);
    try {
      const res = await getRelations(selectedCI || undefined);
      setRelations((res.data as { data?: Relation[] })?.data || []);
    } catch (error: unknown) {
      const err = error as Error;
      message.error(`加载关系失败：${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRelations();
  }, [selectedCI]);

  const columns: TableColumnsType<Relation> = [
    {
      title: '源 CI',
      dataIndex: 'from_ci_id',
      key: 'from_ci_id',
    },
    {
      title: '关系类型',
      dataIndex: 'relation_type',
      key: 'relation_type',
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: '目标 CI',
      dataIndex: 'to_ci_id',
      key: 'to_ci_id',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || '-',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={4}>关系管理</Title>
          <Text type="secondary">管理配置项之间的依赖关系</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadRelations} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />}>
            新建关系
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={relations}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无关系数据" /> }}
      />
    </div>
  );
};

export default CMDBServicePage;