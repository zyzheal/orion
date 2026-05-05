/**
 * Federation Scheduling Page
 * Phase 3 - Cross-cluster scheduling, resource allocation, and cluster management
 */
import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
} from 'antd';
import {
  ClusterOutlined,
  PlusOutlined,
  ReloadOutlined,
  GlobalOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface ClusterNode {
  id: string;
  name: string;
  region: string;
  zone: string;
  status: 'online' | 'offline' | 'degraded';
  cpuCapacity: number;
  memoryCapacity: number;
  cpuUsed: number;
  memoryUsed: number;
  podCount: number;
  podCapacity: number;
}

interface SchedulePolicy {
  id: string;
  name: string;
  type: 'least_loaded' | 'affinity' | 'latency' | 'cost_optimized';
  clusters: string[];
  enabled: boolean;
}

const mockClusters: ClusterNode[] = [
  { id: 'c1', name: 'cluster-us-east-1', region: 'us-east', zone: 'a', status: 'online', cpuCapacity: 64, memoryCapacity: 256, cpuUsed: 32, memoryUsed: 128, podCount: 45, podCapacity: 110 },
  { id: 'c2', name: 'cluster-us-west-2', region: 'us-west', zone: 'b', status: 'online', cpuCapacity: 32, memoryCapacity: 128, cpuUsed: 20, memoryUsed: 80, podCount: 30, podCapacity: 55 },
  { id: 'c3', name: 'cluster-eu-west-1', region: 'eu-west', zone: 'a', status: 'degraded', cpuCapacity: 48, memoryCapacity: 192, cpuUsed: 44, memoryUsed: 180, podCount: 50, podCapacity: 80 },
];

const mockPolicies: SchedulePolicy[] = [
  { id: 'p1', name: 'Default Least Loaded', type: 'least_loaded', clusters: ['c1', 'c2', 'c3'], enabled: true },
  { id: 'p2', name: 'EU Affinity', type: 'affinity', clusters: ['c3'], enabled: true },
  { id: 'p3', name: 'Cost Optimizer', type: 'cost_optimized', clusters: ['c1', 'c2'], enabled: false },
];

const FederationPage: React.FC = () => {
  const [clusters, setClusters] = useState<ClusterNode[]>(mockClusters);
  const [policies, setPolicies] = useState<SchedulePolicy[]>(mockPolicies);
  const [loading, setLoading] = useState(false);
  const [createClusterModal, setCreateClusterModal] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      // Placeholder: would call API in production
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      message.error('Failed to load federation data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCluster = async (values: any) => {
    const newCluster: ClusterNode = {
      id: `c${Date.now()}`,
      name: values.name,
      region: values.region,
      zone: values.zone,
      status: 'online',
      cpuCapacity: parseInt(values.cpuCapacity) || 32,
      memoryCapacity: parseInt(values.memoryCapacity) || 128,
      cpuUsed: 0,
      memoryUsed: 0,
      podCount: 0,
      podCapacity: parseInt(values.podCapacity) || 110,
    };
    setClusters([...clusters, newCluster]);
    message.success('Cluster registered');
    setCreateClusterModal(false);
    form.resetFields();
  };

  const togglePolicy = (id: string) => {
    setPolicies(policies.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
    message.success('Policy toggled');
  };

  const statusColor: Record<string, string> = {
    online: 'green',
    offline: 'red',
    degraded: 'orange',
  };

  const clusterColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Region', dataIndex: 'region', key: 'region' },
    { title: 'Zone', dataIndex: 'zone', key: 'zone' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    { title: 'CPU Used', dataIndex: 'cpuUsed', key: 'cpuUsed', render: (v: number, r: ClusterNode) => `${v}/${r.cpuCapacity} cores` },
    { title: 'Memory Used', dataIndex: 'memoryUsed', key: 'memoryUsed', render: (v: number, r: ClusterNode) => `${v}/${r.memoryCapacity} GB` },
    { title: 'Pods', dataIndex: 'podCount', key: 'podCount', render: (v: number, r: ClusterNode) => `${v}/${r.podCapacity}` },
  ];

  const policyColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Clusters',
      dataIndex: 'clusters',
      key: 'clusters',
      render: (v: string[]) => v.map((c) => <Tag key={c}>{c}</Tag>),
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: SchedulePolicy) => (
        <Button size="small" onClick={() => togglePolicy(record.id)}>
          {record.enabled ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
  ];

  const totalPods = clusters.reduce((s, c) => s + c.podCount, 0);
  const totalCpuUsed = clusters.reduce((s, c) => s + c.cpuUsed, 0);
  const totalCpuCap = clusters.reduce((s, c) => s + c.cpuCapacity, 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <GlobalOutlined /> Federation Scheduling
          </Title>
          <Text type="secondary">Cross-cluster scheduling and resource management</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateClusterModal(true)}>
            Register Cluster
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Clusters" value={clusters.length} prefix={<ClusterOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Total Pods" value={totalPods} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="CPU Utilization" value={totalCpuCap > 0 ? ((totalCpuUsed / totalCpuCap) * 100).toFixed(1) : 0} suffix="%" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Active Policies" value={policies.filter((p) => p.enabled).length} /></Card>
        </Col>
      </Row>

      {/* Cluster List */}
      <Card title="Registered Clusters" style={{ marginBottom: 24 }}>
        <Table columns={clusterColumns} dataSource={clusters} rowKey="id" loading={loading} pagination={false} />
      </Card>

      {/* Schedule Policies */}
      <Card title="Scheduling Policies">
        <Table columns={policyColumns} dataSource={policies} rowKey="id" loading={loading} pagination={false} />
      </Card>

      {/* Create Cluster Modal */}
      <Modal
        title="Register Cluster"
        open={createClusterModal}
        onCancel={() => setCreateClusterModal(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateCluster}>
          <Form.Item label="Cluster Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="cluster-name" />
          </Form.Item>
          <Form.Item label="Region" name="region" rules={[{ required: true }]}>
            <Input placeholder="us-east" />
          </Form.Item>
          <Form.Item label="Zone" name="zone" rules={[{ required: true }]}>
            <Input placeholder="a" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="CPU Capacity" name="cpuCapacity" initialValue="32">
                <Input placeholder="cores" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Memory Capacity (GB)" name="memoryCapacity" initialValue="128">
                <Input placeholder="GB" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Pod Capacity" name="podCapacity" initialValue="110">
                <Input placeholder="max pods" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default FederationPage;
