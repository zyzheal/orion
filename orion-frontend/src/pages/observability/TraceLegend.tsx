/**
 * TraceLegend.tsx - Waterfall 图例（服务颜色 + Error + Search match）
 * 抽取自 TraceDetailPage.tsx (P2-9 Phase 43)
 */
import React from 'react';
import { Typography, Card } from 'antd';
import { spacing, radius } from '@/tokens';
import { colors } from '@/tokens/colors';

const { Text } = Typography;

export interface TraceLegendProps {
  serviceColorMap: Map<string, string>;
}

export const TraceLegend: React.FC<TraceLegendProps> = ({ serviceColorMap }) => (
  <Card size="small" style={{ marginTop: spacing.md, boxShadow: undefined }}>
    <div
      style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' }}
    >
      <Text strong style={{ fontSize: 12 }}>
        Legend:
      </Text>
      {serviceColorMap.size > 0 &&
        Array.from(serviceColorMap.entries()).map(([svc, color]) => (
          <span
            key={svc}
            style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12 }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 16,
                height: 10,
                backgroundColor: color,
                borderRadius: radius.xs,
                marginRight: 4,
              }}
            />
            <Text>{svc}</Text>
          </span>
        ))}
      <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>
        <span
          style={{
            display: 'inline-block',
            width: 16,
            height: 10,
            backgroundColor: colors.error[500],
            borderRadius: radius.xs,
            marginRight: 4,
          }}
        />
        <Text style={{ color: colors.error[500] }}>Error</Text>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>
        <span
          style={{
            display: 'inline-block',
            width: 16,
            height: 10,
            backgroundColor: colors.warning[50],
            borderRadius: radius.xs,
            marginRight: 4,
          }}
        />
        <Text type="secondary">Search match</Text>
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: 12,
          marginLeft: 'auto',
        }}
      >
        <Text type="secondary">滚轮缩放 &middot; Hover 查看详情 &middot; 点击选中</Text>
      </span>
    </div>
  </Card>
);
