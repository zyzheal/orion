/**
 * columns.tsx - 联邦调度表格列定义
 * 抽取自 FederationPage.tsx (P2-9 Phase 89)
 */
import { Button, Space, Tag, Progress } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { FederationCluster, ClusterHealth, CrossClusterJob, ResourcePool } from '@/api/federation';
import { statusColorMap, statusLabelMap, jobColorMap, jobLabelMap } from './constants';

export const makeClusterColumns = (
  clusterHealth: Record<string, ClusterHealth>,
  clusterForm: { setFieldsValue: (v: any) => void },
  openClusterModal: () => void,
  handleDeregisterCluster: (cluster: FederationCluster) => void
) => [
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
      return (
        <Progress
          percent={Math.round(usage * 100)}
          size="small"
          status={usage > 0.8 ? 'exception' : undefined}
        />
      );
    },
  },
  {
    title: '内存使用率',
    key: 'memoryUsage',
    width: 140,
    render: (_: unknown, record: FederationCluster) => {
      const health = clusterHealth[record.id];
      const usage = health?.memoryUsage ?? 0;
      return (
        <Progress
          percent={Math.round(usage * 100)}
          size="small"
          status={usage > 0.8 ? 'exception' : undefined}
        />
      );
    },
  },
  {
    title: '注册时间',
    dataIndex: 'registeredAt',
    key: 'registeredAt',
    width: 160,
    render: (v: string) => new Date(v).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render: (_: unknown, record: FederationCluster) => (
      <Space>
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            clusterForm.setFieldsValue(record);
            openClusterModal();
          }}
        >
          编辑
        </Button>
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeregisterCluster(record)}
        >
          注销
        </Button>
      </Space>
    ),
  },
];

export const makeJobColumns = (handleDeleteJob: (job: CrossClusterJob) => void) => [
  { title: '作业名称', dataIndex: 'name', key: 'name', width: 160 },
  {
    title: '目标集群',
    dataIndex: 'targetClusters',
    key: 'targetClusters',
    width: 200,
    render: (v: string[]) =>
      (v || []).slice(0, 3).map((id: string) => <Tag key={id}>{id.slice(0, 8)}</Tag>),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (v: string) => <Tag color={jobColorMap[v]}>{jobLabelMap[v]}</Tag>,
  },
  {
    title: '提交时间',
    dataIndex: 'submittedAt',
    key: 'submittedAt',
    width: 160,
    render: (v: string) => new Date(v).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (_: unknown, record: CrossClusterJob) => (
      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteJob(record)}>
        删除
      </Button>
    ),
  },
];

export const makePoolColumns = (handleDeletePool: (pool: ResourcePool) => void) => [
  { title: '名称', dataIndex: 'name', key: 'name', width: 140 },
  {
    title: '集群',
    dataIndex: 'clusterId',
    key: 'clusterId',
    width: 140,
    render: (v: string) => v.slice(0, 12),
  },
  { title: 'CPU 核心', dataIndex: 'cpuCores', key: 'cpuCores', width: 100 },
  { title: '内存 (MB)', dataIndex: 'memoryMb', key: 'memoryMb', width: 100 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    render: (v: string) => <Tag color={statusColorMap[v]}>{statusLabelMap[v]}</Tag>,
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (_: unknown, record: ResourcePool) => (
      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeletePool(record)}>
        删除
      </Button>
    ),
  },
];
