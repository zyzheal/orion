/**
 * columns.tsx - 任务队列列定义
 * 抽取自 index.tsx (P2-9 Phase 209)
 */
import { Button, Tag, Space, Badge } from 'antd';
import type { QueueJob, JobStatus } from '@/api/queue';

const statusColorMap: Record<JobStatus, string> = {
  pending: 'default',
  processing: 'processing',
  completed: 'success',
  failed: 'error',
};

export function buildQueueColumns(
  onComplete: (id: string) => void,
  onFail: (id: string) => void
) {
  return [
    {
      title: '任务 ID',
      dataIndex: 'id',
      key: 'id',
      width: 280,
      ellipsis: true,
    },
    {
      title: '队列',
      dataIndex: 'queue',
      key: 'queue',
      width: 120,
      render: (v: string) => <Tag>{v || 'default'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: JobStatus) => <Badge status={statusColorMap[v] as any} text={v} />,
    },
    {
      title: '重试次数',
      dataIndex: 'attempts',
      key: 'attempts',
      width: 100,
      render: (v: number) => (v > 0 ? <Tag color="warning">{v}</Tag> : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 160,
      render: (_: unknown, job: QueueJob) => (
        <Space>
          {job.status === 'processing' && (
            <Button type="link" size="small" onClick={() => onComplete(job.id)}>
              完成
            </Button>
          )}
          {(job.status === 'pending' || job.status === 'processing') && (
            <Button type="link" size="small" danger onClick={() => onFail(job.id)}>
              失败
            </Button>
          )}
        </Space>
      ),
    },
  ];
}
