/**
 * CronManagement table columns
 * 抽取自 index.tsx (P2-9 Phase 193)
 */
import { Button, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import {
  PlayCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type { CronJob } from '@/api/cron';
import dayjs from 'dayjs';

const { Text } = Typography;

export const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  running: { color: 'processing', label: '运行中', icon: <PlayCircleOutlined /> },
  idle: { color: 'success', label: '空闲', icon: <CheckCircleOutlined /> },
  error: { color: 'error', label: '错误', icon: <CloseCircleOutlined /> },
  disabled: { color: 'default', label: '已禁用', icon: <StopOutlined /> },
};

interface ColumnDeps {
  onExecute: (id: string) => void;
  onEdit: (job: CronJob) => void;
  onDelete: (id: string) => void;
}

export const buildColumns = (deps: ColumnDeps): TableColumn<CronJob>[] => [
  {
    key: 'name',
    title: '名称',
    dataIndex: 'name',
    width: 150,
    render: (v: unknown) => <Text strong>{String(v)}</Text>,
  },
  {
    key: 'schedule',
    title: '调度表达式',
    dataIndex: 'schedule',
    width: 150,
    render: (v: unknown) => (
      <Text code style={{ fontSize: 12 }}>
        {String(v)}
      </Text>
    ),
  },
  {
    key: 'command',
    title: '命令',
    dataIndex: 'command',
    ellipsis: true,
    render: (v: unknown) => (
      <Text code style={{ fontSize: 11 }}>
        {String(v)}
      </Text>
    ),
  },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 90,
    render: (v: unknown) => {
      const cfg = STATUS_CONFIG[String(v)] ?? {
        color: 'default',
        label: String(v),
        icon: null,
      };
      return (
        <Tag color={cfg.color} icon={cfg.icon}>
          {cfg.label}
        </Tag>
      );
    },
  },
  {
    key: 'enabled',
    title: '启用',
    dataIndex: 'enabled',
    width: 70,
    render: (v: unknown) => (v ? <Tag color="success">是</Tag> : <Tag>否</Tag>),
  },
  {
    key: 'runCount',
    title: '执行次数',
    dataIndex: 'runCount',
    width: 90,
  },
  {
    key: 'lastRunAt',
    title: '上次执行',
    dataIndex: 'lastRunAt',
    width: 150,
    render: (v: unknown) => (v ? dayjs(String(v)).format('MM-DD HH:mm') : '—'),
  },
  {
    key: 'nextRunAt',
    title: '下次执行',
    dataIndex: 'nextRunAt',
    width: 150,
    render: (v: unknown) => (v ? dayjs(String(v)).format('MM-DD HH:mm') : '—'),
  },
  {
    key: 'actions',
    title: '操作',
    width: 160,
    render: (_: unknown, record: CronJob) => (
      <Space size="small">
        <Tooltip title="立即执行">
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => deps.onExecute(record.id)}
            disabled={record.status === 'running'}
          />
        </Tooltip>
        <Tooltip title="编辑">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => deps.onEdit(record)}
          />
        </Tooltip>
        <Popconfirm title="确认删除该定时任务?" onConfirm={() => deps.onDelete(record.id)}>
          <Tooltip title="删除">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      </Space>
    ),
  },
];

