/**
 * StatsRow.tsx - 组件统计卡片行
 * 抽取自 index.tsx (P2-9 Phase 241)
 */
import { Row, Col, Card, Statistic } from 'antd';
import { AppstoreOutlined, RocketOutlined, StarOutlined, HeartOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

export interface DevStats {
  total: number;
  services: number;
  libraries: number;
}

interface Props {
  stats: DevStats;
  avgHealth: number;
}

export function StatsRow({ stats, avgHealth }: Props) {
  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Card size="small">
          <Statistic title="组件总数" value={stats.total} prefix={<AppstoreOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="服务数" value={stats.services} prefix={<RocketOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="库数" value={stats.libraries} prefix={<StarOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic
            title="平均健康度"
            value={avgHealth}
            suffix="%"
            prefix={<HeartOutlined />}
            valueStyle={{ color: avgHealth >= 90 ? colors.success[500] : colors.warning[500] }}
          />
        </Card>
      </Col>
    </Row>
  );
}
