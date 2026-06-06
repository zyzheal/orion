/**
 * Executor Management Page
 * Phase 3 - Executor registration, heartbeat monitoring, and health dashboard
 */
import React, { useState, useEffect } from 'react';
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
  Descriptions,
  Progress,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DashboardOutlined,
  DeleteOutlined,
  HeartOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface ExecutorInfo {
  id: string;
  cluster_id: string;
  name: string;
  region: string;
  status: 'online' | 'offline' | 'degraded';
  cpu_capacity: number;
  memory_capacity_mb: number;
  cpu_used: number;
  memory_used_mb: number;
  running_jobs: number;
  max_concurrent_jobs: number;
  last_heartbeat: string | null;
  registered_at: string;
  labels: Record<string, any>;
}

interface ExecutorHealth {
  executor_id: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  cpu_usage_pct: number;
  memory_usage_pct: number;
  running_jobs: number;
  queue_depth: number;
  last_heartbeat: string;
  response_time_ms: number;
  errors_last_hour: number;
}

interface ExecutorDashboard {
  total_executors: number;
  online_executors: number;
  offline_executors: number;
  degraded_executors: number;
  total_running_jobs: number;
  avg_cpu_usage: number;
  avg_memory_usage: number;
  executors: ExecutorInfo[];
  health: ExecutorHealth[];
}

const mockExecutors: ExecutorInfo[] = [
  { id: 'exec-1', cluster_id: 'c1', name: 'executor-us-east-1a', region: 'us-east', status: 'online', cpu_capacity: 16, memory_capacity_mb: 32768, cpu_used: 8, memory_used_mb: 16384, running_jobs: 3, max_concurrent_jobs: 10, last_heartbeat: new Date().toISOString(), registered_at: '2026-04-01T00:00:00Z', labels: { tier: 'standard' } },
  { id: 'exec-2', cluster_id: 'c2', name: 'executor-eu-west-1b', region: 'eu-west', status: 'online', cpu_capacity: 32, memory_capacity_mb: 65536, cpu_used: 28, memory_used_mb: 58000, running_jobs: 8, max_concurrent_jobs: 10, last_heartbeat: new Date().toISOString(), registered_at: '2026-04-05T00:00:00Z', labels: { tier: 'high-performance' } },
  { id: 'exec-3', cluster_id: 'c3', name: 'executor-ap-northeast-1c', region: 'ap-northeast', status: 'degraded', cpu_capacity: 16, memory_capacity_mb: 32768, cpu_used: 15, memory_used_mb: 31000, running_jobs: 10, max_concurrent_jobs: 10, last_heartbeat: new Date(Date.now() - 300000).toISOString(), registered_at: '2026-04-10T00:00:00Z', labels: { tier: 'standard' } },
];

const mockHealth: ExecutorHealth[] = mockExecutors.map(e => ({
  executor_id: e.id,
  status: e.status === 'online' && e.cpu_used / e.cpu_capacity < 0.9 ? 'healthy' : 'degraded',
  cpu_usage_pct: Math.round((e.cpu_used / e.cpu_capacity) * 1000) / 10,
  memory_usage_pct: Math.round((e.memory_used_mb / e.memory_capacity_mb) * 1000) / 10,
  running_jobs: e.running_jobs,
  queue_depth: e.running_jobs >= e.max_concurrent_jobs ? 3 : 0,
  last_heartbeat: e.last_heartbeat!,
  response_time_ms: Math.floor(Math.random() * 50) + 5,
  errors_last_hour: Math.floor(Math.random() * 3),
}));

const ExecutorManagementPage: React.FC = () => {
  const [executors, setExecutors] = useState<ExecutorInfo[]>(mockExecutors);
  const [health, setHealth] = useState<ExecutorHealth[]>(mockHealth);
  const [dashboard, setDashboard] = useState<ExecutorDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedExecutor, setSelectedExecutor] = useState<ExecutorInfo | null>(null);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Placeholder: would call API in production
      await new Promise((r) => setTimeout(r, 500));
      const totalRunningJobs = executors.reduce((s, e) => s + e.running_jobs, 0);
      const avgCpu = health.length > 0 ? Math.round((health.reduce((s, h) => s + h.cpu_usage_pct, 0) / health.length) * 10) / 10 : 0;
      const avgMem = health.length > 0 ? Math.round((health.reduce((s, h) => s + h.memory_usage_pct, 0) / health.length) * 10) / 10 : 0;
      setDashboard({
        total_executors: executors.length,
        online_executors: executors.filter(e => e.status === 'online').length,
        offline_executors: executors.filter(e => e.status === 'offline').length,
        degraded_executors: executors.filter(e => e.status === 'degraded').length,
        total_running_jobs: totalRunningJobs,
        avg_cpu_usage: avgCpu,
        avg_memory_usage: avgMem,
        executors,
        health,
      });
    } catch {
      message.error('Failed to load executor data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExecutor = async (values: any) => {
    const newExecutor: ExecutorInfo = {
      id: `exec-${Date.now()}`,
      cluster_id: values.cluster_id,
      name: values.name,
      region: values.region,
      status: 'online',
      cpu_capacity: parseInt(values.cpu_capacity) || 16,
      memory_capacity_mb: (parseInt(values.memory_capacity_mb) || 32) * 1024,
      cpu_used: 0,
      memory_used_mb: 0,
      running_jobs: 0,
      max_concurrent_jobs: parseInt(values.max_concurrent_jobs) || 10,
      last_heartbeat: new Date().toISOString(),
      registered_at: new Date().toISOString(),
      labels: {},
    };
    setExecutors([...executors, newExecutor]);
    setHealth([...health, {
      executor_id: newExecutor.id,
      status: 'healthy',
      cpu_usage_pct: 0,
      memory_usage_pct: 0,
      running_jobs: 0,
      queue_depth: 0,
      last_heartbeat: new Date().toISOString(),
      response_time_ms: 5,
      errors_last_hour: 0,
    }]);
    message.success('Executor registered');
    setCreateModalOpen(false);
    form.resetFields();
    loadData();
  };

  const handleDeregister = (id: string) => {
    setExecutors(executors.filter(e => e.id !== id));
    setHealth(health.filter(h => h.executor_id !== id));
    message.success('Executor deregistered');
    loadData();
  };

  const showHealthDetail = (executor: ExecutorInfo) => {
    setSelectedExecutor(executor);
    setHealthModalOpen(true);
  };

  const statusColor: Record<string, string> = { online: 'green', offline: 'red', degraded: 'orange' };
  const healthColor: Record<string, string> = { healthy: 'green', unhealthy: 'red', degraded: 'orange' };

  const executorColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Cluster', dataIndex: 'cluster_id', key: 'cluster_id' },
    { title: 'Region', dataIndex: 'region', key: 'region' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag> },
    { title: 'Jobs', dataIndex: 'running_jobs', key: 'running_jobs', render: (v: number, r: ExecutorInfo) => `${v}/${r.max_concurrent_jobs}` },
    { title: 'CPU', dataIndex: 'cpu_used', key: 'cpu_used', render: (v: number, r: ExecutorInfo) => `${v}/${r.cpu_capacity} cores` },
    { title: 'Memory', dataIndex: 'memory_used_mb', key: 'memory_used_mb', render: (v: number, r: ExecutorInfo) => `${Math.round(v / 1024)}/${Math.round(r.memory_capacity_mb / 1024)} GB` },
    { title: 'Last Heartbeat', dataIndex: 'last_heartbeat', key: 'last_heartbeat', render: (v: string) => v ? new Date(v).toLocaleString() : 'Never' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ExecutorInfo) => (
        <Space>
          <Button size="small" icon={<HeartOutlined />} onClick={() => showHealthDetail(record)}>Health</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeregister(record.id)}>Deregister</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} /> Executor Management
          </Title>
          <Text type="secondary">Executor registration, heartbeat monitoring, and health dashboard</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>Register Executor</Button>
        </Space>
      </div>

      {/* Dashboard Stats */}
      {dashboard && (
        <Row gutter={24} style={{ marginBottom: spacing.lg }}>
          <Col span={6}><Card><Statistic title="Total Executors" value={dashboard.total_executors} prefix={<DashboardOutlined />} /></Card></Col>
          <Col span={6}><Card><Statistic title="Online" value={dashboard.online_executors} valueStyle={{ color: colors.success[500] }} /></Card></Col>
          <Col span={6}><Card><Statistic title="Degraded" value={dashboard.degraded_executors} valueStyle={{ color: colors.warning[500] }} /></Card></Col>
          <Col span={6}><Card><Statistic title="Running Jobs" value={dashboard.total_running_jobs} /></Card></Col>
        </Row>
      )}

      {/* Utilization Summary */}
      {dashboard && (
        <Card title="Resource Utilization" style={{ marginBottom: spacing.lg }}>
          <Row gutter={24}>
            <Col span={12}>
              <Text>CPU Usage (avg)</Text>
              <Progress percent={Math.round(dashboard.avg_cpu_usage)} status={dashboard.avg_cpu_usage > 80 ? 'exception' : 'normal'} />
            </Col>
            <Col span={12}>
              <Text>Memory Usage (avg)</Text>
              <Progress percent={Math.round(dashboard.avg_memory_usage)} status={dashboard.avg_memory_usage > 80 ? 'exception' : 'normal'} />
            </Col>
          </Row>
        </Card>
      )}

      {/* Executor List */}
      <Card title="Registered Executors">
        <Table columns={executorColumns} dataSource={executors} rowKey="id" loading={loading} pagination={false}
          locale={{ emptyText: executors.length === 0 ? '暂无执行器数据' : undefined }} />
      </Card>

      {/* Create Executor Modal */}
      <Modal title="Register Executor" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreateExecutor}>
          <Form.Item label="Executor Name" name="name" rules={[{ required: true }]}><Input placeholder="executor-name" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="Cluster ID" name="cluster_id" rules={[{ required: true }]}><Input placeholder="cluster-id" /></Form.Item></Col>
            <Col span={12}><Form.Item label="Region" name="region" rules={[{ required: true }]}><Input placeholder="us-east" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item label="CPU Capacity" name="cpu_capacity" initialValue="16"><Input placeholder="cores" /></Form.Item></Col>
            <Col span={8}><Form.Item label="Memory (GB)" name="memory_capacity_mb" initialValue="32"><Input placeholder="GB" /></Form.Item></Col>
            <Col span={8}><Form.Item label="Max Jobs" name="max_concurrent_jobs" initialValue="10"><Input placeholder="concurrent jobs" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Health Detail Modal */}
      <Modal title="Executor Health Detail" open={healthModalOpen} onCancel={() => setHealthModalOpen(false)} footer={null} width={600}>
        {selectedExecutor && (() => {
          const h = health.find(x => x.executor_id === selectedExecutor.id);
          return h ? (
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Executor">{selectedExecutor.name}</Descriptions.Item>
              <Descriptions.Item label="Health Status"><Tag color={healthColor[h.status]}>{h.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="CPU Usage"><Progress percent={Math.round(h.cpu_usage_pct)} size="small" /></Descriptions.Item>
              <Descriptions.Item label="Memory Usage"><Progress percent={Math.round(h.memory_usage_pct)} size="small" /></Descriptions.Item>
              <Descriptions.Item label="Running Jobs">{h.running_jobs}</Descriptions.Item>
              <Descriptions.Item label="Queue Depth">{h.queue_depth}</Descriptions.Item>
              <Descriptions.Item label="Response Time">{h.response_time_ms} ms</Descriptions.Item>
              <Descriptions.Item label="Errors (last hour)">{h.errors_last_hour}</Descriptions.Item>
              <Descriptions.Item label="Last Heartbeat">{new Date(h.last_heartbeat).toLocaleString()}</Descriptions.Item>
            </Descriptions>
          ) : <Text>No health data available</Text>;
        })()}
      </Modal>
    </div>
  );
};

export default ExecutorManagementPage;
