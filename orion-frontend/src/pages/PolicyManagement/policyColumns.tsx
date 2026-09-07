/**
 * PolicyManagement column definitions
 * 抽取自 index.tsx (P2-9 Phase 114)
 */
import { Space, Tag, Button, Typography } from 'antd';
import dayjs from 'dayjs';
import { spacing } from '@/tokens';
import type { TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import type { PolicyDefinition, PolicyViolation } from '@/api/policies';

const { Text } = Typography;

const CATEGORY_COLOR_MAP: Record<string, string> = {
  security: 'red',
  cost: 'green',
  quality: 'blue',
  governance: 'purple',
};

const SEVERITY_COLOR_MAP: Record<string, string> = {
  block: 'red',
  warning: 'orange',
  info: 'default',
};

export interface BuildPolicyColumnsDeps {
  handleTogglePolicy: (policy: PolicyDefinition) => void;
  handleDeletePolicy: (id: string) => void;
  onEdit: (policy: PolicyDefinition) => void;
}

export const buildPolicyColumns = ({
  handleTogglePolicy,
  handleDeletePolicy,
  onEdit,
}: BuildPolicyColumnsDeps): TableColumn<PolicyDefinition>[] => [
  {
    key: 'name',
    title: '策略名称',
    dataIndex: 'name',
    width: 200,
    sortable: true,
    render: (value: unknown, record: PolicyDefinition) => (
      <Space direction="vertical" size={0}>
        <Text strong>{String(value)}</Text>
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {record.description || '-'}
        </Text>
      </Space>
    ),
  },
  {
    key: 'category',
    title: '分类',
    dataIndex: 'category',
    width: 120,
    render: (value: unknown) => (
      <Tag color={CATEGORY_COLOR_MAP[String(value)] || 'default'}>{String(value)}</Tag>
    ),
  },
  {
    key: 'severity',
    title: '严重级别',
    dataIndex: 'severity',
    width: 120,
    render: (value: unknown) => (
      <Tag color={SEVERITY_COLOR_MAP[String(value)] || 'default'}>{String(value)}</Tag>
    ),
  },
  {
    key: 'gateId',
    title: '门禁',
    dataIndex: 'gateId',
    width: 140,
    render: (value: unknown) =>
      value ? <Tag>{String(value)}</Tag> : <Text type="secondary">-</Text>,
  },
  {
    key: 'regoPath',
    title: 'Rego 路径',
    dataIndex: 'regoPath',
    width: 200,
    render: (value: unknown) => <Text code>{String(value)}</Text>,
  },
  {
    key: 'enabled',
    title: '状态',
    dataIndex: 'enabled',
    width: 100,
    render: (value: unknown) => (
      <StatusBadge status={value ? 'success' : 'cancelled'} size="small" />
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 200,
    render: (_: unknown, record: PolicyDefinition) => (
      <Space size="small">
        <Button type="link" size="small" onClick={() => onEdit(record)}>
          编辑
        </Button>
        <Button type="link" size="small" onClick={() => handleTogglePolicy(record)}>
          {record.enabled ? '禁用' : '启用'}
        </Button>
        <Button type="link" size="small" danger onClick={() => handleDeletePolicy(record.id)}>
          删除
        </Button>
      </Space>
    ),
  },
];

export interface BuildViolationColumnsDeps {
  handleResolveViolation: (id: string) => void;
}

export const buildViolationColumns = ({
  handleResolveViolation,
}: BuildViolationColumnsDeps): TableColumn<PolicyViolation>[] => [
  {
    key: 'policyName',
    title: '策略',
    dataIndex: 'policyName',
    width: 160,
    render: (value: unknown) => <Text strong>{value ? String(value) : '-'}</Text>,
  },
  {
    key: 'message',
    title: '消息',
    dataIndex: 'message',
    width: 300,
    render: (value: unknown) => (
      <Text ellipsis={{ tooltip: String(value) }} style={{ maxWidth: 300 }}>
        {String(value)}
      </Text>
    ),
  },
  {
    key: 'severity',
    title: '严重级别',
    dataIndex: 'severity',
    width: 100,
    render: (value: unknown) => (
      <Tag color={SEVERITY_COLOR_MAP[String(value)] || 'default'}>{String(value)}</Tag>
    ),
  },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (value: unknown) => (
      <StatusBadge
        status={value === 'open' ? 'warning' : value === 'resolved' ? 'success' : 'pending'}
        size="small"
      />
    ),
  },
  {
    key: 'createdAt',
    title: '创建时间',
    dataIndex: 'createdAt',
    width: 160,
    render: (value: unknown) => (
      <Text type="secondary" style={{ fontSize: spacing[3] }}>
        {dayjs(String(value)).fromNow()}
      </Text>
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    render: (_: unknown, record: PolicyViolation) =>
      record.status === 'open' ? (
        <Button type="link" size="small" onClick={() => handleResolveViolation(record.id)}>
          解决
        </Button>
      ) : null,
  },
];
