/**
 * Performance Engineering Page
 * Phase 3 - Performance testing, load testing, and bottleneck analysis
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
} from 'antd';
import {
  RocketOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface PerformanceTest {
  id: string;
  name: string;
  type: 'load' | 'stress' | 'spike' | 'soak' | 'baseline';
  target: string;
  status: 'running' | 'completed' | 'failed' | 'scheduled';
  concurrentUsers: number;
  duration: number;
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  runAt?: string;
  createdAt: string;
}

interface Bottleneck {
  id: string;
  service: string;
  type: 'cpu' | 'memory' | 'network' | 'database' | 'lock';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  detectedAt: string;
}

const mockTests: PerformanceTest[] = [
  { id: 'pt1', name: 'API Load Test', type: 'load', target: '/api/v1/users', status: 'completed', concurrentUsers: 500, duration: 300, rps: 2500, p50: 45, p95: 120, p99: 350, errorRate: 0.01, runAt: '2026-05-05 09:00', createdAt: '2026-05-01' },
  { id: 'pt2', name: 'Checkout Stress', type: 'stress', target: '/api/v1/checkout', status: 'completed', concurrentUsers: 2000, duration: 600, rps: 800, p50: 200, p95: 800, p99: 2500, errorRate: 0.05, runAt: '2026-05-04 14:00', createdAt: '2026-04-28' },
  { id: 'pt3', name: 'Spike Test', type: 'spike', target: '/api/v1/search', status: 'running', concurrentUsers: 100, duration: 180, rps: 0, p50: 0, p95: 0, p99: 0, errorRate: 0, createdAt: '2026-05-05' },
];

const mockBottlenecks: Bottleneck[] = [
  { id: 'bn1', service: 'user-service', type: 'database', severity: 'high', description: 'Slow query on user lookup (avg 250ms)', detectedAt: '2026-05-05 09:15' },
  { id: 'bn2', service: 'checkout-service', type: 'lock', severity: 'critical', description: 'Lock contention during peak checkout', detectedAt: '2026-05-04 14:30' },
  { id: 'bn3', service: 'search-service', type: 'memory', severity: 'medium', description: 'Memory usage > 80% under load', detectedAt: '2026-05-05 10:00' },
];

const PerformancePage: React.FC = () => {
  const [tests, setTests] = useState<PerformanceTest[]>(mockTests);
  const [bottlenecks] = useState<Bottleneck[]>(mockBottlenecks);
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
      message.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    const newTest: PerformanceTest = {
      id: `pt${Date.now()}`,
      name: values.name,
      type: values.type,
      target: values.target,
      status: 'scheduled',
      concurrentUsers: parseInt(values.concurrentUsers) || 100,
      duration: parseInt(values.duration) || 300,
      rps: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      errorRate: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setTests([...tests, newTest]);
    message.success('Performance test created');
    setCreateModalOpen(false);
    form.resetFields();
  };

  const typeColor: Record<string, string> = {
    load: 'blue',
    stress: 'red',
    spike: 'orange',
    soak: 'purple',
    baseline: 'green',
  };

  const statusColor: Record<string, string> = {
    running: 'blue',
    completed: 'green',
    failed: 'red',
    scheduled: 'gold',
  };

  const testColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color={typeColor[v]}>{v}</Tag>,
    },
    { title: 'Target', dataIndex: 'target', key: 'target' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    { title: 'Concurrent', dataIndex: 'concurrentUsers', key: 'concurrentUsers' },
    { title: 'RPS', dataIndex: 'rps', key: 'rps', render: (v: number) => v > 0 ? v.toLocaleString() : '-' },
    { title: 'P50 (ms)', dataIndex: 'p50', key: 'p50', render: (v: number) => v > 0 ? `${v}ms` : '-' },
    { title: 'P95 (ms)', dataIndex: 'p95', key: 'p95', render: (v: number) => v > 0 ? `${v}ms` : '-' },
    { title: 'P99 (ms)', dataIndex: 'p99', key: 'p99', render: (v: number) => v > 0 ? `${v}ms` : '-' },
    { title: 'Error Rate', dataIndex: 'errorRate', key: 'errorRate', render: (v: number) => `${(v * 100).toFixed(2)}%` },
  ];

  const bottleneckColumns = [
    { title: 'Service', dataIndex: 'service', key: 'service' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color="cyan">{v}</Tag>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (v: string) => (
        <Tag color={v === 'critical' ? 'red' : v === 'high' ? 'orange' : v === 'medium' ? 'blue' : 'default'}>
          {v}
        </Tag>
      ),
    },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Detected', dataIndex: 'detectedAt', key: 'detectedAt' },
  ];

  const completedTests = tests.filter((t) => t.status === 'completed');
  const avgP95 = completedTests.length > 0
    ? completedTests.reduce((s, t) => s + t.p95, 0) / completedTests.length
    : 0;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ThunderboltOutlined /> Performance Engineering
          </Title>
          <Text type="secondary">Performance testing, load testing, and bottleneck analysis</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<RocketOutlined />} onClick={() => setCreateModalOpen(true)}>
            New Test
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Tests" value={tests.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Completed" value={completedTests.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Avg P95" value={avgP95.toFixed(0)} suffix="ms" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Bottlenecks" value={bottlenecks.length} /></Card>
        </Col>
      </Row>

      {/* Test Results */}
      <Card title="Performance Tests" style={{ marginBottom: 24 }}>
        <Table columns={testColumns} dataSource={tests} rowKey="id" loading={loading} pagination={false} />
      </Card>

      {/* Bottlenecks */}
      <Card title="Detected Bottlenecks">
        <Table columns={bottleneckColumns} dataSource={bottlenecks} rowKey="id" loading={loading} pagination={false} />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Create Performance Test"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="Test name" />
          </Form.Item>
          <Form.Item label="Type" name="type" initialValue="load" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'load', label: 'Load Test' },
                { value: 'stress', label: 'Stress Test' },
                { value: 'spike', label: 'Spike Test' },
                { value: 'soak', label: 'Soak Test' },
                { value: 'baseline', label: 'Baseline Test' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Target" name="target" rules={[{ required: true }]}>
            <Input placeholder="/api/v1/endpoint" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Concurrent Users" name="concurrentUsers" initialValue="100">
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Duration (seconds)" name="duration" initialValue="300">
                <Input type="number" min={10} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default PerformancePage;
