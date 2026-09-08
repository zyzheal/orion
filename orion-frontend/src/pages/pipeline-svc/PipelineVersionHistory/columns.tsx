/**
 * columns.tsx - PipelineVersionHistory 表格列定义
 * 抽取自 index.tsx (P2-9 Phase 228)
 */
import { Button, Space, Tag, Typography } from 'antd';
import type { TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import { spacing } from '@/tokens';
import type { PipelineVersion } from '@/api/pipeline-versions';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Props {
  onRollback: (record: PipelineVersion) => void;
  onSetBaseline: (record: PipelineVersion) => void;
}

export function buildVersionColumns({ onRollback, onSetBaseline }: Props): TableColumn<PipelineVersion>[] {
  return [
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 100,
      render: (v: unknown) => (
        <Tag color="blue" style={{ fontFamily: 'monospace' }}>
          v{String(v)}
        </Tag>
      ),
    },
    {
      key: 'change_summary',
      title: '变更摘要',
      dataIndex: 'change_summary',
      ellipsis: true,
      render: (summary: unknown) => (summary as string) || <Text type="secondary">无</Text>,
    },
    {
      key: 'tags',
      title: '标签',
      dataIndex: 'tags',
      width: 180,
      render: (tags: unknown) => (
        <Space wrap>
          {(tags as string[]).map((t) => (
            <Tag key={t} color="default">
              {t}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      key: 'is_baseline',
      title: '基线',
      dataIndex: 'is_baseline',
      width: 80,
      render: (isBaseline: unknown) =>
        isBaseline ? <StatusBadge status="success" size="small" /> : '-',
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      sortable: true,
      render: (date: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(date as string).fromNow()}
        </Text>
      ),
    },
    {
      key: 'created_by',
      title: '创建人',
      dataIndex: 'created_by',
      width: 120,
      render: (by: unknown) => <Text code>{(by as string) || '-'}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: PipelineVersion) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => onRollback(record)}>
            回滚
          </Button>
          <Button type="link" size="small" onClick={() => onSetBaseline(record)}>
            {record.is_baseline ? '取消基线' : '设为基线'}
          </Button>
        </Space>
      ),
    },
  ];
}
