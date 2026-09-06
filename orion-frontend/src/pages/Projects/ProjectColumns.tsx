/**
 * ProjectColumns.tsx - 项目表格列配置 + 筛选定义 + 资源列配置
 * 抽取自 Projects/index.tsx (P2-9 Phase 83)
 */
import {
  Space,
  Tag,
  Typography,
  Button,
  Tooltip,
  Popconfirm,
  Avatar,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FolderOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import { colors } from '@/tokens/colors';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Project, ProjectResource } from '@/api/projects';
import { statusColorMap, statusLabelMap, resourceTypeLabelMap } from './constants';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface ProjectColumnsProps {
  openDetail: (p: Project) => void;
  openEdit: (p: Project) => void;
  handleDelete: (id: string) => void;
}

export const makeProjectColumns = (props: ProjectColumnsProps): TableColumn<Project>[] => [
  {
    key: 'name',
    title: '项目名称',
    dataIndex: 'name',
    width: 200,
    sortable: true,
    render: (v: unknown, record: Project) => (
      <Space direction="vertical" size={0}>
        <Text strong style={{ cursor: 'pointer' }} onClick={() => props.openDetail(record)}>
          <FolderOutlined style={{ marginRight: 6, color: colors.primary[500] }} />
          {String(v)}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          / {record.slug}
        </Text>
      </Space>
    ),
  },
  {
    key: 'description',
    title: '描述',
    dataIndex: 'description',
    width: 250,
    render: (v: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {v ? String(v).slice(0, 50) + (String(v).length > 50 ? '...' : '') : '-'}
      </Text>
    ),
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (_: unknown, record: Project) => (
      <Tag color={statusColorMap[record.status] || 'default'}>
        {statusLabelMap[record.status] || record.status}
      </Tag>
    ),
  },
  {
    key: 'team',
    title: '负责人',
    width: 120,
    render: (_: unknown, record: Project) => (
      <Space>
        <Avatar size="small" style={{ backgroundColor: colors.primary[500] }}>
          {record.teamLead ? record.teamLead.charAt(0) : '?'}
        </Avatar>
        <Text>{record.teamLead || '-'}</Text>
      </Space>
    ),
  },
  {
    key: 'members',
    title: '团队成员',
    width: 120,
    render: (_: unknown, record: Project) => (
      <Tooltip title={record.teamMembers?.join(', ')}>
        <Space>
          <TeamOutlined />
          <Text>{record.teamMembers?.length || 0} 人</Text>
        </Space>
      </Tooltip>
    ),
  },
  {
    key: 'environments',
    title: '环境',
    width: 150,
    render: (_: unknown, record: Project) => (
      <Space wrap>
        {record.environments?.map((env: string) => (
          <Tag key={env} color="blue" style={{ fontSize: 11 }}>
            {env}
          </Tag>
        )) || <Text type="secondary">-</Text>}
      </Space>
    ),
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    dataIndex: 'updatedAt',
    width: 140,
    sortable: true,
    render: (v: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(String(v)).fromNow()}
      </Text>
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 160,
    render: (_: unknown, record: Project) => (
      <Space size="small" wrap>
        <Tooltip title="详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => props.openDetail(record)}
          >
            详情
          </Button>
        </Tooltip>
        <Tooltip title="编辑">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => props.openEdit(record)}
          />
        </Tooltip>
        <Tooltip title="删除">
          <Popconfirm title="确认删除该项目?" onConfirm={() => props.handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Tooltip>
      </Space>
    ),
  },
];

export const projectFilterDefs: FilterDefinition[] = [
  {
    key: 'status',
    label: '状态',
    options: [
      { label: '全部', value: 'all' },
      { label: '运行中', value: 'active' },
      { label: '已暂停', value: 'suspended' },
      { label: '已归档', value: 'archived' },
    ],
  },
];

export const projectResourceColumns: TableColumn<ProjectResource>[] = [
  {
    title: '资源名称',
    dataIndex: 'name',
    key: 'name',
    render: (v: unknown) => <Text strong>{String(v)}</Text>,
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    render: (v: unknown) => <Tag>{resourceTypeLabelMap[String(v)] || String(v)}</Tag>,
  },
  {
    title: '外部ID',
    dataIndex: 'externalId',
    key: 'externalId',
    render: (v: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {String(v)}
      </Text>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (v: unknown) => (
      <Tag color={String(v) === 'active' ? 'green' : 'default'}>{String(v)}</Tag>
    ),
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (v: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(String(v)).format('YYYY-MM-DD')}
      </Text>
    ),
  },
];
