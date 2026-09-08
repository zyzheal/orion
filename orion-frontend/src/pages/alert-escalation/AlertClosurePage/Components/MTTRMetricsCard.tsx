/**
 * MTTRMetricsCard.tsx - MTTR 指标卡（4 张统计 + 平均 MTTR）
 * 抽取自 index.tsx (P2-9 Phase 235)
 */
import React from 'react';
import { Card, Col, Row, Typography } from 'antd';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

interface Metrics {
  totalAlerts: number;
  openCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  avgMTTRSeconds: number;
  avgMTTRFormatted: string;
}

interface Props {
  metrics: Metrics;
}

export const MTTRMetricsCard: React.FC<Props> = ({ metrics }) => (
  <Row gutter={[spacing.md, spacing.md]}>
    <Col span={6}>
      <Card>
        <Text type="secondary">总告警数</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>
          {metrics.totalAlerts}
        </div>
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Text type="secondary">待确认</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.warning[500] }}>
          {metrics.openCount}
        </div>
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Text type="secondary">已确认</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.info[500] }}>
          {metrics.acknowledgedCount}
        </div>
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Text type="secondary">已解决</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>
          {metrics.resolvedCount}
        </div>
      </Card>
    </Col>
    <Col span={24}>
      <Card>
        <Text type="secondary">平均 MTTR</Text>
        <div
          style={{ fontSize: 32, fontWeight: 700, color: colors.purple[500], marginTop: 4 }}
        >
          {metrics.avgMTTRFormatted || '0s'}
        </div>
        <Text type="secondary">({metrics.avgMTTRSeconds} 秒)</Text>
      </Card>
    </Col>
  </Row>
);
