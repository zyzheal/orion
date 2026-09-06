/**
 * TraceServiceStats.tsx - 按服务统计的 Span 卡片
 * 抽取自 TraceDetailPage.tsx (P2-9 Phase 43)
 */
import React from 'react';
import { Typography, Card, Tag } from 'antd';
import { spacing, shadows } from '@/tokens';
import { colors } from '@/tokens/colors';
import type { TraceDetail } from '@/api/trace';
import { isSpanError } from './TraceDetailConfig';
import type { SpanNode } from './TraceDetailConfig';

const { Text } = Typography;

export interface TraceServiceStatsProps {
  detail: TraceDetail;
  flatSpans: SpanNode[];
  serviceColorMap: Map<string, string>;
}

export const TraceServiceStats: React.FC<TraceServiceStatsProps> = ({
  detail,
  flatSpans,
  serviceColorMap,
}) => (
  <div style={{ marginTop: spacing.md, display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
    {Object.entries(detail.spanCountByService).map(([svc, count]) => {
      const svcColor = serviceColorMap.get(svc) || colors.primary[500];
      const errorCount = flatSpans.filter(
        (n) => n.span.service === svc && isSpanError(n.span)
      ).length;
      return (
        <Card
          size="small"
          key={svc}
          style={{ minWidth: 130, boxShadow: shadows.sm, borderLeft: `3px solid ${svcColor}` }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: svcColor, fontWeight: 500 }}>{svc}</Text>
            <Text strong>{count}</Text>
          </div>
          <div style={{ marginTop: 4 }}>
            {errorCount > 0 ? (
              <Tag color={colors.error[500]} style={{ fontSize: 10 }}>
                {errorCount} error
              </Tag>
            ) : (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {count} spans
              </Text>
            )}
          </div>
        </Card>
      );
    })}
  </div>
);
