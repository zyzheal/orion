/**
 * SummaryCards - 4 个统计卡片
 * 抽取自 index.tsx (P2-9 Phase 123)
 */
import React from 'react';
import { Row, Col } from 'antd';
import CardPanel from '@/components/CardPanel';
import { StatCard } from '@/components/charts';
import { spacing } from '@/tokens';
import type { RiskDashboardState } from '../useRiskDashboardState';

interface SummaryCardsProps {
  state: RiskDashboardState;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ state }) => {
  const { status, events } = state;

  return (
    <div style={{ marginBottom: spacing.lg }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <CardPanel>
            <StatCard title="总评估数" value={status?.totalAssessments || 0} />
          </CardPanel>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <CardPanel>
            <StatCard title="评估中" value={status?.pendingAssessments || 0} />
          </CardPanel>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <CardPanel>
            <StatCard title="高风险" value={status?.highRiskCount || 0} />
          </CardPanel>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <CardPanel>
            <StatCard title="未确认事件" value={events.length} />
          </CardPanel>
        </Col>
      </Row>
    </div>
  );
};
