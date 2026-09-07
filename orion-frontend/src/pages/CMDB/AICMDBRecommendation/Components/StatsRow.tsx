/**
 * AICMDBRecommendation stats row
 * 抽取自 index.tsx (P2-9 Phase 139)
 */
import React from 'react';
import { Row, Col } from 'antd';
import {
  RocketOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { StatCard } from '@/components/charts';

interface StatsRowProps {
  totalRecs: number;
  pendingCount: number;
  anomalyCount: number;
  avgAccuracy: number;
}

export const StatsRow: React.FC<StatsRowProps> = ({
  totalRecs,
  pendingCount,
  anomalyCount,
  avgAccuracy,
}) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <StatCard
        title="智能推荐数"
        value={totalRecs}
        icon={<RocketOutlined />}
        color={colors.purple[500]}
      />
    </Col>
    <Col span={6}>
      <StatCard
        title="待确认"
        value={pendingCount}
        icon={<CloudServerOutlined />}
        color={colors.info[500]}
      />
    </Col>
    <Col span={6}>
      <StatCard
        title="异常检测结果"
        value={anomalyCount}
        icon={<ThunderboltOutlined />}
        color={colors.warning[500]}
      />
    </Col>
    <Col span={6}>
      <StatCard
        title="推荐准确率"
        value={avgAccuracy}
        suffix="%"
        icon={<CheckCircleOutlined />}
        color={colors.success[500]}
      />
    </Col>
  </Row>
);
