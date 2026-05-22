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
import { Typography, Button, Space, Tag, DatePicker, message, Dropdown, Modal } from 'antd';
import { colors, spacing, componentRadius } from '@/tokens';
import {
  ReloadOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  StopOutlined,
  DownOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getAllPipelineRuns,
  retryPipelineRun,
  cancelPipelineRun,
  type PipelineRunSummary,
} from '@/api/pipelineRuns';
import StageSelectorModal from './StageSelectorModal';
import { useNavigate } from 'react-router-dom';
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
function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '-';
  const dur = dayjs.duration(ms, 'milliseconds');
  const minutes = Math.floor(dur.asMinutes());
  const secs = dur.seconds();
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

const PipelineRunList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [stageRetryModal, setStageRetryModal] = useState<{
    visible: boolean;
    runId: string | null;
  }>({
    visible: false,
    runId: null,
  });
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load pipeline runs from API
  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAllPipelineRuns({
        limit: 200, // Fetch enough for client-side filtering and pagination
      });
      const apiData = response.data;
      const items = Array.isArray(apiData.data) ? apiData.data : [];
      setRuns(items as PipelineRunSummary[]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载 Pipeline 运行列表失败：${error.message}`);
      } else {
        message.error('加载 Pipeline 运行列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
        const searchable = [run.pipelineId, (run as any).pipelineName || '', run.triggerBy || '']
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
            onClick={() => navigate(`/pipelines/${record.id}`)}
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
      width: 220,
      render: (_: unknown, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/pipelines/${record.id}`)}>
            查看
          </Button>
          {/* Cancel button for running status */}
          {record.status === 'running' && (
            <Button
              type="link"
              size="small"
              icon={<StopOutlined />}
              danger
              loading={cancellingIds.has(record.id)}
              disabled={cancellingIds.has(record.id)}
              onClick={(e) => {
                e.stopPropagation();
                handleCancelConfirm(record.id);
              }}
            >
              取消
            </Button>
          )}
          {/* Dropdown menu for failed/cancelled status */}
          {(record.status === 'failed' || record.status === 'cancelled') && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'retryAll',
                    label: '完整重试',
                    icon: <PlayCircleOutlined />,
                    onClick: () => handleRetryConfirm(record.id),
                  },
                  {
                    key: 'retryFailedOnly',
                    label: '仅失败阶段',
                    icon: <ReloadOutlined />,
                    onClick: () => handleRetry(record.id, { onlyFailed: true }),
                  },
                  {
                    key: 'retryFromStage',
                    label: '从阶段重试',
                    icon: <RocketOutlined />,
                    onClick: () => {
                      setStageRetryModal({ visible: true, runId: record.id });
                    },
                  },
                ],
              }}
              trigger={['click']}
            >
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                danger
                onClick={(e) => e.stopPropagation()}
              >
                重跑 <DownOutlined />
              </Button>
            </Dropdown>
          )}
        </Space>
      ),
    },
  ];

  // Handle re-run for a failed/cancelled run
  const handleRetry = async (
    runId: string,
    options?: { fromStage?: string; onlyFailed?: boolean }
  ) => {
    try {
      const response = await retryPipelineRun(runId, options);
      message.success('Pipeline 重新运行已触发');
      // Refresh list after retry
      await loadRuns();
      // If API returns a new run ID, navigate to the new run's detail page
      const newRunId = (response as any)?.data?.id || (response as any)?.data?.newRunId;
      if (newRunId) {
        navigate(`/pipelines/${newRunId}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        const errMsg = error.message;
        // Handle edge case: run no longer exists
        if (
          errMsg.includes('not found') ||
          errMsg.includes('不存在') ||
          errMsg.includes('已删除')
        ) {
          message.error('该 Pipeline 运行已不存在，可能已被删除');
        } else {
          message.error(`重新运行失败：${errMsg}`);
        }
      } else {
        message.error('重新运行失败，请稍后重试');
      }
    }
  };

  // Handle cancel confirmation dialog
  const handleCancelConfirm = (runId: string) => {
    Modal.confirm({
      title: '确认取消此 Pipeline 运行？',
      content: '取消后，正在运行的阶段将被停止，此操作不可恢复。',
      okText: '确认取消',
      cancelText: '取消',
      okButtonProps: { danger: true },
      style: { borderRadius: componentRadius.modal },
      onOk: () => handleCancel(runId),
    });
  };

  // Handle cancel for a running run
  const handleCancel = async (runId: string) => {
    setCancellingIds((prev) => new Set(prev).add(runId));
    try {
      await cancelPipelineRun(runId);
      message.success('Pipeline 已取消');
      // Refresh list after cancel
      await loadRuns();
    } catch (error: unknown) {
      if (error instanceof Error) {
        const errMsg = error.message;
        // Handle edge case: run no longer running
        if (
          errMsg.includes('not running') ||
          errMsg.includes('已结束') ||
          errMsg.includes('已取消')
        ) {
          message.warning('该 Pipeline 运行已结束，无需取消');
        } else {
          message.error(`取消失败：${errMsg}`);
        }
      } else {
        message.error('取消失败，请稍后重试');
      }
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
    }
  };

  // Handle retry confirmation dialog for "完整重试"
  const handleRetryConfirm = (runId: string) => {
    Modal.confirm({
      title: '确认重新运行此 Pipeline？',
      content: '将从头开始重新运行整个 Pipeline，所有阶段都将被重新执行。',
      okText: '确认重跑',
      cancelText: '取消',
      style: { borderRadius: componentRadius.modal },
      onOk: () => handleRetry(runId),
    });
  };

  // Handle retry from stage
  const handleRetryFromStage = async (runId: string, stageId?: string, onlyFailed?: boolean) => {
    try {
      const response = await retryPipelineRun(runId, { fromStage: stageId, onlyFailed });
      message.success('Pipeline 重新运行已触发');
      await loadRuns();
      // If API returns a new run ID, navigate to the new run's detail page
      const newRunId = (response as any)?.data?.id || (response as any)?.data?.newRunId;
      if (newRunId) {
        navigate(`/pipelines/${newRunId}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        const errMsg = error.message;
        if (
          errMsg.includes('not found') ||
          errMsg.includes('不存在') ||
          errMsg.includes('已删除')
        ) {
          message.error('该 Pipeline 运行已不存在，可能已被删除');
        } else {
          message.error(`重新运行失败：${errMsg}`);
        }
      } else {
        message.error('重新运行失败，请稍后重试');
      }
    } finally {
      setStageRetryModal({ visible: false, runId: null });
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
            <RocketOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            Pipeline 运行历史
          </Title>
          <Text type="secondary">共 {sortedRuns.length} 条运行记录</Text>
        </div>
        <Space>
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
              onChange={(dates) =>
                setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)
              }
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

      {/* Stage selector modal for retry from specific stage */}
      <StageSelectorModal
        visible={stageRetryModal.visible}
        runId={stageRetryModal.runId}
        onClose={() => setStageRetryModal({ visible: false, runId: null })}
        onRetry={handleRetryFromStage}
      />
    </div>
  );
};

export default PipelineRunList;
