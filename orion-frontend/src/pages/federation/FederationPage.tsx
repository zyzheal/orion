/**
 * Federation Scheduling Page
 * Phase 4 - Cross-cluster scheduling, resource allocation, and cluster management
 *
 * Features:
 * - Cluster registration and health monitoring
 * - Cross-cluster job management
 * - Resource pool management
 */
import React, { useState, useEffect, useMemo } from 'react';
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
  Tabs,
  InputNumber,
  Select,
  Progress,
} from 'antd';
import {
  ClusterOutlined,
  PlusOutlined,
  ReloadOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import {
  federationApi,
  type FederationCluster,
  type ClusterHealth,
  type CrossClusterJob,
  type ResourcePool,
} from '@/api/federation';

const { Title, Text } = Typography;

const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  degraded: 'orange',
  healthy: 'green',
  unhealthy: 'red',
};

const statusLabelMap: Record<string, string> = {
  active: '活跃',
  inactive: '未激活',
  degraded: '降级',
  healthy: '健康',
  unhealthy: '不健康',
};

const FederationPage: React.FC = () => {
  const [clusters, setClusters] = useState<FederationCluster[]>([]);
  const [clusterHealth, setClusterHealth] = useState<Record<string, ClusterHealth>>({});
  const [jobs, setJobs] = useState<CrossClusterJob[]>([]);
  const [resourcePools, setResourcePools] = useState<ResourcePool[]>([]);
  const [loading, setLoading] = useState(false);
  const [createClusterModal, setCreateClusterModal] = useState(false);
  const [createJobModal, setCreateJobModal] = useState(false);
  const [createPoolModal, setCreatePoolModal] = useState(false);
  const [clusterForm] = Form.useForm();
  const [jobForm] = Form.useForm();
  const [poolForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clustersRes, jobsRes, poolsRes] = await Promise.allSettled([
        federationApi.listClusters(),
        federationApi.listJobs(),
        federationApi.listResourcePools(),
      ]);

      if (clustersRes.status === 'fulfilled') {
        const clusterList = Array.isArray(clustersRes.value) ? clustersRes.value : [];
        setClusters(clusterList);

        // Load health for each cluster
        const healthMap: Record<string, ClusterHealth> = {};
        await Promise.all(
          clusterList.map(async (c) => {
            try {
              const health = await federationApi.getClusterHealth(c.id);
              healthMap[c.id] = health;
            } catch {
              // Ignore individual health failures
            }
          })
        );
        setClusterHealth(healthMap);
      }
      if (jobsRes.status === 'fulfilled') {
        setJobs(Array.isArray(jobsRes.value) ? jobsRes.value : []);
      }
      if (poolsRes.status === 'fulfilled') {
        setResourcePools(Array.isArray(poolsRes.value) ? poolsRes.value : []);
      }
    } catch (error: unknown) {
      message.error(`加载联邦数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCluster = async (values: any) => {
    try {
      await federationApi.registerCluster({
        name: values.name,
        provider: values.provider,
        region: values.region,
        endpoint: values.endpoint || '',
      });
      message.success('集群注册成功');
      setCreateClusterModal(false);
      clusterForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`注册失败: ${(error as Error).message}`);
    }
  };

  const handleSubmitJob = async (values: any) => {
    try {
      await federationApi.submitCrossClusterJob({
        name: values.name,
        targetClusters: values.targetClusters,
        spec: {},
      });
      message.success('跨集群作业提交成功');
      setCreateJobModal(false);
      jobForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`提交失败: ${(error as Error).message}`);
    }
  };

  const handleCreatePool = async (values: any) => {
    try {
      await federationApi.createResourcePool({
        name: values.name,
        clusterId: values.clusterId,
        cpuCores: values.cpuCores,
        memoryMb: values.memoryMb,
      });
      message.success('资源池创建成功');
      setCreatePoolModal(false);
      poolForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建失败: ${(error as Error).message}`);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: clusters.length,
    active: clusters.filter((c) => c.status === 'active').length,
    totalJobs: jobs.length,
    runningJobs: jobs.filter((j) => j.status === 'running').length,
    totalPools: resourcePools.length,
  }), [clusters, jobs, resourcePools]);

  // Cluster columns
  const clusterColumns = [
    { title: '集群名称', dataIndex: 'name', key: 'name', width: 180 },
    { title: '提供商', dataIndex: 'provider', key: 'provider', width: 100 },
    { title: '区域', dataIndex: 'region', key: 'region', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusColorMap[v] || 'default'}>{statusLabelMap[v] || v}</Tag>,
    },
    { title: '节点数', dataIndex: 'nodeCount', key: 'nodeCount', width: 80 },
    {
      title: 'CPU 使用率',
      key: 'cpuUsage',
      width: 140,
      render: (_: unknown, record: FederationCluster) => {
        const health = clusterHealth[record.id];
        const usage = health?.cpuUsage ?? 0;
        return <Progress percent={Math.round(usage * 100)} size="small" status={usage > 0.8 ? 'exception' : undefined} />;
      },
    },
    {
      title: '内存使用率',
      key: 'memoryUsage',
      width: 140,
      render: (_: unknown, record: FederationCluster) => {
        const health = clusterHealth[record.id];
        const usage = health?.memoryUsage ?? 0;
        return <Progress percent={Math.round(usage * 100)} size="small" status={usage > 0.8 ? 'exception' : undefined} />;
      },
    },
    {
      title: '注册时间',
      dataIndex: 'registeredAt',
      key: 'registeredAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  // Job columns
  const jobColumns = [
    { title: '作业名称', dataIndex: 'name', key: 'name', width: 160 },
    {
      title: '目标集群',
      dataIndex: 'targetClusters',
      key: 'targetClusters',
      width: 200,
      render: (v: string[]) => (v || []).slice(0, 3).map((id: string) => <Tag key={id}>{id.slice(0, 8)}</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const jobColorMap: Record<string, string> = { pending: 'default', running: 'processing', completed: 'success', failed: 'error' };
        const jobLabelMap: Record<string, string> = { pending: '等待中', running: '运行中', completed: '已完成', failed: '失败' };
        return <Tag color={jobColorMap[v]}>{jobLabelMap[v]}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  // Resource pool columns
  const poolColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 140 },
    { title: '集群', dataIndex: 'clusterId', key: 'clusterId', width: 140, render: (v: string) => v.slice(0, 12) },
    { title: 'CPU 核心', dataIndex: 'cpuCores', key: 'cpuCores', width: 100 },
    { title: '内存 (MB)', dataIndex: 'memoryMb', key: 'memoryMb', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => <Tag color={statusColorMap[v]}>{statusLabelMap[v]}</Tag>,
    },
  ];

  const tabItems = [
    {
      key: 'clusters',
      label: '集群管理',
      children: (
        <Table
          columns={clusterColumns}
          dataSource={clusters}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'jobs',
      label: '跨集群作业',
      children: (
        <Table
          columns={jobColumns}
          dataSource={jobs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'pools',
      label: '资源池',
      children: (
        <Table
          columns={poolColumns}
          dataSource={resourcePools}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <GlobalOutlined style={{ marginRight: 8 }} />
            联邦调度
          </Title>
          <Text type="secondary">跨集群调度和资源管理</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateClusterModal(true)}>
            注册集群
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setCreateJobModal(true)}>
            提交作业
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setCreatePoolModal(true)}>
            创建资源池
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={5}>
          <Card>
            <Statistic title="集群总数" value={stats.total} prefix={<ClusterOutlined />} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="活跃集群" value={stats.active} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="运行中作业" value={stats.runningJobs} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="总作业数" value={stats.totalJobs} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="资源池" value={stats.totalPools} />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* Create Cluster Modal */}
      <Modal
        title="注册集群"
        open={createClusterModal}
        onCancel={() => setCreateClusterModal(false)}
        onOk={() => clusterForm.submit()}
        width={600}
      >
        <Form form={clusterForm} layout="vertical" onFinish={handleCreateCluster}>
          <Form.Item label="集群名称" name="name" rules={[{ required: true, message: '请输入集群名称' }]}>
            <Input placeholder="如: cluster-us-east-1" />
          </Form.Item>
          <Form.Item label="提供商" name="provider" rules={[{ required: true, message: '请选择提供商' }]}>
            <Select
              options={[
                { label: 'AWS EKS', value: 'aws' },
                { label: 'Azure AKS', value: 'azure' },
                { label: 'GCP GKE', value: 'gcp' },
                { label: '阿里云 ACK', value: 'aliyun' },
                { label: '自建 K8s', value: 'self-hosted' },
              ]}
            />
          </Form.Item>
          <Form.Item label="区域" name="region" rules={[{ required: true, message: '请输入区域' }]}>
            <Input placeholder="如: us-east-1" />
          </Form.Item>
          <Form.Item label="端点" name="endpoint">
            <Input placeholder="https://k8s-api.example.com" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Submit Job Modal */}
      <Modal
        title="提交跨集群作业"
        open={createJobModal}
        onCancel={() => setCreateJobModal(false)}
        onOk={() => jobForm.submit()}
        width={600}
      >
        <Form form={jobForm} layout="vertical" onFinish={handleSubmitJob}>
          <Form.Item label="作业名称" name="name" rules={[{ required: true, message: '请输入作业名称' }]}>
            <Input placeholder="作业名称" />
          </Form.Item>
          <Form.Item label="目标集群" name="targetClusters" rules={[{ required: true, message: '请选择目标集群' }]}>
            <Select
              mode="multiple"
              options={clusters.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Pool Modal */}
      <Modal
        title="创建资源池"
        open={createPoolModal}
        onCancel={() => setCreatePoolModal(false)}
        onOk={() => poolForm.submit()}
        width={600}
      >
        <Form form={poolForm} layout="vertical" onFinish={handleCreatePool}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="资源池名称" />
          </Form.Item>
          <Form.Item label="目标集群" name="clusterId" rules={[{ required: true, message: '请选择集群' }]}>
            <Select options={clusters.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="CPU 核心数" name="cpuCores" rules={[{ required: true, message: '请输入 CPU 核心数' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="如: 16" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="内存 (MB)" name="memoryMb" rules={[{ required: true, message: '请输入内存' }]}>
                <InputNumber min={1024} step={1024} style={{ width: '100%' }} placeholder="如: 32768" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default FederationPage;
