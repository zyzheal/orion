/**
 * Queue columns 构建器
 * 抽取自 index.tsx (P2-9 Phase 105)
 */
import { Button, Space, Tag, Typography, Tooltip, Popconfirm } from 'antd';
const { Text } = Typography;
import {
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { QueueJob, JobStatus } from '@/api/queue';
import { statusColorMap, statusLabelMap, statusIconMap } from './constants';

interface ColumnDeps {
  openDetail: (job: QueueJob) => void;
  handleComplete: (id: string) => void;
  handleFail: (id: string) => void;
}

export const buildQueueColumns = (
  deps: ColumnDeps
): ColumnsType<QueueJob> => [
  {
    title: '任务 ID',
    dataIndex: 'id',
    key: 'id',
    width: 120,
    render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
  },
  {
    title: '队列名称',
    dataIndex: 'queue',
    key: 'queue',
    width: 150,
    render: (v: string) => <Tag color="blue">{v}</Tag>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (v: JobStatus) => (
      <Tag color={statusColorMap[v]} icon={statusIconMap[v]}>
        {statusLabelMap[v]}
      </Tag>
    ),
  },
  {
    title: '重试次数',
    dataIndex: 'attempts',
    key: 'attempts',
    width: 80,
    render: (v: number) => <Text type={v > 2 ? 'danger' : 'secondary'}>{v}</Text>,
  },
  {
    title: 'Payload',
    dataIndex: 'payload',
    key: 'payload',
    ellipsis: true,
    render: (v: Record<string, unknown>) => (
      <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
        {JSON.stringify(v).substring(0, 60)}...
      </Text>
    ),
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 140,
    render: (v: string) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(v).fromNow()}
      </Text>
    ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    render: (_: unknown, record: QueueJob) => (
      <Space size="small" wrap>
        <Tooltip title="详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => deps.openDetail(record)}
          >
            详情
          </Button>
        </Tooltip>
        {record.status === 'processing' && (
          <>
            <Tooltip title="标记完成">
              <Popconfirm
                title="确认标记为完成?"
                onConfirm={() => deps.handleComplete(record.id)}
              >
                <Button type="link" size="small" icon={<CheckCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
            <Tooltip title="标记失败">
              <Popconfirm
                title="确认标记为失败?"
                onConfirm={() => deps.handleFail(record.id)}
              >
                <Button type="link" size="small" danger icon={<CloseCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          </>
        )}
        {record.status === 'failed' && record.attempts < 5 && (
          <Tooltip title="重新入队功能开发中">
            <Button type="link" size="small" icon={<SyncOutlined />} disabled>
              重试
            </Button>
          </Tooltip>
        )}
      </Space>
    ),
  },
];
