/**
 * RecentRunsTable
 * 最近运行表格（含状态标签、耗时格式化）
 * 抽取自 index.tsx 的 recentColumns + 最近运行 CardPanel
 */
import React from 'react';
import { Table, Tag, Empty } from 'antd';
import dayjs from 'dayjs';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import type { PipelineRunSummary } from '@/api/pipelineRuns';
import { statusColorMap, triggerTypeMap } from './constants';

export interface RecentRunsTableProps {
  recentRuns: PipelineRunSummary[];
  totalRuns: number;
  successRate: number;
  formatDuration: (ms: number) => string;
}

const statusIconMap: Record<string, React.ReactNode> = {
  success: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  running: <SyncOutlined spin />,
  cancelled: <CloseCircleOutlined />,
  pending: <ClockCircleOutlined />,
};

export const RecentRunsTable: React.FC<RecentRunsTableProps> = ({
  recentRuns,
  totalRuns,
  successRate,
  formatDuration,
}) => {
  const columns = [
    {
      title: 'Pipeline ID',
      dataIndex: 'pipelineId',
      key: 'pipelineId',
      width: 150,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag
          color={statusColorMap[status] || colors.neutral[500]}
          style={{ borderRadius: 4, minWidth: 60, textAlign: 'center' }}
        >
          {statusIconMap[status]} {status}
        </Tag>
      ),
    },
    {
      title: '触发方式',
      dataIndex: 'triggerType',
      key: 'triggerType',
      width: 100,
      render: (type: string) => <span>{triggerTypeMap[type] || type}</span>,
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 100,
      render: (ms: number | string) => {
        const dur = typeof ms === 'string' ? parseFloat(ms) : ms;
        return <span>{dur ? formatDuration(dur) : '-'}</span>;
      },
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
      render: (time: string) => (
        <span>{time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>
      ),
    },
  ];

  return (
    <CardPanel title="最近运行">
      {recentRuns.length > 0 ? (
        <Table
          dataSource={recentRuns}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          rowClassName={(record: PipelineRunSummary) =>
            record.status === 'running' ? 'pipeline-running-row' : ''
          }
        />
      ) : (
        <Empty description="暂无运行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      {recentRuns.length > 0 && (
        <div style={{ fontSize: spacing[3], color: colors.neutral[600], marginTop: spacing.sm }}>
          共 {totalRuns} 次运行，成功率 {successRate.toFixed(1)}%
        </div>
      )}
    </CardPanel>
  );
};
