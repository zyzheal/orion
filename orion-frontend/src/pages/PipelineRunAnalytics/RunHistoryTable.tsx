/**
 * RunHistoryTable - 运行历史明细表
 * 抽取自 index.tsx（P2-9 Phase 38）
 */
import React from 'react';
import { Card, Table, Tag, Button, Space, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { cancelPipelineRun, retryPipelineRun } from '@/api/pipelineRuns';
import type { RunRecord, PipelineSummary } from './types';
import { statusConfig, formatDuration, toNumberMs } from './constants';

const { Text } = Typography;

export interface RunHistoryTableProps {
  runs: RunRecord[];
  pipelines: PipelineSummary[];
  loading: boolean;
  loadRuns: () => void;
  openStageDetail: (run: RunRecord) => void;
}

export const RunHistoryTable: React.FC<RunHistoryTableProps> = ({
  runs,
  pipelines,
  loading,
  loadRuns,
  openStageDetail,
}) => {
  const handleCancel = (r: RunRecord) => {
    cancelPipelineRun(r.id)
      .then(() => {
        message.success('流水线已取消');
        loadRuns();
      })
      .catch(() => message.error('取消失败'));
  };

  const handleRetry = (r: RunRecord) => {
    retryPipelineRun(r.id)
      .then(() => {
        message.success('流水线已重新触发');
        loadRuns();
      })
      .catch(() => message.error('重试失败'));
  };

  const columns: ColumnsType<RunRecord> = [
    {
      title: 'Run ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (v: string) => <Text code>{v.slice(0, 12)}…</Text>,
    },
    {
      title: 'Pipeline',
      key: 'pipeline',
      width: 140,
      render: (_: unknown, r: RunRecord) => {
        const p = pipelines.find((pl) => pl.id === r.pipelineId);
        return <Tag>{p?.name || r.pipelineId}</Tag>;
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: unknown, r: RunRecord) => {
        const cfg = statusConfig[r.status] || statusConfig.pending;
        return (
          <Tag color={cfg.color}>
            {cfg.icon} {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: 'Trigger',
      dataIndex: 'triggerType',
      key: 'triggerType',
      width: 80,
      render: (v: string) => <Tag color="default">{v}</Tag>,
    },
    {
      title: '耗时',
      key: 'duration',
      width: 90,
      render: (_: unknown, r: RunRecord) => <Text code>{formatDuration(toNumberMs(r.durationMs))}</Text>,
    },
    {
      title: '开始时间',
      key: 'startedAt',
      width: 150,
      render: (_: unknown, r: RunRecord) => (
        <Text>{r.startedAt ? dayjs(r.startedAt).format('YYYY-MM-DD HH:mm') : '—'}</Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_: unknown, r: RunRecord) => (
        <Space size="small">
          {r.status === 'running' && (
            <Button size="small" danger onClick={() => handleCancel(r)}>
              Cancel
            </Button>
          )}
          {r.status === 'failed' && (
            <Button size="small" type="primary" onClick={() => handleRetry(r)}>
              Retry
            </Button>
          )}
          <Button size="small" onClick={() => openStageDetail(r)}>
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="运行历史明细">
      <Table
        columns={columns}
        dataSource={runs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
        size="small"
      />
    </Card>
  );
};
