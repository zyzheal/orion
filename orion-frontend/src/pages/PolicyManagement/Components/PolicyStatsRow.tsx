/**
 * PolicyStatsRow - 策略统计卡片行
 * 抽取自 index.tsx (P2-9 Phase 114)
 */
import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { colors, spacing } from '@/tokens';

interface PolicyStatsRowProps {
  total: number;
  enabled: number;
  openViolations: number;
  blockedViolations: number;
}

export const PolicyStatsRow: React.FC<PolicyStatsRowProps> = ({
  total,
  enabled,
  openViolations,
  blockedViolations,
}) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    <Col span={6}>
      <Card>
        <Statistic title="策略总数" value={total} />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="启用中"
          value={enabled}
          valueStyle={{ color: colors.success[600] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="活跃违规"
          value={openViolations}
          valueStyle={{ color: colors.error[600] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="阻断违规"
          value={blockedViolations}
          valueStyle={{ color: colors.error[600] }}
        />
      </Card>
    </Col>
  </Row>
);
