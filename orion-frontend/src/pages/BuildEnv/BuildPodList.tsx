/**
 * Build Pod List Page
 * Table of build pods with filters, cancel action, and navigation to detail.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Popconfirm, message } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, StopOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getBuildPods,
  cancelBuildPod,
  type BuildPod,
} from '@/api/build-env';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const BuildPodList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [pods, setPods] = useState<any[]>([]);

  const loadPods = async () => {
    setLoading(true);
    try {
      const response = await getBuildPods();
      const apiData = response.data.data;
      setPods(Array.isArray(apiData) ? apiData : (apiData as any).items || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载构建 Pod 失败：${error.message}`);
      } else {
        message.error('加载构建 Pod 失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPods();
  }, []);

  const filteredPods = useMemo(() => {
    return pods.filter((pod) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [pod.name, pod.namespace, pod.runId, pod.stageId].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      const runIdFilter = filters.runId;
      if (runIdFilter && runIdFilter !== 'all' && pod.runId !== runIdFilter) return false;
      const stageIdFilter = filters.stageId;
      if (stageIdFilter && stageIdFilter !== 'all' && pod.stageId !== stageIdFilter) return false;
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && pod.status !== statusFilter) return false;
      return true;
    });
  }, [searchQuery, filters, pods]);

  const handleCancel = async (id: string) => {
    try {
      await cancelBuildPod(id);
      message.success('Build pod cancelled');
      loadPods();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`取消构建 Pod 失败：${error.message}`);
      } else {
        message.error('取消构建 Pod 失败，请稍后重试');
      }
    }
  };

  const filterDefs: FilterDefinition[] = [
    {
      key: 'runId',
      label: 'Run ID',
      options: [
        { label: 'All', value: 'all' },
        ...Array.from(new Set(pods.map((p) => p.runId))).slice(0, 10).map((id) => ({
          label: id,
          value: id,
        })),
      ],
    },
    {
      key: 'stageId',
      label: 'Stage ID',
      options: [
        { label: 'All', value: 'all' },
        ...Array.from(new Set(pods.map((p) => p.stageId))).slice(0, 10).map((id) => ({
          label: id,
          value: id,
        })),
      ],
    },
    {
      key: 'status',
      label: 'Status',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Running', value: 'running' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
  ];

  const columns: TableColumn<BuildPod>[] = [
    {
      key: 'name',
      title: 'Pod Name',
      dataIndex: 'name',
      width: 220,
      sortable: true,
      render: (_value, record) => (
        <Text
          strong
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => navigate(`/console/build-env/pods/${record.id}`)}
        >
          {record.name}
        </Text>
      ),
    },
    {
      key: 'namespace',
      title: 'Namespace',
      dataIndex: 'namespace',
      width: 160,
      render: (value) => <Text code style={{ fontSize: spacing[3] }}>{String(value)}</Text>,
    },
    {
      key: 'runId',
      title: 'Run ID',
      dataIndex: 'runId',
      width: 160,
      render: (value) => <Text type="secondary" style={{ fontSize: spacing[3] }}>{String(value)}</Text>,
    },
    {
      key: 'stageId',
      title: 'Stage ID',
      dataIndex: 'stageId',
      width: 160,
      render: (value) => <Text type="secondary" style={{ fontSize: spacing[3] }}>{String(value)}</Text>,
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (value) => {
        const statusMap: Record<string, any> = {
          running: 'running',
          completed: 'success',
          failed: 'failed',
          cancelled: 'cancelled',
        };
        return <StatusBadge status={statusMap[String(value)] || 'unknown'} size="small" />;
      },
    },
    {
      key: 'createdAt',
      title: 'Created',
      dataIndex: 'createdAt',
      width: 140,
      sortable: true,
      render: (value) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'duration',
      title: 'Duration',
      width: 120,
      render: (_: unknown, record: BuildPod) => {
        if (!record.startedAt) return <Text type="secondary">-</Text>;
        const end = record.completedAt ? dayjs(record.completedAt) : dayjs();
        const diff = end.diff(dayjs(record.startedAt), 'second');
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        return <Text>{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</Text>;
      },
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 140,
      render: (_: unknown, record: BuildPod) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/console/build-env/pods/${record.id}`)}
          >
            View
          </Button>
          {record.status === 'running' && (
            <Popconfirm
              title="Cancel this build pod?"
              onConfirm={() => handleCancel(record.id)}
              okText="Cancel"
              cancelText="No"
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                Cancel
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Build Pods</Title>
          <Text type="secondary">{filteredPods.length} build pods</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadPods} loading={loading}>
          Refresh
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="Search by pod name, namespace, run ID..."
        />
      </div>

      <Table columns={columns} dataSource={filteredPods} loading={loading} rowKey="id" size="middle" striped />
    </div>
  );
};

export default BuildPodList;
