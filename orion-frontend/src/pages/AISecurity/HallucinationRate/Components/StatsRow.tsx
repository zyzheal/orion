import { Card, Row, Col, Statistic } from 'antd';
import { AlertOutlined, FilterOutlined, RadarChartOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface Props {
  total: number;
  rate: number;
  avgConfidence: number;
  criticalCount: number;
}

export function StatsRow({ total, rate, avgConfidence, criticalCount }: Props) {
  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Card size="small">
          <Statistic title="总请求数" value={total} prefix={<FilterOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="幻觉率" value={rate} suffix="%" prefix={<AlertOutlined />}
            valueStyle={{ color: rate > 5 ? colors.error[500] : colors.success[500] }} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="平均置信度" value={avgConfidence} precision={2} prefix={<RadarChartOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="严重幻觉数" value={criticalCount} prefix={<ThunderboltOutlined />}
            valueStyle={{ color: criticalCount > 0 ? colors.error[500] : colors.success[500] }} />
        </Card>
      </Col>
    </Row>
  );
}
