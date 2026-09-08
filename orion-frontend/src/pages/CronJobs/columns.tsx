/**
 * CronJobs table columns
 * 抽取自 index.tsx (P2-9 Phase 195)
 */
import { Button, Popconfirm, Space, Tag } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { CronJob } from '@/api/cron';

export const statusTag = (job: CronJob) => {
  if (!job.enabled) return <Tag color="default">已禁用</Tag>;
  if (job.status === 'error') return <Tag color="error">异常</Tag>;
  if (job.status === 'running') return <Tag color="processing">运行中</Tag>;
  return <Tag color="success">就绪</Tag>;
};

interface ColumnDeps {
  onEdit: (job: CronJob) => void;
  onExecute: (id: string) => void;
  onDelete: (id: string) => void;
}

export const buildColumns = (deps: ColumnDeps): ColumnsType<CronJob> => [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
  },
  {
    title: '调度表达式',
    dataIndex: 'schedule',
    key: 'schedule',
    width: 160,
    render: (v: string) => <Tag color="blue">{v}</Tag>,
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (_: unknown, job: CronJob) => statusTag(job),
  },
  {
    title: '上次运行',
    dataIndex: 'lastRunAt',
    key: 'lastRunAt',
    width: 180,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
  {
    title: '下次运行',
    dataIndex: 'nextRunAt',
    key: 'nextRunAt',
    width: 180,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
  {
    title: '运行次数',
    dataIndex: 'runCount',
    key: 'runCount',
    width: 100,
  },
  {
    title: '操作',
    key: 'action',
    fixed: 'right' as const,
    render: (_: unknown, job: CronJob) => (
      <Space>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => deps.onEdit(job)}>
          编辑
        </Button>
        <Button
          type="link"
          size="small"
          icon={<ThunderboltOutlined />}
          onClick={() => deps.onExecute(job.id)}
        >
          执行
        </Button>
        <Popconfirm title="确认删除?" onConfirm={() => deps.onDelete(job.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];
