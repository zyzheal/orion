/**
 * PermissionAudit StatsRow
 * 抽取自 index.tsx (P2-9 Phase 192)
 */
import { Card, Col, Row, Statistic } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface StatsRowProps {
  total: number;
  hours: number;
  activeUsers: number;
  maxDeny: number;
}

export const StatsRow = ({ total, hours, activeUsers, maxDeny }: StatsRowProps) => (
  <Row gutter={16} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card>
        <Statistic
          title="拒绝记录总数"
          value={total}
          prefix={<BarChartOutlined />}
          valueStyle={{ color: colors.error[400] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic title="统计时段 (小时)" value={hours} suffix="h" />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="活跃用户数"
          value={activeUsers}
          valueStyle={{ color: colors.primary[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="最高拒绝数"
          value={maxDeny}
          valueStyle={{ color: colors.warning[500] }}
        />
      </Card>
    </Col>
  </Row>
);
