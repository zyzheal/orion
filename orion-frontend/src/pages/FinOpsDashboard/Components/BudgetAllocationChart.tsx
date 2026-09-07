/**
 * BudgetAllocationChart - 预算分配饼图
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
import React from 'react';
import { Card, Typography } from 'antd';
import { PieChart } from '@/components/charts';
import { colors, spacing } from '@/tokens';
import type { FinOpsDashboardState } from '../useFinOpsDashboardState';

const { Text } = Typography;

interface BudgetAllocationChartProps {
  state: FinOpsDashboardState;
}

export const BudgetAllocationChart: React.FC<BudgetAllocationChartProps> = ({ state }) => {
  const { loading, costByService } = state;

  return (
    <Card
      title="预算分配"
      bordered={false}
      style={{ borderRadius: 8, marginBottom: spacing.md }}
      loading={loading}
    >
      {costByService.length > 0 ? (
        <PieChart
          title="预算分配"
          data={costByService.map((c) => ({ name: c.service, value: c.cost }))}
          variant="donut"
          centerLabel={true}
          height={200}
        />
      ) : (
        <div
          style={{
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: colors.neutral[50],
            borderRadius: 6,
          }}
        >
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            暂无预算分配数据
          </Text>
        </div>
      )}
    </Card>
  );
};
