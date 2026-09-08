/**
 * StatsRow.tsx - UEBA 统计卡片行
 * 抽取自 index.tsx (P2-9 Phase 242)
 */
import { Card, Row, Col, Statistic } from 'antd';
import { WarningOutlined, AlertOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface Props {
  risksCount: number;
  alertsCount: number;
  hours: number;
}

export function StatsRow({ risksCount, alertsCount, hours }: Props) {
  return (
    <Row gutter={16} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="高风险用户"
            value={risksCount}
            prefix={<WarningOutlined />}
            valueStyle={{ color: colors.error[400] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="异常告警"
            value={alertsCount}
            prefix={<AlertOutlined />}
            valueStyle={{ color: colors.warning[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="统计时段" value={hours} suffix="小时" />
        </Card>
      </Col>
    </Row>
  );
}
