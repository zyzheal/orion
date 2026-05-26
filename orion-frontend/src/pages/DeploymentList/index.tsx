/**
 * Deployment List Page (TASK-905)
 * Deployment history with status filtering and detail links.
 *
 * Features:
 * - Table with deployment data (app, version, strategy, status, duration)
 * - Status filtering
 * - Detail link
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, message } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, RocketOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getDeployments } from '@/api/deployments';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

interface DeploymentRecord {
  id: string;
  appName: string;
  version: string;
  environment: string;
  strategy: string;
  status: string;
  triggeredBy: string;
  duration?: number;
  startTime: string;
  commit?: string;
}

const DeploymentList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);

  // Load deployments from API
  const loadDeployments = async () => {
    setLoading(true);
    try {
      const response = await getDeployments();
      const apiData = response.data.data;
      setDeployments(Array.isArray(apiData) ? apiData : (apiData as { items?: DeploymentRecord[] })?.items || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载部署列表失败：${error.message}`);
      } else {
        message.error('加载部署列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();
  }, []);

  // Filter deployments based on search and filters
  const filteredDeployments = useMemo(() => {
    return deployments.filter((deployment) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          deployment.appName,
          deployment.version,
          deployment.triggeredBy,
          deployment.commit || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Status filter
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && deployment.status !== statusFilter) {
        return false;
      }

      // Environment filter
      const envFilter = filters.environment;
      if (envFilter && deployment.environment !== envFilter) {
        return false;
      }

      return true;
    });
  }, [searchQuery, filters]);

  // Filter definitions for SearchFilterBar
  const filterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '成功', value: 'success' },
        { label: '运行中', value: 'running' },
        { label: '失败', value: 'failed' },
        { label: '警告', value: 'warning' },
      ],
    },
    {
      key: 'environment',
      label: '环境',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Production', value: 'production' },
        { label: 'Staging', value: 'staging' },
        { label: 'Development', value: 'development' },
        { label: 'Test', value: 'test' },
      ],
    },
  ];

  // Environment tag colors
  const envColors: Record<string, string> = {
    production: 'red',
    staging: 'orange',
    development: 'blue',
    test: 'default',
  };

  // Strategy display labels
  const strategyLabels: Record<string, string> = {
    rolling: '滚动更新',
    'blue-green': '蓝绿部署',
    canary: '金丝雀',
    recreate: '重建部署',
  };

  // Table column definitions
  const columns: TableColumn<DeploymentRecord>[] = [
    {
      key: 'appName',
      title: '应用',
      dataIndex: 'appName',
      width: 180,
      sortable: true,
      filterable: true,
      render: (_value: unknown, record: any) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => navigate(`/deployments/${record.id}`)}
          >
            {record.appName}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {record.version}
          </Text>
        </Space>
      ),
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 140,
      render: (value: unknown) => <Tag color="purple">{String(value)}</Tag>,
    },
    {
      key: 'environment',
      title: '环境',
      dataIndex: 'environment',
      width: 120,
      render: (value: unknown) => (
        <Tag color={envColors[String(value)] || 'default'}>
          {String(value).charAt(0).toUpperCase() + String(value).slice(1)}
        </Tag>
      ),
    },
    {
      key: 'strategy',
      title: '策略',
      dataIndex: 'strategy',
      width: 120,
      render: (value: unknown) => (
        <Text style={{ fontSize: spacing[3] }}>
          {strategyLabels[String(value)] || String(value)}
        </Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: unknown) => <StatusBadge status={value} size="small" />,
    },
    {
      key: 'triggeredBy',
      title: '触发人',
      dataIndex: 'triggeredBy',
      width: 100,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'duration',
      title: '耗时',
      dataIndex: 'duration',
      width: 100,
      sortable: true,
      render: (value: unknown) => {
        if (!value) return <Text type="secondary">-</Text>;
        const seconds = Number(value);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return <Text>{minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`}</Text>;
      },
    },
    {
      key: 'startTime',
      title: '部署时间',
      dataIndex: 'startTime',
      width: 160,
      sortable: true,
      render: (value: unknown) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: spacing[3] }}>{dayjs(String(value)).format('MM-DD HH:mm')}</Text>
          <Text type="secondary" style={{ fontSize: spacing[2] }}>
            {dayjs(String(value)).fromNow()}
          </Text>
        </Space>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/deployments/${record.id}`)}>
            详情
          </Button>
          {record.status === 'success' && (
            <Button type="link" size="small" danger>
              回滚
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const handleRefresh = () => {
    loadDeployments();
  };

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <RocketOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            部署管理
          </Title>
          <Text type="secondary">共 {filteredDeployments.length} 条部署记录</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Search and filter bar */}
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索应用名称、版本、提交..."
        />
      </div>

      {/* Deployment table */}
      <Table
        columns={columns}
        dataSource={filteredDeployments}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />
    </div>
  );
};

export default DeploymentList;
