import { Card, Row, Col, Statistic } from 'antd';
import { FileTextOutlined, DatabaseOutlined, RocketOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { VectorStats } from '@/api/vector-store';

interface Props {
  stats: VectorStats | null;
}

export function StatsPanel({ stats }: Props) {
  if (!stats) return null;
  return (
    <Card size="small" style={{ marginBottom: spacing.md }}>
      <Row gutter={16}>
        <Col span={6}>
          <Statistic title="文档总数" value={stats.documentCount} prefix={<FileTextOutlined />} />
        </Col>
        <Col span={6}>
          <Statistic title="集合数量" value={stats.collectionCount ?? 0} prefix={<DatabaseOutlined />} />
        </Col>
        <Col span={6}>
          <Statistic title="向量嵌入数" value={stats.totalEmbeddings ?? 0} prefix={<RocketOutlined />} />
        </Col>
        <Col span={6}>
          <Statistic title="平均维度" value={stats.avgDimensions ?? 0} />
        </Col>
      </Row>
    </Card>
  );
}
