/**
 * BudgetGuardColumns.tsx - Budget Guard 表格列配置
 * 抽取自 BudgetGuardPage.tsx (P2-9 Phase 45)
 * 8 列: Name (icon+text), Description, Budget (currency+amount), Action (allow/block/warn tag),
 *       Scope (projects/env), Status (active/inactive tag), Created, Actions (edit/toggle/delete)
 */
import { Button, Space, Tag, Switch, Popconfirm, Typography } from 'antd';
import {
  SafetyOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type { BudgetGuard } from '@/api/cost-operations';

const { Text } = Typography;

export interface BuildBudgetGuardColumnsDeps {
  editForm: {
    setFieldsValue: (values: Record<string, unknown>) => void;
  };
  onEdit: (guard: BudgetGuard) => void;
  onToggle: (guard: BudgetGuard) => void;
  onDelete: (id: string) => void;
}

export const buildBudgetGuardColumns = ({
  editForm,
  onEdit,
  onToggle,
  onDelete,
}: BuildBudgetGuardColumnsDeps): TableColumn<BudgetGuard>[] => [
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
    width: 180,
    render: (_: unknown, record: BudgetGuard) => (
      <Space>
        <SafetyOutlined />
        <Text strong>{record.name}</Text>
      </Space>
    ),
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
    render: (value: unknown) => (value as string | null) || '--',
  },
  {
    title: 'Budget',
    dataIndex: 'budgetAmount',
    key: 'budgetAmount',
    width: 120,
    render: (_: unknown, record: BudgetGuard) => (
      <Text>
        {record.currency || 'CNY'} {record.budgetAmount.toLocaleString()}
      </Text>
    ),
  },
  {
    title: 'Action',
    dataIndex: 'action',
    key: 'action',
    width: 100,
    render: (value: unknown) => {
      const action = value as 'allow' | 'block' | 'warn';
      const config = {
        allow: { color: 'success', icon: <CheckCircleOutlined />, label: 'Allow' },
        block: { color: 'error', icon: <CloseCircleOutlined />, label: 'Block' },
        warn: { color: 'warning', icon: <WarningOutlined />, label: 'Warn' },
      }[action];
      return (
        <Tag icon={config.icon} color={config.color}>
          {config.label}
        </Tag>
      );
    },
  },
  {
    title: 'Scope',
    dataIndex: 'scope',
    key: 'scope',
    width: 180,
    render: (value: unknown) => {
      const scope = value as BudgetGuard['scope'];
      if (!scope) return <Text type="secondary">Global</Text>;
      const parts: string[] = [];
      if (scope.projectIds?.length) parts.push(`${scope.projectIds.length} projects`);
      if (scope.environment) parts.push(scope.environment);
      return <Text>{parts.join(', ') || 'Global'}</Text>;
    },
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (value: unknown) => {
      const status = value as 'active' | 'inactive';
      return (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? 'Active' : 'Inactive'}
        </Tag>
      );
    },
  },
  {
    title: 'Created',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 160,
    render: (value: unknown) => new Date(value as string).toLocaleDateString(),
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 180,
    fixed: 'right' as const,
    render: (_: unknown, record: BudgetGuard) => (
      <Space>
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            editForm.setFieldsValue({
              name: record.name,
              description: record.description || undefined,
              budgetAmount: record.budgetAmount,
              currency: record.currency || 'CNY',
              action: record.action,
            });
            onEdit(record);
          }}
        >
          Edit
        </Button>
        <Switch
          size="small"
          checked={record.status === 'active'}
          onChange={() => onToggle(record)}
          checkedChildren="On"
          unCheckedChildren="Off"
        />
        <Popconfirm
          title="Delete Budget Guard"
          description={`Are you sure you want to delete "${record.name}"?`}
          onConfirm={() => onDelete(record.id)}
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            Delete
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];
