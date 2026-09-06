/**
 * ReportStatsCard.tsx - API Governance 顶部统计卡
 * 抽取自 ApiGovernancePage.tsx (P2-9 Phase 48)
 * 6 Statistic: Overall Score / Total Contracts / Total Versions / Violations / Deprecated / Compliance
 */
import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import { colors, spacing } from '@/tokens';
import type { GovernanceReport } from '@/api/api-governance';

export interface ReportStatsCardProps {
  report: GovernanceReport | null;
  contractsCount: number;
  versionsCount: number;
  violationsCount: number;
  deprecatedCount: number;
  loading: boolean;
}

export const ReportStatsCard: React.FC<ReportStatsCardProps> = ({
  report,
  contractsCount,
  versionsCount,
  violationsCount,
  deprecatedCount,
  loading,
}) => (
  <Card loading={loading} style={{ marginBottom: spacing.lg }}>
    <Row gutter={16}>
      <Col span={6}>
        <Statistic
          title="Overall Score"
          value={report?.overall_score ?? 0}
          suffix="/ 100"
          valueStyle={
            report?.overall_score ?? 0 >= 80
              ? { color: colors.success[500] }
              : { color: colors.warning[500] }
          }
        />
      </Col>
      <Col span={4}>
        <Statistic title="Total Contracts" value={contractsCount} />
      </Col>
      <Col span={4}>
        <Statistic title="Total Versions" value={versionsCount} />
      </Col>
      <Col span={4}>
        <Statistic
          title="Violations"
          value={violationsCount}
          valueStyle={
            violationsCount > 0 ? { color: colors.error[400] } : { color: colors.success[500] }
          }
        />
      </Col>
      <Col span={4}>
        <Statistic
          title="Deprecated"
          value={deprecatedCount}
          valueStyle={
            deprecatedCount > 0 ? { color: colors.warning[500] } : { color: colors.success[500] }
          }
        />
      </Col>
      <Col span={2}>
        <Statistic
          title="Compliance"
          value={(report?.compliance_rate ?? 0).toFixed(1)}
          suffix="%"
        />
      </Col>
    </Row>
  </Card>
);

export default ReportStatsCard;
