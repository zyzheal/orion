/**
 * columns.tsx - Pipeline List 表格列定义
 * 抽取自 index.tsx (P2-9 Phase 217)
 */
import { useMemo } from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import { PlayCircleOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { TableColumn } from '@/components/Table';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import type { Pipeline } from '@/api/pipelines';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface BuildColumnsParams {
  onRun: (record: Pipeline) => void;
  onView: (record: Pipeline) => void;
  onEdit: (record: Pipeline) => void;
  onViewRuns: (record: Pipeline) => void;
}

export function buildPipelineListColumns({ onRun, onView, onEdit, onViewRuns }: BuildColumnsParams) {
  return useMemo<TableColumn<Pipeline>[]>(
    () => [
      {
        key: 'name',
        title: 'Pipeline',
        dataIndex: 'name',
        width: 200,
        sortable: true,
        filterable: true,
        render: (_value: unknown, record) => (
          <Space direction="vertical" size={0}>
            <Text
              strong
              style={{ cursor: 'pointer', color: colors.primary[500] }}
              onClick={() => onView(record)}
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
        width: '12%',
        render: (value: unknown) => (
          <StatusBadge status={String(value) as StatusType} size="small" />
        ),
      },
      {
        key: 'stages',
        title: 'Stage 数量',
        dataIndex: 'spec',
        width: '12%',
        render: (spec: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const count = ((spec as any)?.stages?.length || 0) as number;
          return <Tag color="blue">{count} 个 Stage</Tag>;
        },
      },
      {
        key: 'createdAt',
        title: '创建时间',
        dataIndex: 'createdAt',
        width: '15%',
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
        width: '15%',
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
        width: 320,
        render: (_: unknown, record) => (
          <Space size="small">
            <Button type="link" size="small" onClick={() => onView(record)}>
              查看
            </Button>
            <Button type="link" size="small" onClick={() => onEdit(record)}>
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => onRun(record)}
            >
              运行
            </Button>
            <Button
              type="link"
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={() => onViewRuns(record)}
            >
              运行记录
            </Button>
          </Space>
        ),
      },
    ],
    [onRun, onView, onEdit, onViewRuns]
  );
}
