/**
 * ProblemStatsCards - 问题管理 4 张统计卡（从 index.tsx 抽取）
 */
import React from 'react';
import { Row, Col } from 'antd';
import {
  BugOutlined,
  BookOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import type { ProblemStats } from '@/api/problem';

export interface ProblemStatsCardsProps {
  stats: ProblemStats | null;
}

export const ProblemStatsCards: React.FC<ProblemStatsCardsProps> = ({ stats }) => {
  if (!stats) return null;
  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
      <Col xs={12} sm={6}>
        <MetricCard
          title="问题总数"
          value={stats.total}
          icon={<BugOutlined />}
          color={colors.primary[500]}
        />
      </Col>
      <Col xs={12} sm={6}>
        <MetricCard
          title="已知问题"
          value={stats.byStatus?.known || 0}
          icon={<BookOutlined />}
          color={colors.purple[500]}
        />
      </Col>
      <Col xs={12} sm={6}>
        <MetricCard
          title="调查中"
          value={stats.byStatus?.investigating || 0}
          icon={<SyncOutlined />}
          color={colors.warning[500]}
        />
      </Col>
      <Col xs={12} sm={6}>
        <MetricCard
          title="严重/高级"
          value={(stats.bySeverity?.critical || 0) + (stats.bySeverity?.high || 0)}
          icon={<ExclamationCircleOutlined />}
          color={colors.error[500]}
        />
      </Col>
    </Row>
  );
};
