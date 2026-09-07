/**
 * Traffic Governance stats cards
 * 抽取自 index.tsx (P2-9 Phase 157)
 */
import { Card, Col, Row, Statistic } from 'antd';
import { GatewayOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { TrafficStats } from '../types';

interface StatsCardsProps {
  stats: TrafficStats;
}

export const StatsCards = ({ stats }: StatsCardsProps) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    <Col xs={24} sm={12} lg={6}>
      <Card>
        <Statistic
          title="总规则数"
          value={stats.totalRules}
          prefix={<GatewayOutlined style={{ color: colors.primary[500] }} />}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card>
        <Statistic
          title="活跃规则"
          value={stats.activeRules}
          valueStyle={{ color: colors.success[500] }}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card>
        <Statistic title="平均 Canary 流量" value={stats.avgCanaryWeight} suffix="%" />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card>
        <Statistic title="总流量切分" value={stats.totalTraffic} suffix="%" />
      </Card>
    </Col>
  </Row>
);
