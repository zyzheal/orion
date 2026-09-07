/**
 * Executive Dashboard KPI cards row (8 cards in 4x2 grid)
 * 抽取自 index.tsx (P2-9 Phase 158)
 */
import { Col, Row } from 'antd';
import { spacing } from '@/tokens';
import { StatCard } from '@/components/charts';
import type { KPIMetric } from '@/types/pages';
import { KPI_ICONS } from '../constants';

interface KPICardsRowProps {
  metrics: KPIMetric[];
}

export const KPICardsRow = ({ metrics }: KPICardsRowProps) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    {metrics.map((metric) => (
      <Col xs={24} sm={12} lg={8} xl={6} key={metric.title}>
        <StatCard
          title={metric.title}
          value={metric.value}
          suffix={metric.suffix}
          icon={KPI_ICONS[metric.title]}
          trend={
            'trend' in metric && metric.trend
              ? {
                  value: metric.trend.value,
                  direction: metric.trend.direction as 'up' | 'down' | 'flat',
                  good: ['解决率', 'SLA合规率', '已解决'].includes(metric.title) ? 'up' : 'down',
                }
              : undefined
          }
        />
      </Col>
    ))}
  </Row>
);
