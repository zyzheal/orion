/**
 * BottleneckTable - 瓶颈分析表（按失败次数排序）
 * 抽取自 index.tsx（P2-9 Phase 38）
 */
import React from 'react';
import { Card, Table, Tag, Progress, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FireOutlined } from '@ant-design/icons';
import type { Bottleneck, RunRecord } from './types';
import { formatDuration } from './constants';

export interface BottleneckTableProps {
  bottlenecks: Bottleneck[];
  runs: RunRecord[];
}

export const BottleneckTable: React.FC<BottleneckTableProps> = ({ bottlenecks, runs }) => {
  const columns: ColumnsType<Bottleneck> = [
    { title: 'Pipeline', dataIndex: 'pipelineName', key: 'pipelineName' },
    {
      title: '失败次数',
      dataIndex: 'failureCount',
      key: 'failureCount',
      render: (v: number) => <Tag color={v > 0 ? 'red' : 'green'}>{v}</Tag>,
    },
    {
      title: '平均耗时',
      dataIndex: 'avgDurationMs',
      key: 'avgDurationMs',
      render: (v: number) => formatDuration(v),
    },
    {
      title: '成功率',
      key: 'rate',
      render: (_: unknown, b: Bottleneck) => {
        const pruns = runs.filter((r) => r.pipelineId === b.pipelineId);
        const rate =
          pruns.length > 0
            ? Math.round((pruns.filter((r) => r.status === 'success').length / pruns.length) * 100)
            : 0;
        return (
          <Progress
            percent={rate}
            size="small"
            status={rate >= 80 ? 'normal' : rate >= 50 ? 'active' : 'exception'}
            showInfo
          />
        );
      },
    },
  ];

  return (
    <Card title={<>
      <FireOutlined /> 瓶颈分析 — 按失败次数排序
    </>}>
      {bottlenecks.length > 0 ? (
        <Table
          columns={columns}
          dataSource={bottlenecks}
          rowKey="pipelineId"
          pagination={false}
          size="small"
        />
      ) : (
        <Empty description="无瓶颈数据" />
      )}
    </Card>
  );
};
