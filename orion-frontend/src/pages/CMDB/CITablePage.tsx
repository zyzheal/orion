/**
 * CI Table Page - Configuration Item CRUD
 * Extracted from CMDB/index.tsx
 */
import React, { useState, useEffect } from 'react';
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
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  message,
  Drawer,
  Descriptions,
  Tabs,
  Popconfirm,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  CloudServerOutlined,
  DeploymentUnitOutlined,
  ClusterOutlined,
  AppstoreOutlined,
  LinkOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getCIs,
  createCI,
  updateCI,
  deleteCI,
  getCIRelations,
  createRelation,
  deleteRelation,
  type CIItem,
  type CIRelation,
  type UpdateCIInput,
} from '@/api/cmdb';

const { Title, Text } = Typography;

const CITablePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [cis, setCIs] = useState<CIItem[]>([]);
  const [selectedCI, setSelectedCI] = useState<CIItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCI, setEditingCI] = useState<CIItem | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // Relation states
  const [relations, setRelations] = useState<CIRelation[]>([]);
  const [relationLoading, setRelationLoading] = useState(false);
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relationForm] = Form.useForm();
  const [allCIs, setAllCIs] = useState<CIItem[]>([]);

  const RELATION_TYPES = [
    { value: 'DEPENDS_ON', label: '依赖 (DEPENDS_ON)' },
    { value: 'HOSTED_ON', label: '宿主机 (HOSTED_ON)' },
    { value: 'CONNECTS_TO', label: '连接 (CONNECTS_TO)' },
    { value: 'BELONGS_TO', label: '归属 (BELONGS_TO)' },
    { value: 'USES', label: '使用 (USES)' },
    { value: 'CONTAINS', label: '包含 (CONTAINS)' },
    { value: 'VERSION_OF', label: '版本 (VERSION_OF)' },
    { value: 'DEPLOYED_TO', label: '部署 (DEPLOYED_TO)' },
    { value: 'MONITORED_BY', label: '监控 (MONITORED_BY)' },
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCIs({ pageSize: 50 });
      setCIs((res.data as any).data || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          message.error('权限不足，请重新登录或联系管理员');
        } else {
          message.error(`加载配置项失败：${error.message}`);
        }
      } else {
        message.error('加载配置项失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadRelations = async (ciId: string) => {
    setRelationLoading(true);
    try {
      const res = await getCIRelations(ciId);
      setRelations((res.data as any).data || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载关联关系失败：${error.message}`);
      } else {
        message.error('加载关联关系失败');
      }
    } finally {
      setRelationLoading(false);
    }
  };

  const loadAllCIsForRelation = async () => {
    try {
      const res = await getCIs({ pageSize: 200 });
      setAllCIs((res.data as any).data || []);
    } catch {
      // Silently fail, user will see empty dropdown
    }
  };

  const handleCreateRelation = async (values: any) => {
    if (!selectedCI) return;
    try {
      await createRelation({
        source_id: selectedCI.id,
        target_id: values.target_id,
        relation_type: values.relation_type,
        description: values.description,
      });
      message.success('关联关系创建成功');
      setRelationModalOpen(false);
      relationForm.resetFields();
      loadRelations(selectedCI.id);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建关联关系失败：${error.message}`);
      } else {
        message.error('创建关联关系失败');
      }
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    try {
      await deleteRelation(relationId);
      message.success('关联关系已删除');
      if (selectedCI) {
        loadRelations(selectedCI.id);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除关联关系失败：${error.message}`);
      } else {
        message.error('删除关联关系失败');
      }
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await createCI({
        tenant_id: 'default',
        name: values.name,
        type: values.type,
        subtype: values.subtype,
        environment: values.environment,
        owner: values.owner,
        tags:
          values.tags
            ?.split(',')
            .map((t: string) => t.trim())
            .filter(Boolean) || [],
        attributes: {},
      });
      message.success('配置项创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建配置项失败：${error.message}`);
      } else {
        message.error('创建配置项失败');
      }
    }
  };

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
          if (error instanceof Error) {
            message.error(`删除失败：${error.message}`);
          } else {
            message.error('删除失败');
          }
        }
      },
    });
  };

  const openEdit = (ci: CIItem) => {
    setEditingCI(ci);
    editForm.setFieldsValue({
      name: ci.name,
      type: ci.type,
      subtype: ci.subtype,
      environment: ci.environment,
      owner: ci.owner,
      status: ci.status,
      tags: ci.tags?.join(', ') || '',
    });
    setEditModalOpen(true);
  };

  const handleUpdate = async (values: any) => {
    if (!editingCI) return;
    try {
      const payload: UpdateCIInput = {
        name: values.name,
        status: values.status,
        owner: values.owner,
        environment: values.environment,
        tags:
          values.tags
            ?.split(',')
            .map((t: string) => t.trim())
            .filter(Boolean) || [],
        attributes: editingCI.attributes,
      };
      await updateCI(editingCI.id, payload);
      message.success('配置项更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      setEditingCI(null);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新配置项失败：${error.message}`);
      } else {
        message.error('更新配置项失败');
      }
    }
  };

  const typeIconMap: Record<string, React.ReactNode> = {
    host: <CloudServerOutlined />,
    k8s: <ClusterOutlined />,
    service: <DeploymentUnitOutlined />,
    application: <AppstoreOutlined />,
  };

  const statusColorMap: Record<string, string> = {
    active: 'green',
    inactive: 'default',
    maintenance: 'orange',
    deprecated: 'red',
  };

  const columns: TableColumnsType<CIItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: unknown, record: CIItem) => (
        <Space>
          {typeIconMap[record.type] || <CloudServerOutlined />}
          <Text strong>{String(text)}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: unknown) => <Tag color="blue">{String(type)}</Tag>,
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: (env: unknown) =>
        env ? (
          <Tag color={String(env) === 'production' ? 'red' : 'geekblue'}>{String(env)}</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: unknown) => (
        <Tag color={statusColorMap[String(status)] || 'default'}>{String(status)}</Tag>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      key: 'owner',
      render: (owner: unknown) => (owner ? String(owner) : '-'),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (ts: unknown) => new Date(String(ts)).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CIItem) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedCI(record);
              setDetailDrawerOpen(true);
              loadRelations(record.id);
            }}
          >
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const isInitialLoading = loading && cis.length === 0;

  const renderRelationsTab = () => {
    const outgoing = relations.filter((r) => r.source_id === selectedCI?.id);
    const incoming = relations.filter((r) => r.target_id === selectedCI?.id);

    const outColumns: TableColumnsType<CIRelation> = [
      {
        title: '关系类型',
        dataIndex: 'relation_type',
        key: 'relation_type',
        render: (t: string) => <Tag color="blue">{t}</Tag>,
      },
      {
        title: '目标配置项',
        dataIndex: 'target_id',
        key: 'target_id',
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        render: (d: string) => d || '-',
      },
      {
        title: '操作',
        key: 'action',
        render: (_: any, record: CIRelation) => (
          <Popconfirm title="确认删除此关联关系?" onConfirm={() => handleDeleteRelation(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        ),
      },
    ];

    const inColumns: TableColumnsType<CIRelation> = [
      {
        title: '关系类型',
        dataIndex: 'relation_type',
        key: 'relation_type',
        render: (t: string) => <Tag color="green">{t}</Tag>,
      },
      {
        title: '源配置项',
        dataIndex: 'source_id',
        key: 'source_id',
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        render: (d: string) => d || '-',
      },
    ];

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text type="secondary">管理此配置项的关联关系</Text>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              loadAllCIsForRelation();
              setRelationModalOpen(true);
            }}
          >
            新建关联
          </Button>
        </div>

        <Text style={{ marginBottom: 8, display: 'block' }}>
          <strong>下游关联</strong>（此配置项 → 其他）
        </Text>
        <Table
          columns={outColumns}
          dataSource={outgoing}
          loading={relationLoading}
          rowKey="id"
          pagination={false}
          size="small"
          style={{ marginBottom: 16 }}
          locale={{ emptyText: '暂无下游关联' }}
        />

        <Text style={{ marginBottom: 8, display: 'block' }}>
          <strong>上游关联</strong>（其他 → 此配置项）
        </Text>
        <Table
          columns={inColumns}
          dataSource={incoming}
          loading={relationLoading}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无上游关联' }}
        />
      </div>
    );
  };

  return (
    <div>
      {isInitialLoading && <PageSkeleton cards={5} rows={8} />}

      {isInitialLoading ? null : (
        <>
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

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title="配置项总数" value={cis.length} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="活跃"
                  value={cis.filter((c) => c.status === 'active').length}
                  valueStyle={{ color: colors.success[500] }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="维护中"
                  value={cis.filter((c) => c.status === 'maintenance').length}
                  valueStyle={{ color: colors.warning[500] }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已废弃"
                  value={cis.filter((c) => c.status === 'deprecated').length}
                  valueStyle={{ color: colors.error[500] }}
                />
              </Card>
            </Col>
          </Row>

          <Table
            columns={columns}
            dataSource={cis}
            loading={loading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />

          <Modal
            title="新建配置项"
            open={createModalOpen}
            onCancel={() => setCreateModalOpen(false)}
            onOk={() => form.submit()}
            width={600}
          >
            <Form form={form} layout="vertical" onFinish={handleCreate}>
              <Form.Item label="名称" name="name" rules={[{ required: true }]}>
                <Input placeholder="例如：prod-api-server-01" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="类型" name="type" rules={[{ required: true }]}>
                    <Select>
                      <Select.Option value="host">Host</Select.Option>
                      <Select.Option value="k8s">K8s</Select.Option>
                      <Select.Option value="service">Service</Select.Option>
                      <Select.Option value="application">Application</Select.Option>
                      <Select.Option value="database">Database</Select.Option>
                      <Select.Option value="cache">Cache</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="子类型" name="subtype">
                    <Input placeholder="可选" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="环境" name="environment">
                    <Select>
                      <Select.Option value="development">development</Select.Option>
                      <Select.Option value="testing">testing</Select.Option>
                      <Select.Option value="staging">staging</Select.Option>
                      <Select.Option value="production">production</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="负责人" name="owner">
                    <Input placeholder="可选" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="标签" name="tags">
                <Input placeholder="逗号分隔，例如：web,api,v2" />
              </Form.Item>
            </Form>
          </Modal>

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
                  <Form.Item label="类型" name="type">
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="子类型" name="subtype">
                    <Input placeholder="可选" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="环境" name="environment">
                    <Select>
                      <Select.Option value="development">development</Select.Option>
                      <Select.Option value="testing">testing</Select.Option>
                      <Select.Option value="staging">staging</Select.Option>
                      <Select.Option value="production">production</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="负责人" name="owner">
                    <Input placeholder="可选" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="状态" name="status">
                    <Select>
                      <Select.Option value="active">active</Select.Option>
                      <Select.Option value="inactive">inactive</Select.Option>
                      <Select.Option value="maintenance">maintenance</Select.Option>
                      <Select.Option value="deprecated">deprecated</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="标签" name="tags">
                    <Input placeholder="逗号分隔，例如：web,api,v2" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Modal>

          <Modal
            title="新建关联关系"
            open={relationModalOpen}
            onCancel={() => {
              setRelationModalOpen(false);
              relationForm.resetFields();
            }}
            onOk={() => relationForm.submit()}
            width={500}
          >
            <Form form={relationForm} layout="vertical" onFinish={handleCreateRelation}>
              <Form.Item
                label="关系类型"
                name="relation_type"
                rules={[{ required: true, message: '请选择关系类型' }]}
              >
                <Select placeholder="选择关系类型">
                  {RELATION_TYPES.map((rt) => (
                    <Select.Option key={rt.value} value={rt.value}>
                      {rt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                label="目标配置项"
                name="target_id"
                rules={[{ required: true, message: '请选择目标配置项' }]}
              >
                <Select
                  placeholder="选择目标配置项"
                  showSearch
                  optionFilterProp="label"
                >
                  {allCIs
                    .filter((ci) => ci.id !== selectedCI?.id)
                    .map((ci) => (
                      <Select.Option key={ci.id} value={ci.id} label={ci.name}>
                        {ci.name} ({ci.type})
                      </Select.Option>
                    ))}
                </Select>
              </Form.Item>
              <Form.Item label="描述" name="description">
                <Input.TextArea rows={3} placeholder="可选，描述此关联关系" />
              </Form.Item>
            </Form>
          </Modal>
          <Drawer
            title="配置项详情"
            placement="right"
            width={700}
            open={detailDrawerOpen}
            onClose={() => {
              setDetailDrawerOpen(false);
              setSelectedCI(null);
            }}
            destroyOnClose
          >
            {selectedCI && (
              <Tabs
                defaultActiveKey="basic"
                items={[
                  {
                    key: 'basic',
                    label: '基本信息',
                    children: (
                      <Descriptions column={1} bordered>
                        <Descriptions.Item label="ID">{selectedCI.id}</Descriptions.Item>
                        <Descriptions.Item label="名称">{selectedCI.name}</Descriptions.Item>
                        <Descriptions.Item label="类型">{selectedCI.type}</Descriptions.Item>
                        <Descriptions.Item label="子类型">{selectedCI.subtype || '-'}</Descriptions.Item>
                        <Descriptions.Item label="环境">{selectedCI.environment || '-'}</Descriptions.Item>
                        <Descriptions.Item label="状态">
                          <Tag color={statusColorMap[selectedCI.status]}>{selectedCI.status}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="负责人">{selectedCI.owner || '-'}</Descriptions.Item>
                        <Descriptions.Item label="标签">
                          <Space>
                            {(selectedCI.tags || []).map((tag) => (
                              <Tag key={tag}>{tag}</Tag>
                            ))}
                          </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label="属性">
                          <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                            {JSON.stringify(selectedCI.attributes, null, 2)}
                          </pre>
                        </Descriptions.Item>
                        <Descriptions.Item label="创建时间">
                          {new Date(selectedCI.created_at).toLocaleString()}
                        </Descriptions.Item>
                        <Descriptions.Item label="更新时间">
                          {new Date(selectedCI.updated_at).toLocaleString()}
                        </Descriptions.Item>
                      </Descriptions>
                    ),
                  },
                  {
                    key: 'relations',
                    label: (
                      <span>
                        <LinkOutlined /> 关联关系
                      </span>
                    ),
                    children: renderRelationsTab(),
                  },
                ]}
              />
            )}
          </Drawer>
        </>
      )}
    </div>
  );
};

export default CITablePage;
