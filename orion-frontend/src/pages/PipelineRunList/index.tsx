/**
 * Pipeline Run List Page
 * Shows execution history (runs) for all pipelines, with filtering by status,
 * date range, and environment. Supports real-time status refresh via polling.
 *
 * Features:
 * - Table with columns: Run ID, Pipeline Name, Status, Environment, Started At, Duration, Triggered By
 * - Filter bar: Status filter, Date range picker, Environment selector
 * - Click row to navigate to PipelineDetail page
 * - Pagination support
 * - "Re-run" button for failed runs
 * - Real-time status refresh (polling every 5s for running runs)
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Typography, Button, Space, Tag, DatePicker, message } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, PlayCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getAllPipelineRuns,
  retryPipelineRun,
  type PipelineRunSummary,
} from '@/api/pipelineRuns';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';

dayjs.extend(relativeTime);
dayjs.extend(duration);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/** Trigger type display labels */
const triggerLabel: Record<string, string> = {
  manual: '手动触发',
  push: 'Push 触发',
  schedule: '定时触发',
  api: 'API 触发',
};

/** Status color map for trigger tags */
const triggerTagColors: Record<string, string> = {
  manual: 'blue',
  push: 'green',
  schedule: 'orange',
  api: 'purple',
};

/** Format duration in ms to human-readable string */
function formatDuration(ms?: number | string): string {
  const numMs = typeof ms === 'string' ? parseInt(ms, 10) : ms;
  if (!numMs || numMs <= 0) return '-';
  const dur = dayjs.duration(numMs, 'milliseconds');
  const minutes = Math.floor(dur.asMinutes());
  const secs = dur.seconds();
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

const PipelineRunList: React.FC = () => {
  const navigate = useNavigate();
  const { id: pipelineId } = useParams<{ id: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [pipelineName, setPipelineName] = useState<string | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load pipeline runs from API
  const loadRuns = useCallback(async () => {
    console.log('[PipelineRunList] loadRuns called, pipelineId:', pipelineId);
    setLoading(true);
    try {
      const response = await getAllPipelineRuns({
        limit: 200,
        ...(pipelineId ? { pipelineId } : {}),  // 如果有 pipelineId，传给后端过滤
      });

      console.log('[PipelineRunList] Response object:', response);
      console.log('[PipelineRunList] response.data:', response.data);
      console.log('[PipelineRunList] response.data type:', typeof response.data);
      console.log('[PipelineRunList] response.data.data:', response.data?.data);

      // 后端返回格式：{ data: [...], total }
      // Axios 响应拦截器保持原样，不解包
      // 所以 response.data 就是 { data: [...], total }
      const raw = response.data;
      let items: PipelineRunSummary[] = [];

      if (raw && typeof raw === 'object') {
        // 情况1：{ data: [...], total } - 标准格式
        if (Array.isArray(raw.data)) {
          console.log('[PipelineRunList] Found data array with', raw.data.length, 'items');
          items = raw.data;
        }
        // 情况2：直接被当作数组（不应该发生，但作为后备）
        else if (Array.isArray(raw)) {
          console.log('[PipelineRunList] Raw is array with', raw.length, 'items');
          items = raw;
        } else {
          console.log('[PipelineRunList] raw.data is not array, raw keys:', Object.keys(raw));
        }
      } else {
        console.log('[PipelineRunList] raw is not object:', typeof raw);
      }

      console.log('[PipelineRunList] Final items count:', items.length);
      if (items.length > 0) {
        console.log('[PipelineRunList] First item:', items[0]);
      }

      // 注意：不再在前端过滤，因为已经通过 API 参数传给后端过滤了
      // 获取 Pipeline 名称
      if (pipelineId && items.length > 0) {
        const firstRun = items[0];
        if (firstRun && (firstRun as any).pipelineName) {
          setPipelineName((firstRun as any).pipelineName);
        }
      }

      console.log('[PipelineRunList] About to setRuns with', items.length, 'items');
      setRuns(items);
    } catch (error: unknown) {
      console.error('[PipelineRunList] Error:', error);
      if (error instanceof Error) {
        message.error(`加载 Pipeline 运行列表失败：${error.message}`);
      } else {
        message.error('加载 Pipeline 运行列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  // Initial load
  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Polling for running executions: refresh every 5 seconds if any runs are in 'running' state
  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === 'running');

    if (hasRunning) {
      pollingTimerRef.current = setTimeout(() => {
        loadRuns();
      }, 5000);
    }

    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [runs, loadRuns]);

  // Filter runs based on search, filters, and date range
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          run.pipelineId,
          (run as any).pipelineName || '',
          run.triggerBy || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Status filter
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all') {
        if (run.status !== statusFilter) return false;
      }

      // Date range filter
      if (dateRange && dateRange[0] && dateRange[1]) {
        const startTime = run.startedAt || run.createdAt;
        if (startTime) {
          const runDate = dayjs(startTime);
          if (runDate.isBefore(dateRange[0]) || runDate.isAfter(dateRange[1].endOf('day'))) {
            return false;
          }
        }
      }

      return true;
    });
  }, [searchQuery, filters, dateRange, runs]);

  // Sort by startedAt descending (most recent first)
  const sortedRuns = useMemo(() => {
    return [...filteredRuns].sort((a, b) => {
      const aTime = dayjs(a.startedAt || a.createdAt).valueOf();
      const bTime = dayjs(b.startedAt || b.createdAt).valueOf();
      return bTime - aTime;
    });
  }, [filteredRuns]);

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
        { label: '已取消', value: 'cancelled' },
        { label: '等待中', value: 'pending' },
      ],
    },
  ];

  // Table column definitions
  const columns: TableColumn<PipelineRunSummary>[] = [
    {
      key: 'runId',
      title: 'Run ID',
      dataIndex: 'id',
      width: 120,
      render: (_value: unknown, record) => (
        <Text code style={{ fontSize: spacing[3] }}>
          #{record.id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: 'pipelineName',
      title: 'Pipeline',
      width: 220,
      render: (_value: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => navigate(`/pipelines/${record.pipelineId}`)}
          >
            {(record as any).pipelineName || record.pipelineId}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            <Tag color={triggerTagColors[record.triggerType] || 'default'}>
              {triggerLabel[record.triggerType] || record.triggerType}
            </Tag>
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
      key: 'environment',
      title: '环境',
      width: 100,
      render: (_value: unknown, record) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {(record as any).environment || '-'}
        </Text>
      ),
    },
    {
      key: 'startedAt',
      title: '开始时间',
      width: 180,
      sortable: true,
      render: (_value: unknown, record) => {
        const startTime = record.startedAt || record.createdAt;
        return (
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {startTime ? dayjs(startTime).fromNow() : '-'}
          </Text>
        );
      },
    },
    {
      key: 'duration',
      title: '耗时',
      width: 100,
      render: (_value: unknown, record) => (
        <Text style={{ fontSize: spacing[3], fontFamily: 'monospace' }}>
          {formatDuration(record.durationMs)}
        </Text>
      ),
    },
    {
      key: 'triggeredBy',
      title: '触发人',
      width: 120,
      render: (_value: unknown, record) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {record.triggerBy || '-'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/pipelines/${record.pipelineId}/runs/${record.id}`)}
          >
            查看
          </Button>
          {record.status === 'failed' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              danger
              onClick={(e) => {
                e.stopPropagation();
                handleRetry(record.id);
              }}
            >
              重跑
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Handle re-run for a failed run
  const handleRetry = async (runId: string) => {
    try {
      await retryPipelineRun(runId);
      message.success('Pipeline 重新运行已触发');
      // Refresh list after retry
      await loadRuns();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`重新运行失败：${error.message}`);
      } else {
        message.error('重新运行失败，请稍后重试');
      }
    }
  };

  const handleRefresh = () => {
    loadRuns();
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
          <Title level={2} style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
            <PlayCircleOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            {pipelineName ? `${pipelineName} - 运行历史` : 'Pipeline 运行历史'}
          </Title>
          <Text type="secondary">
            {pipelineId ? `Pipeline ID: ${pipelineId}` : '全部 Pipeline'}
            {' · '}共 {sortedRuns.length} 条运行记录
          </Text>
        </div>
        <Space>
          {pipelineId && (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/pipelines')}
            >
              返回列表
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Search and filter bar */}
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索 Pipeline ID、触发人..."
          extra={
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
              placeholder={['开始日期', '结束日期']}
              style={{ minWidth: 240 }}
            />
          }
        />
      </div>

      {/* Run history table */}
      <Table
        columns={columns}
        dataSource={sortedRuns}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />
    </div>
  );
};

export default PipelineRunList;
