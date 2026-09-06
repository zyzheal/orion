/**
 * StatsPanel.tsx - 顶部统计面板
 * 抽取自 VectorStorePage.tsx (P2-9 Phase 93)
 */
import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { DatabaseOutlined, FileTextOutlined, RocketOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { VectorStats } from '@/api/vector-store';

interface StatsPanelProps {
  stats: VectorStats | null;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  if (!stats) return null;
  return (
    <Card size="small" style={{ marginBottom: spacing.md }}>
      <Row gutter={16}>
        <Col span={6}>
          <Statistic
            title="文档总数"
            value={stats.documentCount}
            prefix={<FileTextOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="集合数量"
            value={stats.collectionCount ?? 0}
            prefix={<DatabaseOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="向量嵌入数"
            value={stats.totalEmbeddings ?? 0}
            prefix={<RocketOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic title="平均维度" value={stats.avgDimensions ?? 0} />
        </Col>
      </Row>
    </Card>
  );
};
