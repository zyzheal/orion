/**
 * PipelineRunList table columns
 * 抽取自 index.tsx (P2-9 Phase 140)
 */

import { Space, Tag, Dropdown, Button, Typography } from 'antd';
import {
  ReloadOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  StopOutlined,
  DownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import { colors, spacing } from '@/tokens';
import { TRIGGER_LABEL, TRIGGER_TAG_COLORS } from './constants';
import { formatDuration } from './helpers';
import type { PipelineRunSummary } from '@/api/pipelineRuns';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface BuildColumnsDeps {
  navigate: (path: string) => void;
  cancellingIds: Set<string>;
  handleCancelConfirm: (runId: string) => void;
  handleRetryConfirm: (runId: string) => void;
  handleRetry: (runId: string, options?: { fromStage?: string; onlyFailed?: boolean }) => void;
  openStageRetry: (runId: string) => void;
}

export const buildRunColumns = (deps: BuildColumnsDeps): TableColumn<PipelineRunSummary>[] => [
  {
    key: 'runId',
    title: 'Run ID',
    dataIndex: 'id',
    width: 120,
    render: (_value: unknown, record) => (
      <Text code style={{ fontSize: spacing[3] }}>
        #{record?.id.slice(0, 8)}
      </Text>
    ),
  },
  {
    key: 'pipelineName',
    title: 'Pipeline',
    width: 220,
    render: (_value: unknown, record) =>
      record ? (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => deps.navigate(`/pipelines/${record.id}`)}
          >
            {(record as { pipelineName?: string }).pipelineName || record.pipelineId}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            <Tag color={TRIGGER_TAG_COLORS[record.triggerType] || 'default'}>
              {TRIGGER_LABEL[record.triggerType] || record.triggerType}
            </Tag>
          </Text>
        </Space>
      ) : null,
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
        {record ? ((record as { environment?: string }).environment || '-') : '-'}
      </Text>
    ),
  },
  {
    key: 'startedAt',
    title: '开始时间',
    width: 180,
    sortable: true,
    render: (_value: unknown, record) => {
      if (!record) return null;
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
        {record ? formatDuration(Number(record.durationMs) || undefined) : '-'}
      </Text>
    ),
  },
  {
    key: 'triggeredBy',
    title: '触发人',
    width: 120,
    render: (_value: unknown, record) => (
      <Text code style={{ fontSize: spacing[3] }}>
        {record ? record.triggerBy || '-' : '-'}
      </Text>
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 220,
    render: (_: unknown, record) => {
      if (!record) return null;
      const isRunning = record.status === 'running';
      const isRetryable = record.status === 'failed' || record.status === 'cancelled';
      return (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              deps.navigate(`/pipelines/${record.id}`);
            }}
          >
            查看
          </Button>
          {isRunning && (
            <Button
              type="link"
              size="small"
              icon={<StopOutlined />}
              danger
              loading={deps.cancellingIds.has(record.id)}
              disabled={deps.cancellingIds.has(record.id)}
              onClick={(e) => {
                e.stopPropagation();
                deps.handleCancelConfirm(record.id);
              }}
            >
              取消
            </Button>
          )}
          {isRetryable && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'retryAll',
                    label: '完整重试',
                    icon: <PlayCircleOutlined />,
                    onClick: () => deps.handleRetryConfirm(record.id),
                  },
                  {
                    key: 'retryFailedOnly',
                    label: '仅失败阶段',
                    icon: <ReloadOutlined />,
                    onClick: () => deps.handleRetry(record.id, { onlyFailed: true }),
                  },
                  {
                    key: 'retryFromStage',
                    label: '从阶段重试',
                    icon: <RocketOutlined />,
                    onClick: () => deps.openStageRetry(record.id),
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
      );
    },
  },
];
