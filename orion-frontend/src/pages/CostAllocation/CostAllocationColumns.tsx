/**
 * CostAllocationColumns.tsx - 表格列定义
 * 抽取自 CostAllocation/index.tsx (P2-9 Phase 72)
 */
import { useMemo } from 'react';
import { Tag, Space, Button, Typography, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, ClusterOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors } from '@/tokens';
import { scopeTypeLabel, scopeTypeColor, formatCost } from './constants';
import type { CostTrend, FinopsBudget } from '@/api/cost-allocation';

const { Text } = Typography;

// --- Namespace Table Columns ---
export const useNamespaceColumns = () =>
  useMemo<ColumnsType<{ namespace: string; cost: number }>>(
    () => [
      {
        title: '排名',
        key: 'rank',
        width: 60,
        render: (_, __, index) => (
          <Tag color={index < 3 ? colors.error[500] : 'default'}>{index + 1}</Tag>
        ),
      },
      {
        title: '命名空间',
        dataIndex: 'namespace',
        key: 'namespace',
        render: (text: string) => (
          <Space>
            <ClusterOutlined style={{ color: colors.primary[500] }} />
            <Text strong>{text}</Text>
          </Space>
        ),
      },
      {
        title: '本月费用',
        dataIndex: 'cost',
        key: 'cost',
        align: 'right',
        sorter: (a, b) => a.cost - b.cost,
        render: (cost: number) => (
          <Text
            style={{ color: cost > 10000 ? colors.error[500] : colors.neutral[900], fontWeight: 600 }}
          >
            {formatCost(cost)}
          </Text>
        ),
      },
    ],
    [],
  );

// --- Trend Table Columns ---
export const useTrendColumns = (trend: CostTrend[]) =>
  useMemo<ColumnsType<CostTrend>>(
    () => [
      {
        title: '月份',
        dataIndex: 'month',
        key: 'month',
        render: (text: string) => <Tag>{text}</Tag>,
      },
      {
        title: '总费用',
        dataIndex: 'totalCost',
        key: 'totalCost',
        align: 'right',
        render: (v: number) => <Text strong>{formatCost(v)}</Text>,
      },
      {
        title: '计算',
        dataIndex: 'computeCost',
        key: 'computeCost',
        align: 'right',
        render: (v: number) => formatCost(v),
      },
      {
        title: '存储',
        dataIndex: 'storageCost',
        key: 'storageCost',
        align: 'right',
        render: (v: number) => formatCost(v),
      },
      {
        title: '环比变化',
        key: 'change',
        align: 'right',
        render: (_, __, index) => {
          if (index >= trend.length - 1) return '-';
          const current = trend[index].totalCost;
          const prev = trend[index + 1].totalCost;
          if (!prev) return '-';
          const pct = ((current - prev) / prev) * 100;
          const isUp = pct > 0;
          return (
            <Text style={{ color: isUp ? colors.error[500] : colors.success[500] }}>
              {isUp ? '+' : ''}
              {pct.toFixed(1)}%
            </Text>
          );
        },
      },
    ],
    [trend],
  );

// --- Budget Table Columns ---
export const useBudgetColumns = (params: {
  handleEditBudget: (record: FinopsBudget) => void;
  handleDeleteBudget: (id: string) => void;
}) =>
  useMemo<ColumnsType<FinopsBudget>>(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: '范围类型',
        dataIndex: 'scopeType',
        key: 'scopeType',
        render: (type: string) => (
          <Tag color={scopeTypeColor[type]}>{scopeTypeLabel[type] ?? type}</Tag>
        ),
      },
      {
        title: '范围值',
        dataIndex: 'scopeValue',
        key: 'scopeValue',
      },
      {
        title: '月度限额',
        dataIndex: 'monthlyLimit',
        key: 'monthlyLimit',
        align: 'right',
        render: (v: number, record) => formatCost(v) + (record.currency ? ` ${record.currency}` : ''),
      },
      {
        title: '告警阈值',
        dataIndex: 'alertThreshold',
        key: 'alertThreshold',
        align: 'center',
        render: (v: number) => <Tag color="orange">{v}%</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        key: 'enabled',
        align: 'center',
        render: (enabled: boolean) => (
          <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        render: (_, record) => (
          <Space>
            <Button type="link" icon={<EditOutlined />} onClick={() => params.handleEditBudget(record)}>
              编辑
            </Button>
            <Popconfirm title="确认删除此预算？" onConfirm={() => params.handleDeleteBudget(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [params.handleEditBudget, params.handleDeleteBudget],
  );
