/**
 * EnvironmentColumns.tsx - 环境表格列配置 + 筛选定义
 * 抽取自 Environments/index.tsx (P2-9 Phase 82)
 */
import { Space, Tag, Typography, Button, Tooltip, Popconfirm } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import dayjs from 'dayjs';
import type { Environment, EnvironmentStatus } from '@/api/environments';
import { typeColorMap, typeLabelMap, statusColorMap, statusLabelMap } from './constants';

const { Text } = Typography;

interface EnvironmentColumnsProps {
  openDetail: (env: Environment) => void;
  openEdit: (env: Environment) => void;
  handleDelete: (id: string) => void;
  handleStatusChange: (id: string, status: EnvironmentStatus) => void;
}

export const makeEnvironmentColumns = (
  props: EnvironmentColumnsProps,
): TableColumn<Environment>[] => [
  {
    key: 'name',
    title: '环境名称',
    dataIndex: 'name',
    width: 180,
    sortable: true,
    render: (v: unknown, record: Environment) => (
      <Space direction="vertical" size={0}>
        <Text strong style={{ cursor: 'pointer' }} onClick={() => props.openDetail(record)}>
          <CloudServerOutlined style={{ marginRight: 6, color: typeColorMap[record.type] }} />
          {String(v)}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.project_id}
        </Text>
      </Space>
    ),
  },
  {
    key: 'type',
    title: '类型',
    width: 100,
    render: (_: unknown, record: Environment) => (
      <Tag color={typeColorMap[record.type] || 'default'}>
        {typeLabelMap[record.type] || record.type}
      </Tag>
    ),
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (_: unknown, record: Environment) => (
      <Tag color={statusColorMap[record.status] || 'default'}>
        {statusLabelMap[record.status] || record.status}
      </Tag>
    ),
  },
  {
    key: 'cluster',
    title: '集群',
    width: 150,
    render: (_: unknown, record: Environment) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {record.cluster || '-'}
      </Text>
    ),
  },
  {
    key: 'namespace',
    title: '命名空间',
    width: 120,
    render: (_: unknown, record: Environment) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {record.namespace || '-'}
      </Text>
    ),
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    dataIndex: 'updated_at',
    width: 140,
    sortable: true,
    render: (v: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {v ? dayjs(String(v)).format('YYYY-MM-DD HH:mm') : '-'}
      </Text>
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 240,
    render: (_: unknown, record: Environment) => (
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
        {record.status === 'active' && (
          <Tooltip title="设为维护中">
            <Button
              type="link"
              size="small"
              onClick={() => props.handleStatusChange(record.id, 'maintenance')}
            >
              维护
            </Button>
          </Tooltip>
        )}
        {record.status === 'maintenance' && (
          <Tooltip title="恢复运行">
            <Button
              type="link"
              size="small"
              onClick={() => props.handleStatusChange(record.id, 'active')}
            >
              恢复
            </Button>
          </Tooltip>
        )}
        {record.status === 'active' && (
          <Tooltip title="停用">
            <Button
              type="link"
              size="small"
              danger
              onClick={() => props.handleStatusChange(record.id, 'inactive')}
            >
              停用
            </Button>
          </Tooltip>
        )}
        <Tooltip title="删除">
          <Popconfirm
            title="确认删除该环境?"
            description="删除后不可恢复，请确认"
            onConfirm={() => props.handleDelete(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Tooltip>
      </Space>
    ),
  },
];

export const environmentFilterDefs: FilterDefinition[] = [
  {
    key: 'type',
    label: '环境类型',
    options: [
      { label: '全部', value: 'all' },
      { label: '开发', value: 'dev' },
      { label: '测试', value: 'testing' },
      { label: '预发', value: 'staging' },
      { label: '预生产', value: 'pre-prod' },
      { label: '生产', value: 'prod' },
    ],
  },
  {
    key: 'status',
    label: '状态',
    options: [
      { label: '全部', value: 'all' },
      { label: '运行中', value: 'active' },
      { label: '维护中', value: 'maintenance' },
      { label: '已停用', value: 'inactive' },
      { label: '已废弃', value: 'deprecated' },
    ],
  },
];
