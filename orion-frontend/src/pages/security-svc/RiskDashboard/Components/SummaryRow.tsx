/**
 * RiskDashboard summary stats
 * 抽取自 index.tsx (P2-9 Phase 143)
 */
import React from 'react';
import { Col, Row } from 'antd';
import { StatCard } from '@/components/charts';
import { spacing } from '@/tokens';

interface SummaryRowProps {
  totalAssessments: number;
  pendingAssessments: number;
  highRiskCount: number;
  unacknowledgedCount: number;
}

export const SummaryRow: React.FC<SummaryRowProps> = ({
  totalAssessments,
  pendingAssessments,
  highRiskCount,
  unacknowledgedCount,
}) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
    <Col span={6}>
      <StatCard title="总评估数" value={totalAssessments} />
    </Col>
    <Col span={6}>
      <StatCard title="评估中" value={pendingAssessments} />
    </Col>
    <Col span={6}>
      <StatCard title="高风险" value={highRiskCount} />
    </Col>
    <Col span={6}>
      <StatCard title="未确认事件" value={unacknowledgedCount} />
    </Col>
  </Row>
);
