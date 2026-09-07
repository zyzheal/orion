/**
 * digital-twin column definitions
 * 抽取自 index.tsx (P2-9 Phase 116)
 */
import { Badge, Button, Popconfirm, Progress, Space, Tag, Typography } from 'antd';
import { CameraOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DigitalTwin, SandboxEnv, TrafficRecording, TrafficReplay, TwinSnapshot } from '@/api/digital-twin';
import { STATUS_COLORS } from './useDigitalTwinState';

const { Text } = Typography;

type BadgeStatus = 'success' | 'processing' | 'default' | 'error' | 'warning';

const StatusCell = ({ status }: { status: string }) => (
  <Badge
    status={(STATUS_COLORS[status] || 'default') as BadgeStatus}
    text={status}
  />
);

const formatSize = (bytes: number): string => {
  if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

export interface TwinColumnsDeps {
  handleViewDetail: (record: DigitalTwin) => void;
  openSnapshotModal: (record: DigitalTwin) => void;
}

export const buildTwinColumns = ({
  handleViewDetail,
  openSnapshotModal,
}: TwinColumnsDeps): ColumnsType<DigitalTwin> => [
  { title: '名称', dataIndex: 'name', key: 'name', width: '18%', render: (text: string) => <Text strong>{text}</Text> },
  {
    title: '环境',
    dataIndex: 'environment',
    key: 'environment',
    width: '15%',
    render: (val: string) => <Tag>{val}</Tag>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '12%',
    render: (status: string) => <StatusCell status={status} />,
  },
  {
    title: '服务数',
    dataIndex: 'services',
    key: 'services',
    width: '10%',
    render: (services: string[]) => (services ? services.length : 0),
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: '20%',
    render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
  },
  {
    title: '操作',
    key: 'action',
    width: '25%',
    render: (_: unknown, record: DigitalTwin) => (
      <Space size="small">
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>详情</Button>
        <Button type="link" size="small" icon={<CameraOutlined />} onClick={() => openSnapshotModal(record)}>快照</Button>
      </Space>
    ),
  },
];

export interface SnapshotColumnsDeps {
  handleDeleteSnapshot: (id: string) => void;
}

export const buildSnapshotColumns = ({
  handleDeleteSnapshot,
}: SnapshotColumnsDeps): ColumnsType<TwinSnapshot> => [
  { title: 'ID', dataIndex: 'id', key: 'id', width: '20%', render: (val: string) => <Text code>{val.slice(0, 8)}...</Text> },
  { title: '环境', dataIndex: 'environment', key: 'environment', width: '15%' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '12%',
    render: (status: string) => <StatusCell status={status} />,
  },
  {
    title: '大小',
    dataIndex: 'size_bytes',
    key: 'size_bytes',
    width: '12%',
    render: (bytes: number) => formatSize(bytes),
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: '20%',
    render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
  },
  {
    title: '操作',
    key: 'action',
    width: '21%',
    render: (_: unknown, record: TwinSnapshot) => (
      <Popconfirm title="确认删除此快照？" onConfirm={() => handleDeleteSnapshot(record.id)} okText="确认" cancelText="取消">
        <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
      </Popconfirm>
    ),
  },
];

export const buildRecordingColumns = (): ColumnsType<TrafficRecording> => [
  { title: 'ID', dataIndex: 'id', key: 'id', width: '18%', render: (val: string) => <Text code>{val.slice(0, 8)}...</Text> },
  { title: '源环境', dataIndex: 'source_env', key: 'source_env', width: '15%' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '12%',
    render: (status: string) => <StatusCell status={status} />,
  },
  { title: '请求数', dataIndex: 'request_count', key: 'request_count', width: '10%' },
  {
    title: '大小',
    dataIndex: 'size_bytes',
    key: 'size_bytes',
    width: '10%',
    render: (bytes: number) => {
      if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
      if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${bytes} B`;
    },
  },
  {
    title: '开始时间',
    dataIndex: 'started_at',
    key: 'started_at',
    width: '20%',
    render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
  },
];

export const buildReplayColumns = (): ColumnsType<TrafficReplay> => [
  { title: 'ID', dataIndex: 'id', key: 'id', width: '15%', render: (val: string) => <Text code>{val.slice(0, 8)}...</Text> },
  { title: '录制 ID', dataIndex: 'recording_id', key: 'recording_id', width: '15%', render: (val: string) => <Text code>{val.slice(0, 8)}...</Text> },
  { title: '目标环境', dataIndex: 'target_env', key: 'target_env', width: '12%' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '10%',
    render: (status: string) => <StatusCell status={status} />,
  },
  {
    title: '进度',
    dataIndex: 'progress',
    key: 'progress',
    width: '15%',
    render: (progress: number) => <Progress percent={Math.round(progress * 100)} size="small" />,
  },
  {
    title: '匹配/不匹配',
    key: 'match',
    width: '15%',
    render: (_: unknown, record: TrafficReplay) => (
      <Space>
        <Tag color="green">{record.matched_count} 匹配</Tag>
        <Tag color="red">{record.mismatched_count} 不匹配</Tag>
      </Space>
    ),
  },
];

export const buildSandboxColumns = (): ColumnsType<SandboxEnv> => [
  { title: '名称', dataIndex: 'name', key: 'name', width: '20%', render: (text: string) => <Text strong>{text}</Text> },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '15%',
    render: (status: string) => <StatusCell status={status} />,
  },
  {
    title: '快照 ID',
    dataIndex: 'snapshot_id',
    key: 'snapshot_id',
    width: '20%',
    render: (val: string | null) => (val ? <Text code>{val.slice(0, 8)}...</Text> : '-'),
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: '20%',
    render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
  },
];
