/**
 * Change Management stats bar
 * 抽取自 index.tsx (P2-9 Phase 160)
 */
import { Col, Row } from 'antd';
import MetricCard from '@/components/MetricCard';
import { spacing } from '@/tokens';
import type { MetricCardData } from '../stats';

interface StatsBarProps {
  statsCards: MetricCardData[];
  loading: boolean;
}

export const StatsBar = ({ statsCards, loading }: StatsBarProps) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
    {statsCards.map((card) => (
      <Col xs={24} sm={12} md={8} lg={4} xl={4} key={card.title}>
        <MetricCard
          title={card.title}
          value={card.value}
          icon={card.icon}
          color={card.color}
          loading={loading}
          size="small"
        />
      </Col>
    ))}
  </Row>
);
