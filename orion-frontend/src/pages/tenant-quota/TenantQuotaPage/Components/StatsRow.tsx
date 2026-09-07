/**
 * TenantQuotaPage Stats Row
 * 抽取自 index.tsx (P2-9 Phase 136)
 */
import React from 'react';
import { Card, Row, Col, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import type { QuotaAlert } from '@/api/tenantQuota';

const { Text } = Typography;

interface StatsRowProps {
  plansCount: number;
  usagesCount: number;
  alerts: QuotaAlert[];
}

export const StatsRow: React.FC<StatsRowProps> = ({ plansCount, usagesCount, alerts }) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card>
        <Text type="secondary">配额计划数</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>
          {plansCount}
        </div>
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Text type="secondary">活跃用量指标</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.info[500] }}>
          {usagesCount}
        </div>
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Text type="secondary">告警数</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.warning[500] }}>
          {alerts.length}
        </div>
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Text type="secondary">严重告警</Text>
        <div style={{ fontSize: 24, fontWeight: 600, color: colors.error[500] }}>
          {alerts.filter((a) => a.alertLevel === 'critical').length}
        </div>
      </Card>
    </Col>
  </Row>
);
