/**
 * Executor Management Page
 * Phase 3 - Executor registration, heartbeat monitoring, and health dashboard
 */
import React, { useState, useEffect, useCallback } from 'react';
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
import { federationApi, type FederationCluster, type ClusterHealth } from '@/api/federation';

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

const mapClusterToExecutor = (c: FederationCluster): ExecutorInfo => ({
  id: c.id,
  cluster_id: c.id,
  name: c.name,
  region: c.region,
  status: c.status === 'active' ? 'online' : c.status === 'inactive' ? 'offline' : 'degraded',
  cpu_capacity: 0,
  memory_capacity_mb: 0,
  cpu_used: 0,
  memory_used_mb: 0,
  running_jobs: 0,
  max_concurrent_jobs: 0,
  last_heartbeat: c.registeredAt,
  registered_at: c.registeredAt,
  labels: {},
});

const mapHealthToExecutor = (h: ClusterHealth): ExecutorHealth => ({
  executor_id: h.clusterId,
  status: h.status,
  cpu_usage_pct: h.cpuUsage,
  memory_usage_pct: h.memoryUsage,
  running_jobs: h.podCount,
  queue_depth: 0,
  last_heartbeat: h.lastChecked,
  response_time_ms: 0,
  errors_last_hour: 0,
});

const ExecutorManagementPage: React.FC = () => {
  const [executors, setExecutors] = useState<ExecutorInfo[]>([]);
  const [health, setHealth] = useState<ExecutorHealth[]>([]);
  const [dashboard, setDashboard] = useState<ExecutorDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedExecutor, setSelectedExecutor] = useState<ExecutorInfo | null>(null);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const clusters = await federationApi.listClusters();
      const mapped = clusters.map(mapClusterToExecutor);
      setExecutors(mapped);

      const healthResults: ExecutorHealth[] = [];
      for (const cluster of clusters) {
        try {
          const h = await federationApi.getClusterHealth(cluster.id);
          healthResults.push(mapHealthToExecutor(h));
        } catch { /* skip */ }
      }
      setHealth(healthResults);

      const totalRunningJobs = mapped.reduce((s, e) => s + e.running_jobs, 0);
      const avgCpu = healthResults.length > 0 ? Math.round((healthResults.reduce((s, h) => s + h.cpu_usage_pct, 0) / healthResults.length) * 10) / 10 : 0;
      const avgMem = healthResults.length > 0 ? Math.round((healthResults.reduce((s, h) => s + h.memory_usage_pct, 0) / healthResults.length) * 10) / 10 : 0;
      setDashboard({
        total_executors: mapped.length,
        online_executors: mapped.filter(e => e.status === 'online').length,
        offline_executors: mapped.filter(e => e.status === 'offline').length,
        degraded_executors: mapped.filter(e => e.status === 'degraded').length,
        total_running_jobs: totalRunningJobs,
        avg_cpu_usage: avgCpu,
        avg_memory_usage: avgMem,
        executors: mapped,
        health: healthResults,
      });
    } catch {
      message.error('加载集群数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateExecutor = async (values: any) => {
    try {
      await federationApi.registerCluster({
        name: values.name,
        provider: values.cluster_id,
        region: values.region,
        endpoint: '',
      });
      message.success('集群注册成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch {
      message.error('集群注册失败');
    }
  };

  const handleDeregister = async (id: string) => {
    try {
      // Federation API doesn't have a delete endpoint, remove from local state
      setExecutors(executors.filter(e => e.id !== id));
      setHealth(health.filter(h => h.executor_id !== id));
      message.success('执行器已移除');
      loadData();
    } catch {
      message.error('移除失败');
    }
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
