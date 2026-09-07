/**
 * AISecurity policy columns + filter defs
 * 抽取自 index.tsx (P2-9 Phase 118)
 */
import { Button, Popconfirm, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { TableColumn } from '@/components/Table';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import {
  severityColorMap,
  severityLabelMap,
  statusColorMap,
  statusLabelMap,
  typeIconMap,
  typeLabelMap,
  type UISecurityPolicy,
} from './config';

const { Text } = Typography;

export const FILTER_DEFS: FilterDefinition[] = [
  {
    key: 'type',
    label: '策略类型',
    options: [
      { label: '全部', value: 'all' },
      { label: '输入验证', value: 'input_validation' },
      { label: '输出过滤', value: 'output_filtering' },
      { label: 'PII 检测', value: 'pii_detection' },
      { label: '速率限制', value: 'rate_limiting' },
    ],
  },
  {
    key: 'status',
    label: '状态',
    options: [
      { label: '全部', value: 'all' },
      { label: '活跃', value: 'active' },
      { label: '未激活', value: 'inactive' },
      { label: '草稿', value: 'draft' },
      { label: '已违规', value: 'violated' },
    ],
  },
];

export interface BuildPolicyColumnsDeps {
  handleDelete: (id: string) => void;
  handleTogglePolicy: (record: UISecurityPolicy) => void;
  openEdit: (record: UISecurityPolicy) => void;
  openDetail: (record: UISecurityPolicy) => void;
}

export const buildPolicyColumns = ({
  handleDelete,
  handleTogglePolicy,
  openEdit,
  openDetail,
}: BuildPolicyColumnsDeps): TableColumn<UISecurityPolicy>[] => [
  {
    key: 'name',
    title: '策略名称',
    dataIndex: 'name',
    width: 200,
    sortable: true,
    render: (value: unknown, record: UISecurityPolicy) => (
      <Space direction="vertical" size={0}>
        <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
          {String(value)}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.description.substring(0, 40)}...
        </Text>
      </Space>
    ),
  },
  {
    key: 'type',
    title: '类型',
    width: 120,
    render: (_: unknown, record: UISecurityPolicy) => (
      <Tag icon={typeIconMap[record.type]} color="blue">
        {typeLabelMap[record.type]}
      </Tag>
    ),
  },
  {
    key: 'severity',
    title: '严重级别',
    width: 100,
    render: (_: unknown, record: UISecurityPolicy) => (
      <Tag color={severityColorMap[record.severity]}>{severityLabelMap[record.severity]}</Tag>
    ),
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (_: unknown, record: UISecurityPolicy) => (
      <Tag color={statusColorMap[record.status]}>{statusLabelMap[record.status]}</Tag>
    ),
  },
  {
    key: 'violations',
    title: '违规次数',
    dataIndex: 'violations',
    width: 100,
    sortable: true,
    render: (value: unknown, record: UISecurityPolicy) =>
      record.status === 'violated' ? (
        <Tag icon={<WarningOutlined />} color="red">
          {String(value)}
        </Tag>
      ) : (
        <Text type="secondary">{String(value)}</Text>
      ),
  },
  {
    key: 'enabled',
    title: '开关',
    width: 80,
    render: (_: unknown, record: UISecurityPolicy) => (
      <Switch
        size="small"
        checked={record.enabled}
        onChange={() => handleTogglePolicy(record)}
        checkedChildren="开"
        unCheckedChildren="关"
      />
    ),
  },
  {
    key: 'lastUpdated',
    title: '最后更新',
    dataIndex: 'lastUpdated',
    width: 140,
    sortable: true,
    render: (value: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(String(value)).fromNow()}
      </Text>
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 160,
    render: (_: unknown, record: UISecurityPolicy) => (
      <Space size="small" wrap>
        <Tooltip title="详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record)}
          />
        </Tooltip>
        <Tooltip title="编辑">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
        </Tooltip>
        <Popconfirm title="确认删除该策略?" onConfirm={() => handleDelete(record.id)}>
          <Tooltip title="删除">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      </Space>
    ),
  },
];
