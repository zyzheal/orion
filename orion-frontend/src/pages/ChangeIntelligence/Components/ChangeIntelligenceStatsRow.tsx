/**
 * ChangeIntelligenceStatsRow - 顶部 4 张 Statistic
 * 抽取自 index.tsx (P2-9 Phase 119)
 */
import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { colors, spacing } from '@/tokens';
import type { ChangeIntelligenceState } from '../useChangeIntelligenceState';

interface ChangeIntelligenceStatsRowProps {
  state: ChangeIntelligenceState;
}

export const ChangeIntelligenceStatsRow: React.FC<ChangeIntelligenceStatsRowProps> = ({ state }) => {
  const { reports, trends, highRiskCount, avgRiskScore } = state;
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
      <Col span={6}>
        <Card>
          <Statistic title="分析总数" value={reports.length} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="平均风险" value={avgRiskScore * 100} precision={1} suffix="%" />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="高风险变更"
            value={highRiskCount}
            valueStyle={{ color: colors.error[600] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="趋势"
            value={trends.length > 0 ? '稳定' : '无数据'}
            valueStyle={{ color: colors.success[600] }}
          />
        </Card>
      </Col>
    </Row>
  );
};
