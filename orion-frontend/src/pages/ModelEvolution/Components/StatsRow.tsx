/**
 * ModelEvolution StatsRow
 * 抽取自 index.tsx (P2-9 Phase 199)
 */
import { Card, Col, Row, Statistic } from 'antd';
import {
  ArrowUpOutlined,
  HistoryOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ModelEntry } from '../types';

interface StatsRowProps {
  models: ModelEntry[];
}

export const StatsRow = ({ models }: StatsRowProps) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card size="small">
        <Statistic title="模型总数" value={models.length} prefix={<RocketOutlined />} />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="活跃模型"
          value={models.filter((m) => m.status === 'stable').length}
          valueStyle={{ color: colors.success[500] }}
          prefix={<ArrowUpOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="灰度中"
          value={models.filter((m) => m.status === 'beta').length}
          valueStyle={{ color: colors.warning[500] }}
          prefix={<ThunderboltOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="供应商"
          value={new Set(models.map((m) => m.provider)).size}
          prefix={<HistoryOutlined />}
        />
      </Card>
    </Col>
  </Row>
);
