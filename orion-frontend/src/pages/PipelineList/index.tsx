/**
 * Pipeline List Page (TASK-905) - FIXED P0-1
 * Pipeline listing with filters/status, table view with pagination.
 *
 * Features:
 * - Table with pipeline data (name, version, status, stage count, created/updated)
 * - SearchFilterBar for filtering by status
 * - StatusBadge for pipeline states
 * - Pagination support
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, message } from 'antd';
import { colors, spacing } from '@/tokens';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getPipelines, type Pipeline } from '@/api/pipelines';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const PipelineList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  // Load pipelines from API
  const loadPipelines = async () => {
    setLoading(true);
    try {
      const response = await getPipelines();
      const apiData = response.data.data;
      setPipelines(Array.isArray(apiData) ? apiData : (apiData as any).items || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载 Pipeline 列表失败：${error.message}`);
      } else {
        message.error('加载 Pipeline 列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipelines();
  }, []);

  // Filter pipelines based on search and filters
  const filteredPipelines = useMemo(() => {
    return pipelines.filter((pipeline) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [pipeline.name, pipeline.version, pipeline.description || '']
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Status filter
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && pipeline.status !== statusFilter) {
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
        { label: '启用', value: 'active' },
        { label: '停用', value: 'inactive' },
        { label: '已删除', value: 'deleted' },
      ],
    },
  ];

  // Table column definitions
  const columns: TableColumn<Pipeline>[] = [
    {
      key: 'name',
      title: 'Pipeline',
      dataIndex: 'name',
      width: 250,
      sortable: true,
      filterable: true,
      render: (_value: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => navigate(`/pipelines/${record.id}`)}
          >
            {record.name}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            v{record.version}
            {record.description ? ` · ${record.description}` : ''}
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
      key: 'stages',
      title: 'Stage 数量',
      dataIndex: 'spec',
      width: 120,
      render: (spec: any) => {
        const count = spec?.stages?.length || 0;
        return <Tag color="blue">{count} 个 Stage</Tag>;
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_: unknown, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/pipelines/${record.id}`)}>
            查看
          </Button>
          <Button type="link" size="small" onClick={() => navigate(`/pipelines/${record.id}/edit`)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={() => navigate(`/pipelines/${record.id}/runs`)}
          >
            运行
          </Button>
        </Space>
      ),
    },
  ];

  const handleRefresh = () => {
    loadPipelines();
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
          <Text type="secondary">共 {filteredPipelines.length} 个 Pipeline</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/pipelines/new')}>
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
          searchPlaceholder="搜索 Pipeline 名称、版本、描述..."
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
