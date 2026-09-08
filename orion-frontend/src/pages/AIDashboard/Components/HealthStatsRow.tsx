/**
 * HealthStatsRow.tsx - 3 张场景健康统计卡
 * 抽取自 index.tsx (P2-9 Phase 224)
 */
import { Card, Col, Row, Statistic } from 'antd';
import {
  CheckCircleOutlined,
  DashboardOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface Props {
  healthyCount: number;
  totalScenarios: number;
  totalRequests: number;
  avgLatency: number;
}

export const HealthStatsRow = ({
  healthyCount,
  totalScenarios,
  totalRequests,
  avgLatency,
}: Props) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    <Col xs={24} sm={8}>
      <Card size="small">
        <Statistic
          title="健康场景"
          value={healthyCount}
          suffix={`/ ${totalScenarios}`}
          prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
        />
      </Card>
    </Col>
    <Col xs={24} sm={8}>
      <Card size="small">
        <Statistic
          title="总请求数"
          value={totalRequests}
          prefix={<ThunderboltOutlined style={{ color: colors.primary[500] }} />}
        />
      </Card>
    </Col>
    <Col xs={24} sm={8}>
      <Card size="small">
        <Statistic
          title="平均延迟"
          value={avgLatency}
          suffix="ms"
          prefix={<DashboardOutlined style={{ color: colors.warning[500] }} />}
        />
      </Card>
    </Col>
  </Row>
);
