/**
 * FeatureFlagColumns.tsx - Feature Flags 列配置 + 常量
 * 抽取自 FeatureFlagsPage.tsx (P2-9 Phase 54)
 * FLAG_TYPE_OPTIONS / STRATEGY_OPTIONS / typeColor / typeLabel / strategyLabel 常量
 * useFeatureFlagColumns hook: 9 列表格 deps 模式
 */
import { useMemo } from 'react';
import { Typography, Tag, Space, Button, Switch, Tooltip, Popconfirm } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import { colors } from '@/tokens';
import type { FeatureFlag, FlagType, FlagStrategy } from '@/api/feature-flags';

const { Text } = Typography;

// ============================================================================
// Constants
// ============================================================================

export const FLAG_TYPE_OPTIONS: { label: string; value: FlagType }[] = [
  { label: '布尔值', value: 'boolean' },
  { label: '百分比', value: 'percentage' },
  { label: '字符串', value: 'string' },
  { label: '数值', value: 'number' },
];

export const STRATEGY_OPTIONS: { label: string; value: FlagStrategy }[] = [
  { label: '默认', value: 'default' },
  { label: '按租户', value: 'tenant' },
  { label: '按用户组', value: 'user-group' },
  { label: '百分比灰度', value: 'percentage' },
];

export const typeColor: Record<FlagType, string> = {
  boolean: colors.info[500],
  percentage: colors.purple[500],
  string: colors.success[500],
  number: colors.warning[500],
};

export const typeLabel: Record<FlagType, string> = {
  boolean: '布尔',
  percentage: '百分比',
  string: '字符串',
  number: '数值',
};

export const strategyLabel: Record<FlagStrategy, string> = {
  default: '默认',
  tenant: '租户',
  'user-group': '用户组',
  percentage: '百分比',
};

// ============================================================================
// Filter Definitions
// ============================================================================

export const filterDefinitions: FilterDefinition[] = [
  {
    key: 'type',
    label: '类型',
    options: [{ label: '全部', value: 'all' }, ...FLAG_TYPE_OPTIONS],
    placeholder: '按类型筛选',
  },
  {
    key: 'strategy',
    label: '策略',
    options: [{ label: '全部', value: 'all' }, ...STRATEGY_OPTIONS],
    placeholder: '按策略筛选',
  },
];

// ============================================================================
// Column Handlers
// ============================================================================

export interface FeatureFlagColumnsHandlers {
  handleToggle: (flag: FeatureFlag, enabled: boolean) => void;
  handleViewDetail: (flag: FeatureFlag) => void;
  handleOpenEvaluate: (flag: FeatureFlag) => void;
  handleOpenEdit: (flag: FeatureFlag) => void;
  handleDelete: (flag: FeatureFlag) => void;
}

// ============================================================================
// Column Hook
// ============================================================================

export function useFeatureFlagColumns(h: FeatureFlagColumnsHandlers): ColumnsType<FeatureFlag> {
  return useMemo((): ColumnsType<FeatureFlag> => {
    const { handleToggle, handleViewDetail, handleOpenEvaluate, handleOpenEdit, handleDelete } =
      h;
    return [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: 160,
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: 'Key',
        dataIndex: 'key',
        key: 'key',
        width: 180,
        render: (text: string) => (
          <Text code style={{ fontSize: 12 }}>
            {text}
          </Text>
        ),
      },
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        width: 80,
        filters: FLAG_TYPE_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
        onFilter: (value, record) => record.type === value,
        render: (type: FlagType) => <Tag color={typeColor[type]}>{typeLabel[type]}</Tag>,
      },
      {
        title: '策略',
        dataIndex: 'strategy',
        key: 'strategy',
        width: 100,
        filters: STRATEGY_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
        onFilter: (value, record) => record.strategy === value,
        render: (strategy: FlagStrategy) => <Tag>{strategyLabel[strategy]}</Tag>,
      },
      {
        title: '默认值',
        dataIndex: 'defaultValue',
        key: 'defaultValue',
        width: 100,
        ellipsis: true,
      },
      {
        title: '灰度',
        key: 'scope',
        width: 100,
        render: (_: unknown, record) => {
          if (record.percentage !== undefined) {
            return <Tag color="purple">{record.percentage}%</Tag>;
          }
          if (record.tenantId) return <Tag color="blue">租户</Tag>;
          if (record.userGroups && record.userGroups.length > 0)
            return <Tag color="green">用户组</Tag>;
          return <Tag color="default">全局</Tag>;
        },
      },
      {
        title: '评估次数',
        dataIndex: 'evaluationCount',
        key: 'evaluationCount',
        width: 90,
        sorter: (a, b) => a.evaluationCount - b.evaluationCount,
      },
      {
        title: '启用',
        key: 'enabled',
        width: 80,
        render: (_: unknown, record) => (
          <Switch
            size="small"
            checked={record.enabled}
            onChange={(checked) => handleToggle(record, checked)}
            checkedChildren="开"
            unCheckedChildren="关"
          />
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        render: (_: unknown, record) => (
          <Space size="small">
            <Tooltip title="详情">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetail(record)}
              />
            </Tooltip>
            <Tooltip title="评估">
              <Button
                type="link"
                size="small"
                icon={<ExperimentOutlined />}
                onClick={() => handleOpenEvaluate(record)}
              />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenEdit(record)}
              />
            </Tooltip>
            <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record)}>
              <Tooltip title="删除">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        ),
      },
    ];
  }, [h]);
}
