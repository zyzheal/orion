/**
 * AuditComplianceDashboard Page (Phase 305)
 *
 * Visual compliance dashboard across 5 frameworks (SOC2, ISO27001,
 * PCI-DSS, MLPS2, PDPA). Layout:
 *
 *   PageHeader  →  days selector + refresh button + overall rating banner
 *   ScoreCards  →  5 FrameworkScoreCard components, one per framework
 *   RiskHeatmap →  framework × severity heatmap + triage table
 *   TrendChart  →  overall + per-framework score trend line chart
 *
 * Route registration is intentionally NOT included here — `routes.tsx` is
 * out-of-scope for this phase. Import this component as
 * `AuditComplianceDashboardPage` and register it in the router separately.
 */
import React from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  ReloadOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  CalendarOutlined,
  PieChartOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import PageSkeleton from '@/components/PageSkeleton';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useAuditComplianceState, DAYS_OPTIONS, DEFAULT_DAYS } from './useAuditComplianceState';
import { FrameworkScoreCard } from './Components/FrameworkScoreCard';
import { RiskHeatmap } from './Components/RiskHeatmap';
import { ScoreTrendChart } from './Components/ScoreTrendChart';

const { Title, Text } = Typography;

const RATING_COLOR: Record<string, { color: string; bg: string; label: string }> = {
  compliant: { color: colors.success[700], bg: colors.success[50], label: '合规' },
  partial: { color: colors.warning[700], bg: colors.warning[50], label: '部分合规' },
  'non-compliant': { color: colors.error[700], bg: colors.error[50], label: '不合规' },
};

const AuditComplianceDashboardPage: React.FC = () => {
  const {
    days,
    setDays,
    dashboard,
    riskMap,
    trend,
    loading,
    refetch,
  } = useAuditComplianceState(DEFAULT_DAYS);

  const isInitialLoading = loading && !dashboard;

  if (isInitialLoading) {
    return (
      <DashboardLayout>
        <div style={{ padding: spacing.lg }}>
          <PageSkeleton cards={5} rows={4} />
        </div>
      </DashboardLayout>
    );
  }

  const ratingMeta = RATING_COLOR[dashboard?.overallRating ?? 'partial'] ?? RATING_COLOR.partial;
  const totalControls = dashboard?.totalControls ?? 0;
  const totalPassed = dashboard?.totalPassed ?? 0;
  const totalFailed = dashboard?.totalFailed ?? 0;

  return (
    <DashboardLayout>
      <div style={{ padding: spacing.lg }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Header row: title + overall score + controls */}
          <Card size="small" styles={{ body: { padding: spacing.md } }}>
            <Row gutter={[spacing.lg, spacing.md]} align="middle">
              <Col xs={24} md={8} lg={10}>
                <Space direction="vertical" size={0}>
                  <Title level={4} style={{ margin: 0 }}>
                    <SafetyCertificateOutlined
                      style={{ marginRight: 8, color: colors.primary[500] }}
                    />
                    合规仪表板
                  </Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dashboard?.assessedAt
                      ? `最近评估：${new Date(dashboard.assessedAt).toLocaleString('zh-CN')}`
                      : '尚未评估'}
                  </Text>
                </Space>
              </Col>

              <Col xs={24} md={8} lg={8}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.md,
                    background: ratingMeta.bg,
                    padding: `${spacing.sm} ${spacing.md}`,
                    borderRadius: 6,
                    border: `1px solid ${ratingMeta.color}`,
                  }}
                >
                  <Statistic
                    title="整体合规分"
                    value={dashboard?.overallScore ?? 0}
                    precision={1}
                    valueStyle={{ color: ratingMeta.color, fontSize: 32, fontWeight: 700 }}
                  />
                  <Space direction="vertical" size={0}>
                    <Tag
                      color={ratingMeta.bg}
                      style={{
                        color: ratingMeta.color,
                        borderColor: ratingMeta.color,
                        background: ratingMeta.bg,
                      }}
                    >
                      {ratingMeta.label}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      通过 {totalPassed} / 未通过 {totalFailed}
                      {totalControls > 0 ? ` · 共 ${totalControls} controls` : ''}
                    </Text>
                  </Space>
                </div>
              </Col>

              <Col xs={24} md={8} lg={6} style={{ textAlign: 'right' }}>
                <Space wrap>
                  <Select
                    value={days}
                    options={[...DAYS_OPTIONS]}
                    onChange={setDays}
                    style={{ width: 110 }}
                    suffixIcon={<CalendarOutlined />}
                  />
                  <Button
                    icon={<ReloadOutlined spin={loading} />}
                    onClick={() => refetch()}
                    loading={loading}
                  >
                    刷新
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Framework score cards */}
          <Card
            title={
              <Space>
                <PieChartOutlined />
                <span>框架分数</span>
              </Space>
            }
            size="small"
            loading={loading && !dashboard}
          >
            {dashboard && dashboard.frameworkScores.length > 0 ? (
              <Row gutter={[spacing.md, spacing.md]}>
                {dashboard.frameworkScores.map((fs) => (
                  <Col xs={24} sm={12} md={8} lg={6} xl={4} key={fs.framework}>
                    <FrameworkScoreCard score={fs} />
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty description="暂无框架评分数据" />
            )}
          </Card>

          {/* Risk heatmap + triage table */}
          <Card
            title={
              <Space>
                <WarningOutlined />
                <span>风险分布矩阵</span>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  Framework × Severity
                </Text>
              </Space>
            }
            extra={
              riskMap && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Total findings:{' '}
                  <strong style={{ color: colors.error[600] }}>{riskMap.totalFindings}</strong>
                </Text>
              )
            }
            size="small"
            loading={loading && !riskMap}
          >
            {riskMap && riskMap.frameworkRows.length > 0 ? (
              <RiskHeatmap
                frameworkRows={riskMap.frameworkRows}
                severityBuckets={riskMap.severityBuckets}
                loading={loading}
              />
            ) : (
              <Empty description="暂无风险数据" />
            )}
          </Card>

          {/* Score trend chart */}
          <Card
            title={
              <Space>
                <ThunderboltOutlined />
                <span>合规分数趋势</span>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  近 {days} 天
                </Text>
              </Space>
            }
            size="small"
            loading={loading && !trend}
          >
            <ScoreTrendChart trend={trend} loading={loading} />
          </Card>
        </Space>
      </div>
    </DashboardLayout>
  );
};

export default AuditComplianceDashboardPage;
export { AuditComplianceDashboardPage };
