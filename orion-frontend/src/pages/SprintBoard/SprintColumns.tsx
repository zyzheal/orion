/**
 * SprintColumns - Sprint 列表列配置 + Backlog 列配置
 * 抽取自 index.tsx
 */
import { Typography, Tag, Space, Button, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  CalendarOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors } from '@/tokens';
import type { Sprint } from '@/api/sprints';
import { sprintStatusColor, sprintStatusLabel, priorityColor, priorityLabel } from './constants';

const { Text } = Typography;

export interface SprintColumnsDeps {
  handleActivate: (record: Sprint) => void;
  handleComplete: (record: Sprint) => void;
  handleEdit: (record: Sprint) => void;
  handleDelete: (id: string) => void;
}

export function buildSprintColumns(deps: SprintColumnsDeps): ColumnsType<Sprint> {
  const { handleActivate, handleComplete, handleEdit, handleDelete } = deps;
  return [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '目标',
      dataIndex: 'goal',
      key: 'goal',
      ellipsis: true,
      render: (text: string | null) => text || <Text type="secondary">-</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={sprintStatusColor[status]}>{sprintStatusLabel[status] ?? status}</Tag>
      ),
    },
    {
      title: '时间范围',
      key: 'dateRange',
      render: (_: unknown, record: Sprint) => (
        <Space size={4}>
          <CalendarOutlined style={{ color: colors.neutral[400] }} />
          <Text type="secondary">
            {dayjs(record.startDate).format('MM/DD')} - {dayjs(record.endDate).format('MM/DD')}
          </Text>
        </Space>
      ),
    },
    {
      title: '容量',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (cap: number | null) => (cap != null ? `${cap} 点` : <Text type="secondary">-</Text>),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_: unknown, record: Sprint) => (
        <Space>
          {record.status === 'planning' && (
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleActivate(record)}
              style={{ color: colors.success[500] }}
            >
              启动
            </Button>
          )}
          {record.status === 'active' && (
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleComplete(record)}
              style={{ color: colors.warning[500] }}
            >
              完成
            </Button>
          )}
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此 Sprint？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

export type BacklogItem = {
  ticketId: string;
  title: string;
  priority: string;
  storyPoints: number | null;
};

export interface BacklogColumnsDeps {
  selectedSprintId: string | null;
  handleAddToSprint: (ticketId: string) => void;
}

export function buildBacklogColumns(deps: BacklogColumnsDeps): ColumnsType<BacklogItem> {
  const { selectedSprintId, handleAddToSprint } = deps;
  return [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (p: string) => <Tag color={priorityColor[p]}>{priorityLabel[p] ?? p}</Tag>,
    },
    {
      title: '故事点',
      dataIndex: 'storyPoints',
      key: 'storyPoints',
      width: 100,
      render: (sp: number | null) => (sp != null ? sp : <Text type="secondary">-</Text>),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: BacklogItem) => (
        <Button
          type="link"
          icon={<PlusOutlined />}
          onClick={() => handleAddToSprint(record.ticketId)}
          disabled={!selectedSprintId}
        >
          加入 Sprint
        </Button>
      ),
    },
  ];
}
