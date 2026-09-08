import { Card, Row, Col, Statistic } from 'antd';
import { colors, spacing } from '@/tokens';

interface Props {
  total: number;
  runningCount: number;
  promotedCount: number;
  rolledbackCount: number;
}

export function StatsRow({ total, runningCount, promotedCount, rolledbackCount }: Props) {
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
      <Col span={6}>
        <Card>
          <Statistic title="总运行数" value={total} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="运行中" value={runningCount} valueStyle={{ color: colors.primary[500] }} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="已升级" value={promotedCount} valueStyle={{ color: colors.success[600] }} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="已回滚" value={rolledbackCount} valueStyle={{ color: colors.error[600] }} />
        </Card>
      </Col>
    </Row>
  );
}
