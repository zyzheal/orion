import { Card, Row, Col, Statistic } from 'antd';
import { ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

interface Props {
  tracesCount: number;
  avgDuration: number;
  errorCount: number;
  servicesCount: number;
}

export function StatsRow({ tracesCount, avgDuration, errorCount, servicesCount }: Props) {
  return (
    <Row gutter={16} style={{ marginBottom: spacing.lg }}>
      <Col span={6}>
        <Card>
          <Statistic title="总 Trace 数" value={tracesCount} prefix={<ClockCircleOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="平均响应时间"
            value={avgDuration}
            suffix="ms"
            valueStyle={{
              color: avgDuration > 500 ? colors.warning[500] : colors.success[500],
            }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="错误数"
            value={errorCount}
            prefix={<ExclamationCircleOutlined />}
            valueStyle={{ color: errorCount > 0 ? colors.error[500] : colors.success[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="服务数" value={servicesCount} />
        </Card>
      </Col>
    </Row>
  );
}
