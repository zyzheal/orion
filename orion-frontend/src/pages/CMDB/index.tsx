/**
 * CMDB - Configuration Management Database
 * CI management, topology view, and integration status
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
} from 'antd';
import { colors } from '@/tokens';
import {
  ReloadOutlined,
  PlusOutlined,
  CloudServerOutlined,
  DeploymentUnitOutlined,
  ClusterOutlined,
  SyncOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import {
  getCIs,
  createCI,
  deleteCI,
  getTopology,
  getHosts,
  getK8sResources,
  startK8sSync,
  type CIItem,
  type TopologyData,
  type HostInfo,
  type K8sResource,
} from '@/api/cmdb';

const { Title, Text } = Typography;

// ============================================================================
// CI Table Page
// ============================================================================

const CITablePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [cis, setCIs] = useState<CIItem[]>([]);
  const [selectedCI, setSelectedCI] = useState<CIItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCIs({ pageSize: 50 });
      setCIs((res.data as any).data || []);
    } catch (error) {
      console.error('Failed to load CIs:', error);
      message.error('加载配置项失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      await createCI({
        tenant_id: 'default',
        name: values.name,
        type: values.type,
        subtype: values.subtype,
        environment: values.environment,
        owner: values.owner,
        tags: values.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
        attributes: {},
      });
      message.success('配置项创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error('创建配置项失败');
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
        } catch {
          message.error('删除失败');
        }
      },
    });
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
      render: (env: unknown) => env ? <Tag color={String(env) === 'production' ? 'red' : 'geekblue'}>{String(env)}</Tag> : '-',
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
      render: (owner: unknown) => owner ? String(owner) : '-',
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
          <Button type="link" size="small" onClick={() => { setSelectedCI(record); setDetailDrawerOpen(true); }}>
            详情
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={4}>配置项管理</Title>
          <Text type="secondary">管理所有配置项 (CI) 及其生命周期</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateModalOpen(true)}>
            新建配置项
          </Button>
        </Space>
      </div>

      {/* Summary */}
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

      {/* Create Modal */}
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

      {/* Detail Drawer */}
      <Drawer
        title="配置项详情"
        placement="right"
        width={700}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
      >
        {selectedCI && (
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
              <pre>{JSON.stringify(selectedCI.attributes, null, 2)}</pre>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(selectedCI.created_at).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {new Date(selectedCI.updated_at).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

// ============================================================================
// Topology Page
// ============================================================================

const TopologyPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [topology, setTopology] = useState<TopologyData | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getTopology();
      setTopology((res.data as any).data || null);
    } catch (error) {
      console.error('Failed to load topology:', error);
      message.error('加载拓扑图失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={4}>拓扑图</Title>
          <Text type="secondary">可视化资源配置依赖关系</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Card loading={loading}>
        {topology ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <DeploymentUnitOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                节点数: {topology.nodes?.length || 0} | 连接数: {topology.edges?.length || 0}
              </Text>
            </div>
            <div style={{ marginTop: 24, color: colors.neutral[400] }}>
              拓扑图可视化组件待集成 (推荐使用 G6 / React Flow)
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: colors.neutral[400] }}>
            暂无拓扑数据
          </div>
        )}
      </Card>
    </div>
  );
};

// ============================================================================
// Integration Page
// ============================================================================

const IntegrationPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [k8sResources, setK8sResources] = useState<K8sResource[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hostsRes, k8sRes] = await Promise.all([
        getHosts({ pageSize: 20 }),
        getK8sResources(),
      ]);
      setHosts((hostsRes.data as any).data || []);
      setK8sResources((k8sRes.data as any).data || []);
    } catch (error) {
      console.error('Failed to load integration data:', error);
      message.error('加载集成数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await startK8sSync();
      message.success('K8s 同步已启动');
      loadData();
    } catch {
      message.error('同步启动失败');
    } finally {
      setSyncing(false);
    }
  };

  const hostColumns = [
    { title: '主机名', dataIndex: 'hostname', key: 'hostname' },
    { title: 'IP', dataIndex: 'ip', key: 'ip' },
    { title: 'OS', dataIndex: 'os', key: 'os' },
    {
      title: 'CPU',
      dataIndex: 'cpu',
      key: 'cpu',
      render: (v: number) => `${v} Core`,
    },
    {
      title: '内存',
      dataIndex: 'memory',
      key: 'memory',
      render: (v: number) => `${(v / 1024).toFixed(1)} GB`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'running' ? 'green' : 'default'}>{s}</Tag>,
    },
  ];

  const k8sColumns = [
    { title: '类型', dataIndex: 'kind', key: 'kind', render: (k: string) => <Tag>{k}</Tag> },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'Namespace', dataIndex: 'namespace', key: 'namespace' },
    {
      title: '副本',
      dataIndex: 'replicas',
      key: 'replicas',
      render: (r: any) => r ? `${r.current}/${r.desired}` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'Running' ? 'green' : 'default'}>{s}</Tag>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={4}>集成资源</Title>
          <Text type="secondary">主机、K8s、CI/CD 资源同步状态</Text>
        </div>
        <Button icon={<SyncOutlined spin={syncing} />} onClick={handleSync} loading={syncing}>
          K8s 同步
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="主机数量" value={hosts.length} prefix={<CloudServerOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="K8s 资源" value={k8sResources.length} prefix={<ClusterOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="运行中主机"
              value={hosts.filter((h) => h.status === 'running').length}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="主机列表" style={{ marginBottom: 16 }} loading={loading}>
        <Table
          columns={hostColumns}
          dataSource={hosts}
          rowKey="ci_id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Card title="K8s 资源" loading={loading}>
        <Table
          columns={k8sColumns}
          dataSource={k8sResources}
          rowKey={(r) => `${r.kind}-${r.namespace}-${r.name}`}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

// ============================================================================
// Main CMDB Page
// ============================================================================

const CMDBPage: React.FC = () => {
  const tabItems = [
    {
      key: 'cis',
      label: '配置项',
      children: <CITablePage />,
    },
    {
      key: 'topology',
      label: '拓扑图',
      children: <TopologyPage />,
    },
    {
      key: 'integration',
      label: '集成资源',
      children: <IntegrationPage />,
    },
  ];

  return <Tabs defaultActiveKey="cis" items={tabItems} size="large" />;
};

export default CMDBPage;
