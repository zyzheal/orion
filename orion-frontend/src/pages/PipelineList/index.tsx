/**
 * Pipeline List Page (TASK-905)
 * Pipeline listing with filters/status, table view with pagination.
 *
 * Features:
 * - Table with pipeline data (name, status, branch, author, duration, triggered)
 * - SearchFilterBar for filtering by status/branch
 * - StatusBadge for pipeline states
 * - Pagination support
 */
import React, { useState, useMemo } from 'react';
import { Typography, Button, Space, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { mockPipelines } from '@/pages/__mocks__/mockData';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(duration);
dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const PipelineList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);

  // Filter pipelines based on search and filters
  const filteredPipelines = useMemo(() => {
    return mockPipelines.filter((pipeline) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          pipeline.name,
          pipeline.branch,
          pipeline.author,
          pipeline.commit || '',
        ].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Status filter
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && pipeline.status !== statusFilter) {
        return false;
      }

      // Branch filter
      const branchFilter = filters.branch;
      if (branchFilter && pipeline.branch !== branchFilter) {
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
        { label: '运行中', value: 'running' },
        { label: '成功', value: 'success' },
        { label: '失败', value: 'failed' },
        { label: '等待中', value: 'pending' },
        { label: '警告', value: 'warning' },
        { label: '已取消', value: 'cancelled' },
      ],
    },
    {
      key: 'branch',
      label: '分支',
      options: [
        { label: '全部', value: 'all' },
        { label: 'main', value: 'main' },
        { label: 'develop', value: 'develop' },
        { label: 'feature/auth', value: 'feature/auth' },
        { label: 'feature/new-ui', value: 'feature/new-ui' },
      ],
    },
  ];

  // Table column definitions
  const columns: TableColumn<any>[] = [
    {
      key: 'name',
      title: 'Pipeline',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      filterable: true,
      render: (_value: unknown, record: any) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => navigate(`/pipelines/${record.id}`)}
          >
            {record.name}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            #{record.runNumber}
            {record.commit ? ` \u00b7 ${record.commit}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: unknown) => <StatusBadge status={value as any} size="small" />,
    },
    {
      key: 'branch',
      title: '分支',
      dataIndex: 'branch',
      width: 160,
      render: (value: unknown) => (
        <Tag color="blue" style={{ margin: 0 }}>
          {String(value)}
        </Tag>
      ),
    },
    {
      key: 'author',
      title: '触发人',
      dataIndex: 'author',
      width: 120,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'trigger',
      title: '触发方式',
      dataIndex: 'trigger',
      width: 100,
      render: (value: unknown) => {
        const triggerMap: Record<string, { label: string; color: string }> = {
          manual: { label: '手动', color: 'purple' },
          push: { label: 'Push', color: 'green' },
          schedule: { label: '定时', color: 'orange' },
          api: { label: 'API', color: 'blue' },
        };
        const config = triggerMap[String(value)] || { label: String(value), color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
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
        const dur = dayjs.duration(seconds, 'seconds');
        const minutes = Math.floor(dur.asMinutes());
        const secs = dur.seconds();
        return <Text>{minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`}</Text>;
      },
    },
    {
      key: 'startTime',
      title: '触发时间',
      dataIndex: 'startTime',
      width: 160,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/pipelines/${record.id}`)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            disabled={record.status === 'running'}
          >
            重试
          </Button>
        </Space>
      ),
    },
  ];

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
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
          <Title level={3} style={{ margin: 0 }}>
            Pipeline 列表
          </Title>
          <Text type="secondary">
            共 {filteredPipelines.length} 个 Pipeline 运行记录
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />}>
            创建 Pipeline
          </Button>
        </Space>
      </div>

      {/* Search and filter bar */}
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索 Pipeline 名称、分支、提交..."
        />
      </div>

      {/* Pipeline table */}
      <Table
        columns={columns}
        dataSource={filteredPipelines}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />
    </div>
  );
};

export default PipelineList;
