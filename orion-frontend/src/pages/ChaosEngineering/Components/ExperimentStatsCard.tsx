/**
 * ExperimentStatsCard.tsx - 4 张统计卡
 * 抽取自 index.tsx (P2-9 Phase 232)
 */
import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

interface Stats {
  total: number;
  active: number;
  archived: number;
  completed: number;
}

interface Props {
  stats: Stats;
}

export const ExperimentStatsCard: React.FC<Props> = ({ stats }) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }} align="stretch">
    <Col span={6}>
      <Card size="small">
        <Statistic title="实验总数" value={stats.total} />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="就绪"
          value={stats.active}
          valueStyle={{ color: colors.success[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="已归档"
          value={stats.archived}
          valueStyle={{ color: colors.neutral[400] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="已完成"
          value={stats.completed}
          valueStyle={{ color: colors.neutral[400] }}
        />
      </Card>
    </Col>
  </Row>
);
