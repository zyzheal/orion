/**
 * FinOps 页面表格列定义
 *
 * 使用工厂函数模式：列定义中引用的 handler 由工厂参数注入，
 * 保证列模块保持纯函数、可在多处复用。
 */
import { Button, Popconfirm, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type {
  Budget,
  CostBreakdownItem,
  OptimizationRecommendation,
} from '@/types/finops';
import { colors } from '@/tokens';
import {
  getCategoryLabel,
  getEntityTypeLabel,
  periodOptions,
  priorityConfig,
  statusConfig,
} from './config';

const { Text } = Typography;

// ============================================================================
// 成本分解表列（成本总览 Tab）
// ============================================================================

export function buildCostBreakdownColumns(): ColumnsType<CostBreakdownItem> {
  return [
    {
      title: '类别',
      dataIndex: 'dimensionValue',
      key: 'dimensionValue',
      render: (v: string) => (
        <Text strong style={{ color: colors.neutral[900] }}>
          {getCategoryLabel(v)}
        </Text>
      ),
    },
    {
      title: '成本 (¥)',
      dataIndex: 'cost',
      key: 'cost',
      sorter: (a, b) => a.cost - b.cost,
      render: (v: number) => (
        <Text strong style={{ color: colors.primary[500] }}>
          ¥
          {v.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      ),
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (v: number) => <Tag color={colors.primary[500]}>{v}%</Tag>,
    },
  ];
}

// ============================================================================
// 预算表列（预算管理 Tab）
// ============================================================================

export interface BudgetColumnsActions {
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
}

export function buildBudgetColumns(actions: BudgetColumnsActions): ColumnsType<Budget> {
  return [
    {
      title: '实体类型',
      dataIndex: 'entity_type',
      key: 'entity_type',
      width: 100,
      render: (v: string) => <Tag color="blue">{getEntityTypeLabel(v)}</Tag>,
    },
    {
      title: '实体 ID',
      dataIndex: 'entity_id',
      key: 'entity_id',
      ellipsis: true,
    },
    {
      title: '预算金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      sorter: (a, b) => a.amount - b.amount,
      render: (v: number) => (
        <Text strong style={{ color: colors.primary[500] }}>
          ¥{v.toLocaleString()}
        </Text>
      ),
    },
    {
      title: '周期',
      dataIndex: 'period',
      key: 'period',
      width: 80,
      render: (v: string) => (
        <Tag>{periodOptions.find((o) => o.value === v)?.label || v}</Tag>
      ),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 100,
      render: (v?: string) => (v ? <Tag color="geekblue">{v}</Tag> : '-'),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: Budget) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => actions.onEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="删除此预算后不可恢复"
            onConfirm={() => actions.onDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

// ============================================================================
// 优化建议表列（优化建议 Tab）
// ============================================================================

export interface RecommendationsColumnsActions {
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  /** 当前正在执行状态切换的建议 ID，用于按钮 loading 态 */
  updatingRecommendation: string | null;
}

export function buildRecommendationsColumns(
  actions: RecommendationsColumnsActions,
): ColumnsType<OptimizationRecommendation> {
  return [
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (v: string) => <Tag color="purple">{getCategoryLabel(v)}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '预估节省',
      dataIndex: 'estimated_savings',
      key: 'estimated_savings',
      width: 120,
      sorter: (a, b) => a.estimated_savings - b.estimated_savings,
      render: (v: number) => (
        <Text strong style={{ color: colors.success[500] }}>
          ¥{v.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (v: string) => (
        <Tag color={priorityConfig[v]?.color || 'default'}>
          {priorityConfig[v]?.label || v}
        </Tag>
      ),
    },
    {
      title: '投入',
      dataIndex: 'effort',
      key: 'effort',
      width: 60,
      render: (v: number) => <Tag>{v}天</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={statusConfig[v]?.color || 'default'}>{statusConfig[v]?.label || v}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: OptimizationRecommendation) => {
        if (record.status === 'identified' || record.status === 'reviewing') {
          return (
            <Space>
              <Button
                type="link"
                size="small"
                loading={actions.updatingRecommendation === record.id}
                onClick={() => actions.onApprove(record.id)}
              >
                批准
              </Button>
              <Button
                type="link"
                size="small"
                loading={actions.updatingRecommendation === record.id}
                onClick={() => actions.onReject(record.id)}
              >
                拒绝
              </Button>
              <Popconfirm
                title="确认删除"
                description="删除此优化建议后不可恢复"
                onConfirm={() => actions.onDelete(record.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" size="small" danger>
                  <DeleteOutlined />
                </Button>
              </Popconfirm>
            </Space>
          );
        }
        return (
          <Tag color={statusConfig[record.status]?.color}>
            {statusConfig[record.status]?.label}
          </Tag>
        );
      },
    },
  ];
}
