/**
 * PromptCanary StatsRow
 * 抽取自 index.tsx (P2-9 Phase 183)
 */
import { Row, Col, Card, Statistic } from 'antd';
import { PlusOutlined, ThunderboltOutlined, CodeOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { PromptCanaryStatus } from '../types';

interface StatsRowProps {
  statuses: PromptCanaryStatus[];
}

export const StatsRow = ({ statuses }: StatsRowProps) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card size="small">
        <Statistic title="Prompt 数量" value={statuses.length} prefix={<CodeOutlined />} />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="活跃 Canary"
          value={statuses.filter((s) => s.canary_version).length}
          valueStyle={{ color: colors.purple[500] }}
          prefix={<ThunderboltOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="版本总数"
          value={statuses.reduce((sum, s) => sum + (s.versions?.length || 0), 0)}
          prefix={<PlusOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="平均灰度流量"
          value={
            statuses.length > 0
              ? `${(statuses.reduce((sum, s) => sum + (s.traffic_percent || 0), 0) / statuses.length).toFixed(0)}%`
              : '0%'
          }
          valueStyle={{ color: colors.success[500] }}
        />
      </Card>
    </Col>
  </Row>
);
