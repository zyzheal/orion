import { Card, Row, Col, Statistic } from 'antd';
import {
  SmileOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { SpaceData } from '../types';

interface Props {
  data: SpaceData;
}

export function StatsRow({ data }: Props) {
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col span={6}>
        <Card size="small">
          <Statistic title="开发者满意度" value={data.satisfaction.score}
            suffix="/100" prefix={<SmileOutlined />}
            valueStyle={{ color: colors.success[500] }} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="构建成功率" value={data.performance.buildSuccessRate}
            suffix="%" prefix={<ThunderboltOutlined />}
            valueStyle={{ color: colors.success[500] }} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="PR 数" value={data.activity.prs}
            prefix={<TeamOutlined />} valueStyle={{ color: colors.primary[500] }} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="部署频率(次/天)" value={data.efficiency.deploymentFrequency}
            prefix={<RocketOutlined />} valueStyle={{ color: colors.warning[500] }} />
        </Card>
      </Col>
    </Row>
  );
}
