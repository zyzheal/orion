/**
 * Config Center 表格列配置
 * - useItemColumns: 配置项列表列
 * - snapshotColumns: 快照列表列
 * - releaseColumns: 发布记录列
 * - auditColumns: 审计日志列
 */
import { useMemo } from 'react';
import { Typography, Tag, Space, Button, Popconfirm } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type {
  ConfigItem,
  ConfigSnapshot,
  ConfigRelease,
  ConfigAudit,
} from '@/api/distributedConfig';

const { Text } = Typography;

export interface ItemColumnsProps {
  onEdit: (item: ConfigItem) => void;
  onHistory: (item: ConfigItem) => void;
  onDelete: (id: string) => void;
}

export const useItemColumns = ({ onEdit, onHistory, onDelete }: ItemColumnsProps): ColumnsType<ConfigItem> =>
  useMemo<ColumnsType<ConfigItem>>(
    () => [
      { title: 'Key', dataIndex: 'keyName', key: 'keyName', width: 200 },
      {
        title: 'Value',
        dataIndex: 'value',
        key: 'value',
        ellipsis: true,
        render: (v: string) => (
          <Text copyable={{ text: v }}>{v.length > 50 ? v.slice(0, 50) + '...' : v}</Text>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'valueType',
        key: 'valueType',
        width: 80,
        render: (v: string) => <Tag>{v}</Tag>,
      },
      {
        title: '加密',
        dataIndex: 'encrypted',
        key: 'encrypted',
        width: 60,
        render: (v: boolean) => (v ? <Tag color="red">Yes</Tag> : <Tag>No</Tag>),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 160,
        render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
      },
      {
        title: '操作',
        key: 'action',
        width: 200,
        render: (_: unknown, record: ConfigItem) => (
          <Space>
            <Button
              size="small"
              type="link"
              icon={<HistoryOutlined />}
              onClick={() => onHistory(record)}
            >
              历史
            </Button>
            <Button size="small" type="link" onClick={() => onEdit(record)}>
              编辑
            </Button>
            <Popconfirm title="确认删除？" onConfirm={() => onDelete(record.id)}>
              <Button size="small" type="link" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [onEdit, onHistory, onDelete]
  );

export interface SnapshotColumnsProps {
  onPublish: (snapshot: ConfigSnapshot) => void;
}

export const useSnapshotColumns = ({ onPublish }: SnapshotColumnsProps): ColumnsType<ConfigSnapshot> =>
  useMemo<ColumnsType<ConfigSnapshot>>(
    () => [
      { title: '快照 ID', dataIndex: 'id', key: 'id', width: 100, ellipsis: true },
      { title: '环境', dataIndex: 'environment', key: 'environment', width: 100 },
      { title: '版本号', dataIndex: 'version', key: 'version', width: 80 },
      { title: 'Checksum', dataIndex: 'checksum', key: 'checksum', width: 120, ellipsis: true },
      {
        title: '创建者',
        dataIndex: 'createdBy',
        key: 'createdBy',
        width: 100,
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 160,
        render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
      },
      {
        title: '操作',
        key: 'action',
        width: 120,
        render: (_: unknown, record: ConfigSnapshot) => (
          <Button size="small" type="primary" onClick={() => onPublish(record)}>
            发布
          </Button>
        ),
      },
    ],
    [onPublish]
  );

export const releaseColumns: ColumnsType<ConfigRelease> = [
  {
    title: '版本',
    dataIndex: 'releaseVersion',
    key: 'releaseVersion',
    width: 80,
    render: (v: number) => <Tag color="blue">v{v}</Tag>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (v: string) => {
      const c: Record<string, string> = {
        released: 'green',
        rollback: 'orange',
        failed: 'red',
        pending: 'gold',
      };
      return <Tag color={c[v] || 'default'}>{v}</Tag>;
    },
  },
  { title: '环境', dataIndex: 'environment', key: 'environment', width: 100 },
  { title: 'Snapshot', dataIndex: 'snapshotId', key: 'snapshotId', ellipsis: true },
  { title: '发布人', dataIndex: 'releasedBy', key: 'releasedBy', width: 100 },
  { title: '说明', dataIndex: 'releaseNote', key: 'releaseNote', ellipsis: true },
  {
    title: '发布时间',
    dataIndex: 'releasedAt',
    key: 'releasedAt',
    width: 160,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
];

export const auditColumns: ColumnsType<ConfigAudit> = [
  { title: '操作者', dataIndex: 'actor', key: 'actor', width: 100 },
  {
    title: '动作',
    dataIndex: 'action',
    key: 'action',
    width: 100,
    render: (v: string) => <Tag>{v}</Tag>,
  },
  { title: '目标类型', dataIndex: 'targetType', key: 'targetType', width: 100 },
  { title: '目标 ID', dataIndex: 'targetId', key: 'targetId', ellipsis: true, width: 120 },
  {
    title: 'IP',
    dataIndex: 'ipAddress',
    key: 'ipAddress',
    width: 120,
    render: (v: string) => v || '-',
  },
  {
    title: '时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 160,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
];
