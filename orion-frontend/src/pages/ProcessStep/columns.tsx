/**
 * columns.tsx - 流程引擎表格列定义
 * 抽取自 ProcessStep/index.tsx (P2-9 Phase 96)
 */
import {
  Space,
  Button,
  Tag,
  Badge,
  Tooltip,
  Popconfirm,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { ProcessDefinition, ProcessInstance } from '@/api/process-steps';
import { statusColor, statusLabel } from './constants';

const { Text } = Typography;

export const makeDefColumns = (deps: {
  handleViewDefDetail: (id: string) => void;
  handleEditDef: (def: ProcessDefinition) => void;
  handleDeleteDef: (id: string) => void;
  handleStartInstance: (defId?: string) => void;
}): ColumnsType<ProcessDefinition> => [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    render: (text: string, record) => (
      <a onClick={() => deps.handleViewDefDetail(record.id)}>{text}</a>
    ),
  },
  {
    title: '实体类型',
    dataIndex: 'entityType',
    key: 'entityType',
    render: (text: string) => <Tag>{text}</Tag>,
  },
  {
    title: '步骤数',
    key: 'stepCount',
    render: (_: unknown, record) => record.steps?.length || 0,
  },
  {
    title: '状态',
    dataIndex: 'enabled',
    key: 'enabled',
    render: (enabled: boolean) => (
      <Badge status={enabled ? 'success' : 'default'} text={enabled ? '启用' : '禁用'} />
    ),
  },
  {
    title: '版本',
    dataIndex: 'version',
    key: 'version',
    width: 80,
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
    width: 240,
    render: (_: unknown, record) => (
      <Space>
        <Tooltip title="查看详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => deps.handleViewDefDetail(record.id)}
          />
        </Tooltip>
        <Tooltip title="编辑">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => deps.handleEditDef(record)}
          />
        </Tooltip>
        <Tooltip title="启动实例">
          <Button
            type="link"
            size="small"
            icon={<RocketOutlined />}
            onClick={() => deps.handleStartInstance(record.id)}
          />
        </Tooltip>
        <Popconfirm title="确定删除此流程定义？" onConfirm={() => deps.handleDeleteDef(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  },
];

export const makeInstColumns = (deps: {
  handleViewInstance: (id: string) => void;
}): ColumnsType<ProcessInstance> => [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 120,
    ellipsis: true,
    render: (text: string) => (
      <Text copyable={{ text }} style={{ fontSize: 12 }}>
        {text.slice(0, 8)}...
      </Text>
    ),
  },
  {
    title: '定义ID',
    dataIndex: 'definitionId',
    key: 'definitionId',
    width: 120,
    ellipsis: true,
  },
  {
    title: '实体类型',
    dataIndex: 'entityType',
    key: 'entityType',
    render: (text: string) => <Tag>{text}</Tag>,
  },
  {
    title: '实体ID',
    dataIndex: 'entityId',
    key: 'entityId',
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => (
      <Tag color={statusColor[status] || 'default'}>{statusLabel[status] || status}</Tag>
    ),
  },
  {
    title: '当前步骤',
    dataIndex: 'currentStepId',
    key: 'currentStepId',
    ellipsis: true,
    render: (text: string | null) => text || '-',
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
    width: 120,
    render: (_: unknown, record) => (
      <Space>
        <Tooltip title="查看详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => deps.handleViewInstance(record.id)}
          />
        </Tooltip>
      </Space>
    ),
  },
];
