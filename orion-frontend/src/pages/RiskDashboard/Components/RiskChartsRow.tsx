/**
 * RiskChartsRow - 风险分布热力图 + 风险类型柱状图
 * 抽取自 index.tsx (P2-9 Phase 123)
 */
import React from 'react';
import { Row, Col } from 'antd';
import CardPanel from '@/components/CardPanel';
import { HeatmapChart, BarChart } from '@/components/charts';
import { spacing } from '@/tokens';
import { dayLabels, severityLabels } from '../constants';
import type { RiskDashboardState } from '../useRiskDashboardState';

interface RiskChartsRowProps {
  state: RiskDashboardState;
}

export const RiskChartsRow: React.FC<RiskChartsRowProps> = ({ state }) => {
  const { heatmapData, riskTypeData } = state;

  return (
    <div style={{ marginBottom: spacing.lg }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <CardPanel>
            <HeatmapChart
              title="风险分布（时间 × 严重性）"
              data={heatmapData}
              xAxis={dayLabels}
              yAxis={severityLabels}
              colorScale="green-red"
              height={280}
            />
          </CardPanel>
        </Col>
        <Col xs={24} lg={10}>
          <CardPanel>
            <BarChart title="风险类型分布" data={riskTypeData} height={280} />
          </CardPanel>
        </Col>
      </Row>
    </div>
  );
};
