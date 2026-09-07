/**
 * CostByService column definitions
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
import React from 'react';
import { Typography, Tooltip } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type { CostByServiceItem } from '@/api/finops';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

export const costByServiceColumns: TableColumn<CostByServiceItem>[] = [
  {
    key: 'service',
    title: '服务名称',
    dataIndex: 'service',
    render: (value: unknown) => <Text strong>{value as string}</Text>,
  },
  {
    key: 'cost',
    title: '月费用 (¥)',
    dataIndex: 'cost',
    sorter: (a: CostByServiceItem, b: CostByServiceItem) => a.cost - b.cost,
    render: (value: unknown) => (
      <Text strong style={{ color: colors.primary[500] }}>
        ¥{(value as number).toLocaleString()}
      </Text>
    ),
  },
  {
    key: 'percent',
    title: '占比',
    dataIndex: 'percent',
    render: (value: unknown) => (
      <Text strong style={{ color: colors.primary[500] }}>
        {value as number}%
      </Text>
    ),
  },
  {
    key: 'trend',
    title: '趋势',
    dataIndex: 'trend',
    width: 80,
    render: (value: unknown) => {
      const v = value as 'up' | 'down' | 'stable';
      const config: Record<string, { icon: React.ReactNode; color: string }> = {
        up: { icon: <ArrowUpOutlined />, color: colors.error[400] },
        down: { icon: <ArrowDownOutlined />, color: colors.success[500] },
        stable: { icon: <MinusOutlined />, color: colors.neutral[400] },
      };
      const c = config[v];
      return (
        <Tooltip title={v === 'up' ? '上升' : v === 'down' ? '下降' : '持平'}>
          <Text style={{ color: c.color, fontSize: spacing[4] }}>{c.icon}</Text>
        </Tooltip>
      );
    },
  },
];
