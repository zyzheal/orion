/**
 * TenantQuotaPage Active Plan Metrics Card
 * 抽取自 index.tsx (P2-9 Phase 136)
 */
import React from 'react';
import { Card, Row, Col, Typography, Progress } from 'antd';
import { colors, spacing } from '@/tokens';
import type { QuotaPlan, QuotaUsage } from '@/api/tenantQuota';
import { QUOTA_METRICS } from '../constants';

const { Text } = Typography;

interface ActivePlanMetricsCardProps {
  plans: QuotaPlan[];
  usages: QuotaUsage[];
}

export const ActivePlanMetricsCard: React.FC<ActivePlanMetricsCardProps> = ({
  plans,
  usages,
}) => {
  const activePlan = plans.find((p) => p.status === 'active');
  const planMetrics = activePlan
    ? QUOTA_METRICS.map((m) => ({
        ...m,
        limit: (activePlan as any)[m.planField] || 0,
      }))
    : [];
  const usageMap = new Map(usages.map((u) => [u.metric, u]));

  if (planMetrics.length === 0) return null;

  return (
    <Card title="活跃计划用量概览" style={{ marginBottom: spacing.md }}>
      <Row gutter={[spacing.md, spacing.md]}>
        {planMetrics.map((m) => {
          const usage = usageMap.get(m.value);
          const current = usage?.currentValue || 0;
          const limit = m.limit || 1;
          const pct = limit > 0 ? Math.round((current / limit) * 100) : 0;
          const strokeColor =
            pct >= 95
              ? colors.error[500]
              : pct >= 80
                ? colors.warning[500]
                : colors.success[500];
          return (
            <Col span={6} key={m.value}>
              <Card size="small">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {m.label}
                </Text>
                <div style={{ fontSize: 16, fontWeight: 600, margin: '4px 0' }}>
                  {current} / {limit}
                </div>
                <Progress
                  percent={Math.min(pct, 100)}
                  size="small"
                  strokeColor={strokeColor}
                  showInfo={false}
                />
              </Card>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
};
