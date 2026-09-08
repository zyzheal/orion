/**
 * StatsRow.tsx - 模板统计卡片行
 * 抽取自 index.tsx (P2-9 Phase 240)
 */
import { Row, Col, Card, Statistic } from 'antd';
import { FileTextOutlined, StarOutlined, CopyOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

export interface TemplateStats {
  total: number;
  official: number;
  downloads: number;
  stars: number;
}

interface Props {
  stats: TemplateStats;
}

export function StatsRow({ stats }: Props) {
  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Card size="small">
          <Statistic title="模板总数" value={stats.total} prefix={<FileTextOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="官方模板" value={stats.official} prefix={<StarOutlined />} valueStyle={{ color: colors.success[500] }} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="总下载量" value={stats.downloads.toLocaleString()} prefix={<CopyOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="总 Stars" value={stats.stars} prefix={<StarOutlined />} valueStyle={{ color: colors.warning[500] }} />
        </Card>
      </Col>
    </Row>
  );
}
