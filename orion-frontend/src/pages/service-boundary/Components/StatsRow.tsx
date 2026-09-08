import { Card, Row, Col, Statistic } from 'antd';
import {
  ClusterOutlined,
  AlertOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ServiceBoundaryState } from '../useServiceBoundaryState';

interface Props {
  state: ServiceBoundaryState;
}

export function StatsRow({ state: s }: Props) {
  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
      <Col span={4}>
        <Card size="small">
          <Statistic title="模块总数" value={s.safeModules.length} prefix={<ClusterOutlined />} />
        </Card>
      </Col>
      <Col span={4}>
        <Card size="small">
          <Statistic title="高风险模块" value={s.highRiskCount} prefix={<AlertOutlined />} valueStyle={{ color: colors.error[500] }} />
        </Card>
      </Col>
      <Col span={4}>
        <Card size="small">
          <Statistic title="接口层缺失" value={s.noInterfaceCount} prefix={<SafetyCertificateOutlined />} valueStyle={{ color: colors.warning[500] }} />
        </Card>
      </Col>
      <Col span={4}>
        <Card size="small">
          <Statistic title="平均引用" value={s.avgRefs} prefix={<DatabaseOutlined />} />
        </Card>
      </Col>
      <Col span={4}>
        <Card size="small">
          <Statistic title="接口覆盖率" value={s.interfaceRate} suffix="%" prefix={<CloudServerOutlined />} valueStyle={{ color: colors.error[500] }} />
        </Card>
      </Col>
      <Col span={4}>
        <Card size="small">
          <Statistic title="循环依赖" value={0} prefix={<ThunderboltOutlined />} valueStyle={{ color: colors.success[500] }} />
        </Card>
      </Col>
    </Row>
  );
}
