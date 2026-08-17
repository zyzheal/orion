/**
 * Artifact Stats Panel - Statistics cards for artifact management
 */
import React from 'react';
import { Statistic, Row, Col, Card } from 'antd';
import { FileTextOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import type { ArtifactStats } from '@/api/artifacts';
import { spacing } from '@/tokens';

const formatSize = (bytes: number): string => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

interface ArtifactStatsProps {
  stats: ArtifactStats;
}

const ArtifactStats: React.FC<ArtifactStatsProps> = ({ stats }) => (
  <Card size="small" style={{ marginBottom: spacing.md }}>
    <Row gutter={16}>
      <Col span={4}>
        <Statistic title="制品总数" value={stats.total} prefix={<FileTextOutlined />} />
      </Col>
      <Col span={3}>
        <Statistic
          title="Snapshot"
          value={stats.byStage?.snapshot ?? 0}
          valueStyle={{ color: colors.neutral[500], fontSize: 20 }}
        />
      </Col>
      <Col span={3}>
        <Statistic
          title="RC"
          value={stats.byStage?.release_candidate ?? 0}
          valueStyle={{ color: colors.primary[500], fontSize: 20 }}
        />
      </Col>
      <Col span={3}>
        <Statistic
          title="Stable"
          value={stats.byStage?.stable ?? 0}
          valueStyle={{ color: colors.success[500], fontSize: 20 }}
        />
      </Col>
      <Col span={3}>
        <Statistic
          title="Production"
          value={stats.byStage?.production ?? 0}
          valueStyle={{ color: colors.warning[500], fontSize: 20 }}
        />
      </Col>
      <Col span={3}>
        <Statistic
          title="Archived"
          value={stats.byStage?.archived ?? 0}
          valueStyle={{ color: colors.warning[500], fontSize: 20 }}
        />
      </Col>
      <Col span={3}>
        <Statistic
          title="总大小"
          value={formatSize(stats.totalSizeBytes || 0)}
          valueStyle={{ fontSize: 16 }}
          prefix={<ClockCircleOutlined />}
        />
      </Col>
    </Row>
  </Card>
);

export default ArtifactStats;
