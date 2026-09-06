/**
 * FlameGraphLegend.tsx - 火焰图底部图例条
 * 抽取自 PerformanceFlameGraphPage.tsx (P2-9 Phase 44)
 * 显示: 高低层颜色指示、折叠子栈标记、按类别的百分比 tag
 */
import React from 'react';
import { Typography, Tag } from 'antd';
import { spacing } from '@/tokens';
import { themeVars } from '@/tokens';
import { FLAME_COLORS, formatValue } from './PerformanceFlameGraphConfig';

const { Text } = Typography;

export interface FlameGraphLegendProps {
  sortedCategories: [string, { value: number; pct: number }][];
}

export const FlameGraphLegend: React.FC<FlameGraphLegendProps> = ({ sortedCategories }) => {
  return (
    <div
      style={{
        height: 40,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${spacing.md}`,
        borderTop: `1px solid ${themeVars.borderDefault}`,
        backgroundColor: themeVars.bgSecondary,
        fontSize: 11,
        flexWrap: 'wrap',
        gap: spacing.xs,
      }}
    >
      <Text strong style={{ marginRight: spacing.sm }}>
        图例:
      </Text>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            backgroundColor: FLAME_COLORS[FLAME_COLORS.length - 1],
            borderRadius: 1,
          }}
        />
        <Text type="secondary">高层 (根)</Text>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            backgroundColor: FLAME_COLORS[0],
            borderRadius: 1,
          }}
        />
        <Text type="secondary">低层 (叶)</Text>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            backgroundColor: FLAME_COLORS[0],
            borderRadius: 1,
            opacity: 0.5,
            border: '1px dashed #ffffff',
          }}
        />
        <Text type="secondary">折叠子栈</Text>
      </span>
      <span
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          gap: spacing.sm,
          flexWrap: 'wrap',
        }}
      >
        {sortedCategories.map(([cat, stat]) => (
          <Tag
            key={cat}
            color={
              cat === 'runtime'
                ? 'blue'
                : cat === 'network'
                  ? 'green'
                  : cat === 'database'
                    ? 'orange'
                    : 'default'
            }
            style={{ fontSize: 10, padding: '0 6px' }}
          >
            {cat} {formatValue(stat.value)} ({stat.pct.toFixed(1)}%)
          </Tag>
        ))}
      </span>
    </div>
  );
};

export default FlameGraphLegend;
