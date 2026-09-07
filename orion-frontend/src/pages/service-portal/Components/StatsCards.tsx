/**
 * service-portal StatsCards
 * 抽取自 index.tsx (P2-9 Phase 182)
 */
import { Row, Col, Card, Statistic } from 'antd';
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';

interface StatsCardsProps {
  stats: { total: number; healthy: number; degraded: number; unhealthy: number };
}

export const StatsCards = ({ stats }: StatsCardsProps) => (
  <Row gutter={16} style={{ marginBottom: 16 }}>
    <Col span={6}>
      <Card style={{ borderRadius: 12 }} size="small">
        <Statistic title="服务总数" value={stats.total} />
      </Card>
    </Col>
    <Col span={6}>
      <Card style={{ borderRadius: 12 }} size="small">
        <Statistic
          title="健康"
          value={stats.healthy}
          valueStyle={{ color: colors.success[500] }}
          prefix={<CheckCircleOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card style={{ borderRadius: 12 }} size="small">
        <Statistic
          title="降级"
          value={stats.degraded}
          valueStyle={{ color: colors.warning[500] }}
          prefix={<WarningOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card style={{ borderRadius: 12 }} size="small">
        <Statistic
          title="不健康"
          value={stats.unhealthy}
          valueStyle={{ color: colors.error[500] }}
          prefix={<CloseCircleOutlined />}
        />
      </Card>
    </Col>
  </Row>
);
