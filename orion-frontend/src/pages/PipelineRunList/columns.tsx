/**
 * PipelineRunList columns
 * 抽取自 index.tsx (P2-9 Phase 180)
 */
import { Button, Space, Tag, Typography } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { PipelineRunSummary } from '@/api/pipelineRuns';
import { TRIGGER_LABEL, TRIGGER_TAG_COLORS, formatDuration } from './constants';

dayjs.extend(relativeTime);

const { Text } = Typography;

export interface RunColumnsDeps {
  handleRetry: (runId: string) => void | Promise<void>;
  onNavigatePipeline: (pipelineId: string) => void;
  onNavigateRun: (pipelineId: string, runId: string) => void;
}

export function buildColumns(deps: RunColumnsDeps): TableColumn<PipelineRunSummary>[] {
  const { handleRetry, onNavigatePipeline, onNavigateRun } = deps;

  return [
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
            onClick={() => onNavigatePipeline(record.pipelineId)}
          >
            {(record as { pipelineName?: string }).pipelineName || record.pipelineId}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            <Tag color={TRIGGER_TAG_COLORS[record.triggerType] || 'default'}>
              {TRIGGER_LABEL[record.triggerType] || record.triggerType}
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
      render: (value: unknown) => (
        <StatusBadge
          status={value as 'success' | 'failed' | 'running' | 'cancelled' | 'pending'}
          size="small"
        />
      ),
    },
    {
      key: 'environment',
      title: '环境',
      width: 100,
      render: (_value: unknown, record) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {(record as { environment?: string }).environment || '-'}
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
            onClick={() => onNavigateRun(record.pipelineId, record.id)}
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
}
