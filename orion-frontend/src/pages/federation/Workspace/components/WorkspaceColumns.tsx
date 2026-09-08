/**
 * WorkspaceColumns.tsx - Workspace 表格列定义
 * 抽取自 index.tsx (P2-9 Phase 221)
 */
import { Button, Popconfirm, Progress, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Workspace } from '../workspaceApi';

const { Text } = Typography;

interface Props {
  onEdit: (record: Workspace) => void;
  onDelete: (id: string) => void;
}

export const buildWorkspaceColumns = ({ onEdit, onDelete }: Props): ColumnsType<Workspace> => [
  {
    title: '工作空间',
    dataIndex: 'name',
    key: 'name',
    render: (v: string) => <Text strong>{v}</Text>,
  },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  {
    title: '集群',
    dataIndex: 'clusterId',
    key: 'clusterId',
    width: 120,
    render: (v: string) => <Tag>{v}</Tag>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    render: (v: string) => (
      <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? '活跃' : '停用'}</Tag>
    ),
  },
  {
    title: 'CPU',
    key: 'cpu',
    width: 100,
    render: (_: unknown, r: Workspace) => (
      <Progress
        type="circle"
        size={32}
        percent={r.cpuQuota > 0 ? Math.round((r.cpuUsed / r.cpuQuota) * 100) : 0}
        format={() => `${r.cpuUsed}/${r.cpuQuota}`}
      />
    ),
  },
  {
    title: '内存',
    key: 'mem',
    width: 100,
    render: (_: unknown, r: Workspace) => (
      <Progress
        type="circle"
        size={32}
        percent={r.memoryQuota > 0 ? Math.round((r.memoryUsed / r.memoryQuota) * 100) : 0}
        format={() => `${r.memoryUsed}/${r.memoryQuota}G`}
      />
    ),
  },
  { title: '成员', dataIndex: 'memberCount', key: 'memberCount', width: 80 },
  {
    title: '操作',
    key: 'action',
    width: 140,
    render: (_: unknown, record: Workspace) => (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
          编辑
        </Button>
        <Popconfirm title="确认删除?" onConfirm={() => onDelete(record.id)}>
          <Button size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];
