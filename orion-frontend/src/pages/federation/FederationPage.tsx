/**
 * Federation Scheduling Page
 * Phase 4 - Cross-cluster scheduling, resource allocation, and cluster management
 *
 * 重构自 P2-9 Phase 89 (647 → ~130 行):
 *  - constants.ts - statusColorMap / statusLabelMap / jobColorMap / jobLabelMap
 *  - columns.tsx - makeClusterColumns / makeJobColumns / makePoolColumns
 *  - useFederationState.ts - 全部状态与 handler
 *  - Modals/CreateClusterModal.tsx / CreateJobModal.tsx / CreatePoolModal.tsx
 */
import React from 'react';
import { Card, Table, Button, Space, Row, Col, Tabs, Typography, Empty, Statistic } from 'antd';
import { ClusterOutlined, PlusOutlined, ReloadOutlined, GlobalOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useFederationState } from './useFederationState';
import { makeClusterColumns, makeJobColumns, makePoolColumns } from './columns';
import { CreateClusterModal } from './Modals/CreateClusterModal';
import { CreateJobModal } from './Modals/CreateJobModal';
import { CreatePoolModal } from './Modals/CreatePoolModal';

const { Title, Text } = Typography;

const FederationPage: React.FC = () => {
  const {
    clusters,
    clusterHealth,
    jobs,
    resourcePools,
    loading,
    createClusterModal,
    setCreateClusterModal,
    createJobModal,
    setCreateJobModal,
    createPoolModal,
    setCreatePoolModal,
    clusterForm,
    jobForm,
    poolForm,
    loadData,
    handleCreateCluster,
    handleSubmitJob,
    handleCreatePool,
    handleDeregisterCluster,
    handleDeleteJob,
    handleDeletePool,
    stats,
  } = useFederationState();

  const clusterColumns = makeClusterColumns(
    clusterHealth,
    clusterForm,
    () => setCreateClusterModal(true),
    handleDeregisterCluster
  );
  const jobColumns = makeJobColumns(handleDeleteJob);
  const poolColumns = makePoolColumns(handleDeletePool);

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
          locale={{ emptyText: <Empty description="暂无集群数据，请注册第一个集群" /> }}
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
          locale={{ emptyText: <Empty description="暂无跨集群作业，请创建第一个作业" /> }}
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
          locale={{ emptyText: <Empty description="暂无资源池，请创建第一个资源池" /> }}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <GlobalOutlined style={{ marginRight: spacing.sm }} />
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

      <Row gutter={24} style={{ marginBottom: spacing.lg }}>
        <Col span={5}>
          <Card>
            <Statistic title="集群总数" value={stats.total} prefix={<ClusterOutlined />} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="活跃集群"
              value={stats.active}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="运行中作业"
              value={stats.runningJobs}
              valueStyle={{ color: colors.primary[500] }}
            />
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

      <Card>
        <Tabs items={tabItems} />
      </Card>

      <CreateClusterModal
        open={createClusterModal}
        form={clusterForm}
        onCancel={() => setCreateClusterModal(false)}
        onFinish={handleCreateCluster}
      />

      <CreateJobModal
        open={createJobModal}
        form={jobForm}
        clusters={clusters}
        onCancel={() => setCreateJobModal(false)}
        onFinish={handleSubmitJob}
      />

      <CreatePoolModal
        open={createPoolModal}
        form={poolForm}
        clusters={clusters}
        onCancel={() => setCreatePoolModal(false)}
        onFinish={handleCreatePool}
      />
    </div>
  );
};

export default FederationPage;
