/**
 * ChaosEngineering Experiment Stats Row
 * 抽取自 index.tsx (P2-9 Phase 132)
 */
import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

interface ExperimentStats {
  total: number;
  active: number;
  completed: number;
  archived: number;
}

interface ExperimentStatsRowProps {
  stats: ExperimentStats;
}

export const ExperimentStatsRow: React.FC<ExperimentStatsRowProps> = ({ stats }) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
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
