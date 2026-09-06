/**
 * Runs History Tab
 * 运行历史 Tab 内容（抽取自 index.tsx）
 */
import React from 'react';
import { Card, Table, Button, Space, Tag } from 'antd';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { PipelineRunSummary } from '@/api/pipelineRuns';

const triggerLabels: Record<string, string> = {
  manual: '手动',
  push: 'Push',
  schedule: '定时',
  api: 'API',
};

export interface RunsHistoryTabProps {
  id: string | undefined;
  runs: PipelineRunSummary[];
  runsLoading: boolean;
  isRerunning: boolean;
  onNavigate: (path: string) => void;
  onRerun: () => void;
}

export const RunsHistoryTab: React.FC<RunsHistoryTabProps> = ({
  id,
  runs,
  runsLoading,
  isRerunning,
  onNavigate,
  onRerun,
}) => (
  <Card style={{ marginBottom: spacing.lg }} title={`运行历史 (${runs.length} 条)`}>
    <Table
      dataSource={runs}
      loading={runsLoading}
      rowKey="id"
      size="small"
      pagination={{ pageSize: 10, showSizeChanger: true }}
      columns={[
        {
          title: 'Run ID',
          dataIndex: 'id',
          key: 'id',
          width: 100,
          render: (runId: string) => (
            <Button type="link" size="small" onClick={() => onNavigate(`/pipelines/${runId}/runs/${runId}`)}>
              {runId.slice(0, 8)}...
            </Button>
          ),
        },
        {
          title: '状态',
          dataIndex: 'status',
          key: 'status',
          width: 100,
          render: (status: string) => <StatusBadge status={status as StatusType} />,
        },
        {
          title: '触发方式',
          dataIndex: 'triggerType',
          key: 'triggerType',
          width: 100,
          render: (type: string) => <Tag color="blue">{triggerLabels[type] || type || '-'}</Tag>,
        },
        {
          title: '开始时间',
          dataIndex: 'startTime',
          key: 'startTime',
          width: 160,
          render: (time: string) => (time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'),
        },
        {
          title: '耗时',
          dataIndex: 'duration',
          key: 'duration',
          width: 100,
          render: (ms: number) => {
            if (!ms) return '-';
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
          },
        },
        {
          title: '操作',
          key: 'action',
          width: 120,
          render: (_: unknown, record: PipelineRunSummary) => (
            <Space>
              <Button
                type="link"
                size="small"
                onClick={() => onNavigate(`/pipelines/${id}/runs/${record.id}`)}
              >
                查看
              </Button>
              {record.status === 'failed' && (
                <Button
                  type="link"
                  size="small"
                  onClick={onRerun}
                  loading={isRerunning}
                  disabled={isRerunning}
                >
                  重跑
                </Button>
              )}
            </Space>
          ),
        },
      ]}
    />
  </Card>
);
