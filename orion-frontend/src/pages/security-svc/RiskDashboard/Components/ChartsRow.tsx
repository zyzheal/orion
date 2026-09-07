/**
 * RiskDashboard charts row (heatmap + bar)
 * 抽取自 index.tsx (P2-9 Phase 143)
 */
import React from 'react';
import { Card, Col, Row } from 'antd';
import { HeatmapChart, BarChart, type HeatmapCell } from '@/components/charts';
import { spacing } from '@/tokens';
import { DAY_LABELS, SEVERITY_LABELS } from '../constants';

interface ChartsRowProps {
  heatmapData: HeatmapCell[];
  riskTypeData: Array<{ label: string; value: number }>;
}

export const ChartsRow: React.FC<ChartsRowProps> = ({ heatmapData, riskTypeData }) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
    <Col span={14}>
      <Card>
        <HeatmapChart
          title="风险分布（时间 × 严重性）"
          data={heatmapData}
          xAxis={DAY_LABELS}
          yAxis={SEVERITY_LABELS}
          colorScale="green-red"
          height={280}
        />
      </Card>
    </Col>
    <Col span={10}>
      <Card>
        <BarChart title="风险类型分布" data={riskTypeData} height={280} />
      </Card>
    </Col>
  </Row>
);
