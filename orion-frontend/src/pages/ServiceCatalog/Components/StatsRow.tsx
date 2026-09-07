/**
 * ServiceCatalog StatsRow
 * 抽取自 index.tsx (P2-9 Phase 189)
 */
import { Card, Col, Row, Typography } from 'antd';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

interface StatsRowProps {
  itemsCount: number;
  enabledCount: number;
  totalBreaches: number;
  activeBreaches: number;
}

export const StatsRow = ({ itemsCount, enabledCount, totalBreaches, activeBreaches }: StatsRowProps) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card>
        <Text type="secondary">服务总数</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>
          {itemsCount}
        </div>
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Text type="secondary">已启用</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>
          {enabledCount}
        </div>
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Text type="secondary">SLA 违约总数</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.error[500] }}>
          {totalBreaches}
        </div>
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Text type="secondary">活跃违约</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.warning[500] }}>
          {activeBreaches}
        </div>
      </Card>
    </Col>
  </Row>
);
