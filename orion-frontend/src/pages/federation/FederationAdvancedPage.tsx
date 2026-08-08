/**
 * Federation Advanced Page
 * Phase 4 - Cross-cluster scheduling, scheduling strategies, resource pool management
 */

import React, { useState, useEffect } from 'react';
import { federationApi, FederationCluster, CrossClusterJob } from '@/api/federation';
import {
  Card, Table, Button, Modal, Form, Select, Input, Tag,
  message, Space, Statistic, Row, Col, Progress, Tabs,
  Badge as AntBadge, Descriptions
} from 'antd';
import { spacing } from '@/tokens';
import {
  ClusterOutlined, CloudServerOutlined, SwapOutlined,
  PlusOutlined, ReloadOutlined, SettingOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';

const FederationAdvancedPage: React.FC = () => {
  const [clusters, setClusters] = useState<FederationCluster[]>([]);
  const [jobs, setJobs] = useState<CrossClusterJob[]>([]);
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [clusterModal, setClusterModal] = useState(false);
  const [jobModal, setJobModal] = useState(false);
  const [poolModal, setPoolModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clusterRes, jobRes, poolRes] = await Promise.all([
        federationApi.listClusters(),
        federationApi.listJobs(),
        federationApi.listResourcePools(),
      ]);
      setClusters(clusterRes || []);
      setJobs(jobRes || []);
      setPools(poolRes || []);
    } catch {
      message.error('Failed to load data');
    }
    setLoading(false);
  };

  const handleRegisterCluster = async (values: any) => {
    try {
      await federationApi.registerCluster(values);
      message.success('Cluster registered');
      setClusterModal(false);
      loadData();
    } catch {
      message.error('Failed to register cluster');
    }
  };

  const handleSubmitJob = async (values: any) => {
    try {
      await federationApi.submitJob(values);
      message.success('Job submitted');
      setJobModal(false);
      loadData();
    } catch {
      message.error('Failed to submit job');
    }
  };

  const handleCreatePool = async (values: any) => {
    try {
      await federationApi.createResourcePool(values);
      message.success('Resource pool created');
      setPoolModal(false);
      loadData();
    } catch {
      message.error('Failed to create resource pool');
    }
  };

  const clusterColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Provider', dataIndex: 'provider', key: 'provider', render: (p: string) => <Tag>{p}</Tag> },
    { title: 'Region', dataIndex: 'region', key: 'region' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <AntBadge
          status={status === 'active' ? 'success' : status === 'degraded' ? 'warning' : 'error'}
          text={status}
        />
      ),
    },
    { title: 'Nodes', dataIndex: 'nodeCount', key: 'nodeCount', width: 80 },
    { title: 'Registered', dataIndex: 'registeredAt', key: 'registeredAt', render: (d: string) => new Date(d).toLocaleString() },
  ];

  const jobColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    { title: 'Source', dataIndex: 'source_cluster', key: 'source_cluster', width: 120 },
    {
      title: 'Targets',
      dataIndex: 'target_clusters',
      key: 'target_clusters',
      render: (targets: string[]) => targets.map((t: string) => <Tag key={t}>{t}</Tag>),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <AntBadge
          status={status === 'completed' ? 'success' : status === 'running' ? 'processing' : status === 'failed' ? 'error' : 'default'}
          text={status}
        />
      ),
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => <Progress percent={progress || 0} size="small" />,
    },
    { title: 'Submitted', dataIndex: 'submittedAt', key: 'submittedAt', render: (d: string) => new Date(d).toLocaleString() },
  ];

  const poolColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Clusters',
      dataIndex: 'clusters',
      key: 'clusters',
      render: (c: string[]) => c && c.length > 0 ? c.map((id: string) => <Tag key={id}>{id}</Tag>) : '-',
    },
    {
      title: 'Allocation Policy',
      dataIndex: 'allocation_policy',
      key: 'allocation_policy',
      render: (policy: string) => <Tag>{policy}</Tag>,
    },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (d: string) => new Date(d).toLocaleString() },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total Clusters" value={clusters.length} prefix={<CloudServerOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Active Clusters" value={clusters.filter(c => c.status === 'active').length} prefix={<ClusterOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Running Jobs" value={jobs.filter(j => j.status === 'running').length} prefix={<SwapOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Resource Pools" value={pools.length} prefix={<SettingOutlined />} />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'clusters',
            label: <><CloudServerOutlined /> Cluster Management</>,
            children: (
              <Card
                title="Federated Clusters"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setClusterModal(true)}>
                      Register Cluster
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table
                  columns={clusterColumns}
                  dataSource={clusters}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'jobs',
            label: <><SwapOutlined /> Cross-Cluster Jobs</>,
            children: (
              <Card
                title="Cross-Cluster Jobs"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setJobModal(true)}>
                      Submit Job
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table
                  columns={jobColumns}
                  dataSource={jobs}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'pools',
            label: <><SettingOutlined /> Resource Pools</>,
            children: (
              <Card
                title="Resource Pool Management"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setPoolModal(true)}>
                      Create Pool
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table
                  columns={poolColumns}
                  dataSource={pools}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'strategies',
            label: <><ThunderboltOutlined /> Scheduling Strategies</>,
            children: (
              <Card title="Scheduling Strategy Configuration">
                <Descriptions bordered column={1} size="middle">
                  <Descriptions.Item label="Default Strategy">
                    <Tag color="blue">Spread</Tag> - Distribute workloads evenly across clusters
                  </Descriptions.Item>
                  <Descriptions.Item label="Available Strategies">
                    <Space wrap>
                      <Tag>Spread</Tag>
                      <Tag>Binpack</Tag>
                      <Tag>Locality</Tag>
                      <Tag>Cost-Optimized</Tag>
                      <Tag>Latency-Optimized</Tag>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Failover">
                    Enabled - Automatic failover to healthy clusters
                  </Descriptions.Item>
                  <Descriptions.Item label="Load Balancing">
                    Weighted round-robin based on cluster capacity
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
        ]}
      />

      {/* Register Cluster Modal */}
      <Modal
        title="Register Cluster"
        open={clusterModal}
        onCancel={() => setClusterModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleRegisterCluster}>
          <Form.Item label="Cluster Name" name="name" required>
            <Input placeholder="us-east-1-cluster" />
          </Form.Item>
          <Form.Item label="Provider" name="provider" required>
            <Select options={[
              { value: 'aws', label: 'AWS EKS' },
              { value: 'gcp', label: 'GCP GKE' },
              { value: 'azure', label: 'Azure AKS' },
              { value: 'aliyun', label: 'Aliyun ACK' },
              { value: 'on-premise', label: 'On-Premise' },
            ]} />
          </Form.Item>
          <Form.Item label="Region" name="region" required>
            <Input placeholder="us-east-1" />
          </Form.Item>
          <Form.Item label="Endpoint" name="endpoint" required>
            <Input placeholder="https://cluster-api.example.com" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Submit Job Modal */}
      <Modal
        title="Submit Cross-Cluster Job"
        open={jobModal}
        onCancel={() => setJobModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitJob}>
          <Form.Item label="Job Name" name="name" required>
            <Input placeholder="deploy-service-v2" />
          </Form.Item>
          <Form.Item label="Type" name="type" required>
            <Select options={[
              { value: 'deployment', label: 'Deployment' },
              { value: 'migration', label: 'Migration' },
              { value: 'sync', label: 'Sync' },
              { value: 'backup', label: 'Backup' },
            ]} />
          </Form.Item>
          <Form.Item label="Source Cluster" name="source_cluster" required>
            <Select options={clusters.map(c => ({
              value: c.id,
              label: c.name,
            }))} />
          </Form.Item>
          <Form.Item label="Target Clusters" name="target_clusters">
            <Select mode="multiple" options={clusters.map(c => ({
              value: c.id,
              label: c.name,
            }))} />
          </Form.Item>
          <Form.Item label="Strategy" name="strategy">
            <Select options={[
              { value: 'rollout', label: 'Rolling Update' },
              { value: 'blue-green', label: 'Blue-Green' },
              { value: 'canary', label: 'Canary' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Resource Pool Modal */}
      <Modal
        title="Create Resource Pool"
        open={poolModal}
        onCancel={() => setPoolModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreatePool}>
          <Form.Item label="Pool Name" name="name" required>
            <Input placeholder="production-pool" />
          </Form.Item>
          <Form.Item label="Clusters" name="clusters">
            <Select mode="multiple" options={clusters.map(c => ({
              value: c.id,
              label: c.name,
            }))} />
          </Form.Item>
          <Form.Item label="Allocation Policy" name="allocation_policy" required>
            <Select options={[
              { value: 'fair-share', label: 'Fair Share' },
              { value: 'priority', label: 'Priority' },
              { value: 'reservation', label: 'Reservation' },
            ]} />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FederationAdvancedPage;
