/**
 * ServiceCostRanking - 服务成本排行
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
import React from 'react';
import { Card, Typography } from 'antd';
import { BarChart } from '@/components/charts';
import { colors, spacing } from '@/tokens';
import type { FinOpsDashboardState } from '../useFinOpsDashboardState';

const { Text } = Typography;

interface ServiceCostRankingProps {
  state: FinOpsDashboardState;
}

export const ServiceCostRanking: React.FC<ServiceCostRankingProps> = ({ state }) => {
  const { loading, costByService } = state;

  return (
    <Card
      title="服务成本排行"
      bordered={false}
      style={{ borderRadius: 8, marginBottom: spacing.md }}
      loading={loading}
    >
      {costByService.length > 0 ? (
        <BarChart
          title=""
          data={costByService.map((c) => ({ label: c.service, value: c.cost }))}
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
            border: `1px dashed ${colors.neutral[300]}`,
          }}
        >
          <Text type="secondary" style={{ fontSize: spacing[4] }}>
            暂无成本排行数据
          </Text>
        </div>
      )}
    </Card>
  );
};
