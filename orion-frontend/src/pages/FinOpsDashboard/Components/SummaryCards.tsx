/**
 * SummaryCards - 摘要卡片行
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
import React from 'react';
import { Card, Col, Row, Typography } from 'antd';
import { GaugeChart, StatCard } from '@/components/charts';
import { spacing } from '@/tokens';
import type { FinOpsDashboardState } from '../useFinOpsDashboardState';

const { Text } = Typography;

interface SummaryCardsProps {
  state: FinOpsDashboardState;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ state }) => {
  const { loading, costSummary, budgetUsagePercent, monthOverMonthChange } = state;

  if (loading || !costSummary) {
    return <div style={{ textAlign: 'center', padding: '40px 0' }}>Loading...</div>;
  }

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          title="本月花费"
          value={costSummary.totalMonthly}
          suffix="¥"
          trend={{
            value: Math.abs(monthOverMonthChange),
            direction: monthOverMonthChange > 0 ? 'up' : 'down',
            good: monthOverMonthChange > 0 ? 'down' : 'up',
          }}
        />
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false} style={{ borderRadius: 8 }}>
          <GaugeChart
            value={budgetUsagePercent}
            title="预算使用"
            max={100}
            thresholds={{ warning: 70, danger: 90 }}
            size={160}
            unit="%"
          />
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              预算上限 ¥{costSummary.budgetLimit.toLocaleString()}
            </Text>
          </div>
        </Card>
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <StatCard title="预计浪费" value={costSummary.waste} suffix="¥" />
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <StatCard
          title="节省金额"
          value={costSummary.savings}
          suffix="¥"
          trend={{ value: 1, direction: 'up', good: 'up' }}
        />
      </Col>
    </Row>
  );
};
