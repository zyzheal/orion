/**
 * FlameCategoryStats.tsx - 火焰图底部类别统计卡
 * 抽取自 PerformanceFlameGraphPage.tsx (P2-9 Phase 44)
 * 显示: 按 category 分组的 value + 占比 (top 6)
 */
import React from 'react';
import { Card, Typography } from 'antd';
import { spacing, shadows } from '@/tokens';
import { colors } from '@/tokens/colors';
import { formatValue } from './PerformanceFlameGraphConfig';

const { Text } = Typography;

export interface FlameCategoryStatsProps {
  sortedCategories: [string, { value: number; pct: number }][];
}

const catColorOf = (cat: string): string =>
  cat === 'runtime'
    ? colors.primary[500]
    : cat === 'network'
      ? colors.info[500]
      : cat === 'database'
        ? colors.warning[500]
        : cat === 'security'
          ? colors.error[500]
          : cat === 'io'
            ? colors.purple[500]
            : colors.neutral[600];

export const FlameCategoryStats: React.FC<FlameCategoryStatsProps> = ({
  sortedCategories,
}) => (
  <div style={{ marginTop: spacing.md, display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
    {sortedCategories.slice(0, 6).map(([cat, stat]) => {
      const catColor = catColorOf(cat);
      return (
        <Card
          size="small"
          key={cat}
          style={{
            minWidth: 120,
            boxShadow: shadows.sm,
            borderLeft: `3px solid ${catColor}`,
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ fontSize: 12, color: catColor, fontWeight: 500 }}>{cat}</Text>
            <Text strong>{formatValue(stat.value)}</Text>
          </div>
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {stat.pct.toFixed(1)}% of total
            </Text>
          </div>
        </Card>
      );
    })}
  </div>
);

export default FlameCategoryStats;
