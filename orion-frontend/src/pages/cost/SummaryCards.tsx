/**
 * SummaryCards.tsx - Budget Guard 顶部统计卡
 * 抽取自 BudgetGuardPage.tsx (P2-9 Phase 45)
 * 显示: 4 个 Statistic 卡 (Guards 总数/active, Total Budget, Evaluations, Blocked)
 */
import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import { SafetyOutlined, ThunderboltOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { BudgetGuard, CostForecastResult } from '@/api/cost-operations';

export interface SummaryCardsProps {
  guards: BudgetGuard[];
  forecast: CostForecastResult | null;
  evaluationCount: number;
  blockedCount: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  guards,
  evaluationCount,
  blockedCount,
}) => {
  const activeCount = guards.filter((g) => g.status === 'active').length;
  const totalBudget = guards.reduce((sum, g) => sum + g.budgetAmount, 0);

  return (
    <Row gutter={spacing[4]} style={{ marginBottom: spacing[4] }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="Budget Guards"
            value={guards.length}
            prefix={<SafetyOutlined />}
            suffix={`/ ${activeCount} active`}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Total Budget"
            value={totalBudget}
            precision={2}
            prefix="¥"
            suffix="/ month"
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="Evaluations" value={evaluationCount} prefix={<ThunderboltOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Blocked"
            value={blockedCount}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: blockedCount > 0 ? colors.error[500] : colors.success[500] }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default SummaryCards;
