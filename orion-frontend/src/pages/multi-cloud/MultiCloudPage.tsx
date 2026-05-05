/**
 * Multi-Cloud Management Page
 * Phase 3 - Multi-cloud provider management, cost comparison, and resource orchestration
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Tabs,
} from 'antd';
import {
  CloudServerOutlined,
  PlusOutlined,
  ReloadOutlined,
  CloudOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface CloudProvider {
  id: string;
  name: string;
  type: 'aws' | 'azure' | 'gcp' | 'alicloud' | 'tencent';
  region: string;
  status: 'connected' | 'disconnected' | 'error';
  vpcCount: number;
  instanceCount: number;
  monthlyCost: number;
  connectedAt: string;
}

const mockProviders: CloudProvider[] = [
  { id: 'cp1', name: 'AWS Production', type: 'aws', region: 'us-east-1', status: 'connected', vpcCount: 3, instanceCount: 45, monthlyCost: 12500, connectedAt: '2025-01-15' },
  { id: 'cp2', name: 'Azure Staging', type: 'azure', region: 'eastus', status: 'connected', vpcCount: 2, instanceCount: 20, monthlyCost: 8200, connectedAt: '2025-02-20' },
  { id: 'cp3', name: 'GCP Analytics', type: 'gcp', region: 'us-central1', status: 'error', vpcCount: 1, instanceCount: 5, monthlyCost: 3100, connectedAt: '2025-03-10' },
];

const providerTypeColor: Record<string, string> = {
  aws: 'orange',
  azure: 'blue',
  gcp: 'red',
  alicloud: 'green',
  tencent: 'cyan',
};

const MultiCloudPage: React.FC = () => {
  const [providers, setProviders] = useState<CloudProvider[]>(mockProviders);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      message.error('Failed to load multi-cloud data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    const newProvider: CloudProvider = {
      id: `cp${Date.now()}`,
      name: values.name,
      type: values.type,
      region: values.region,
      status: 'disconnected',
      vpcCount: 0,
      instanceCount: 0,
      monthlyCost: 0,
      connectedAt: new Date().toISOString().split('T')[0],
    };
    setProviders([...providers, newProvider]);
    message.success('Cloud provider registered');
    setCreateModalOpen(false);
    form.resetFields();
  };

  const handleConnect = async (id: string) => {
    setProviders(providers.map((p) => (p.id === id ? { ...p, status: 'connected' as const } : p)));
    message.success('Provider connected');
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Provider',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color={providerTypeColor[v]}>{v.toUpperCase()}</Tag>,
    },
    { title: 'Region', dataIndex: 'region', key: 'region' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={v === 'connected' ? 'green' : v === 'error' ? 'red' : 'default'}>{v}</Tag>,
    },
    { title: 'VPCs', dataIndex: 'vpcCount', key: 'vpcCount' },
    { title: 'Instances', dataIndex: 'instanceCount', key: 'instanceCount' },
    { title: 'Monthly Cost', dataIndex: 'monthlyCost', key: 'monthlyCost', render: (v: number) => `$${v.toLocaleString()}` },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: CloudProvider) => (
        <Space>
          {record.status === 'disconnected' && (
            <Button size="small" onClick={() => handleConnect(record.id)}>Connect</Button>
          )}
        </Space>
      ),
    },
  ];

  const totalCost = providers.reduce((s, p) => s + p.monthlyCost, 0);
  const totalInstances = providers.reduce((s, p) => s + p.instanceCount, 0);

  const tabItems = [
    {
      key: 'providers',
      label: 'Cloud Providers',
      children: (
        <Table columns={columns} dataSource={providers} rowKey="id" loading={loading} pagination={false} />
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <CloudOutlined /> Multi-Cloud Management
          </Title>
          <Text type="secondary">Manage cloud providers, costs, and cross-cloud orchestration</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Add Provider
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Providers" value={providers.length} prefix={<CloudServerOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Connected" value={providers.filter((p) => p.status === 'connected').length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Total Instances" value={totalInstances} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Total Monthly Cost" value={`$${totalCost.toLocaleString()}`} /></Card>
        </Col>
      </Row>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Add Cloud Provider"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="Provider display name" />
          </Form.Item>
          <Form.Item label="Provider" name="type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'aws', label: 'AWS' },
                { value: 'azure', label: 'Azure' },
                { value: 'gcp', label: 'Google Cloud' },
                { value: 'alicloud', label: 'AliCloud' },
                { value: 'tencent', label: 'Tencent Cloud' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Region" name="region" rules={[{ required: true }]}>
            <Input placeholder="us-east-1" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MultiCloudPage;
