/**
 * StageDetailDrawer - Stage 详情抽屉
 * 抽取自 index.tsx（P2-9 Phase 38）
 */
import React from 'react';
import { Drawer, Descriptions, Tag, Table, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { spacing } from '@/tokens';
import type { RunRecord, PipelineSummary } from './types';
import { statusConfig, formatDuration, toNumberMs } from './constants';

export interface StageDetailDrawerProps {
  selectedRun: RunRecord | null;
  pipelines: PipelineSummary[];
  stageDetails: unknown[];
  stageLoading: boolean;
  onClose: () => void;
}

type StageRow = {
  id?: string;
  name?: string;
  status?: string;
  durationMs?: number | string;
  startedAt?: string;
};

export const StageDetailDrawer: React.FC<StageDetailDrawerProps> = ({
  selectedRun,
  pipelines,
  stageDetails,
  stageLoading,
  onClose,
}) => {
  const stageColumns: ColumnsType<StageRow> = [
    { title: 'Stage', dataIndex: 'name', key: 'name' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusConfig[v]?.color || 'default'}>{v}</Tag>,
    },
    { title: 'Started At', dataIndex: 'startedAt', key: 'startedAt' },
    {
      title: 'Duration',
      key: 'duration',
      render: (_: unknown, r: StageRow) => formatDuration(toNumberMs(r.durationMs)),
    },
  ];

  return (
    <Drawer
      title={`Stage Detail — ${selectedRun?.id?.slice(0, 12) || ''}`}
      width={700}
      open={!!selectedRun}
      onClose={onClose}
    >
      {selectedRun && (
        <Descriptions bordered size="small" column={2} style={{ marginBottom: spacing.md }}>
          <Descriptions.Item label="Pipeline">
            {pipelines.find((p) => p.id === selectedRun.pipelineId)?.name ||
              selectedRun.pipelineId}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusConfig[selectedRun.status]?.color || 'default'}>
              {selectedRun.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Trigger">{selectedRun.triggerType}</Descriptions.Item>
          <Descriptions.Item label="耗时">
            {formatDuration(toNumberMs(selectedRun.durationMs))}
          </Descriptions.Item>
          <Descriptions.Item label="开始">
            {selectedRun.startedAt
              ? dayjs(selectedRun.startedAt).format('YYYY-MM-DD HH:mm:ss')
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="完成">
            {selectedRun.completedAt
              ? dayjs(selectedRun.completedAt).format('YYYY-MM-DD HH:mm:ss')
              : '—'}
          </Descriptions.Item>
        </Descriptions>
      )}
      {stageLoading ? (
        <Spin />
      ) : (
        <Table
          columns={stageColumns}
          dataSource={stageDetails as StageRow[]}
          rowKey="id"
          pagination={false}
          size="small"
        />
      )}
    </Drawer>
  );
};
