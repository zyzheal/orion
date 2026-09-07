/**
 * DORAMetricsTab.tsx - DORA 指标 Tab
 * 抽取自 efficiency/EfficiencyPage.tsx (P2-9 Phase 76)
 */
import React, { useEffect } from 'react';
import { Typography, Card, Button, message, Row, Col, Statistic, Progress, Tag } from 'antd';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@/providers/QueryProvider';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { getDoraBenchmarks, getEfficiencyDashboard } from '@/api/efficiency';

const { Text } = Typography;

type DashboardData = {
  dora?: {
    deploymentFrequency?: string | number;
    leadTime?: number;
    mttr?: number;
    changeFailureRate?: number;
  };
  summary?: {
    totalDeployments?: number;
    successfulDeployments?: number;
    failedDeployments?: number;
  };
} | null;

type Benchmarks = {
  deploymentFrequency?: { elite?: string; high?: string; medium?: string; low?: string };
  leadTimeForChanges?: { elite?: string; high?: string; medium?: string; low?: string };
  changeFailureRate?: { elite?: string; high?: string; medium?: string; low?: string };
  meanTimeToRecovery?: { elite?: string; high?: string; medium?: string; low?: string };
} | null;

const DORAMetricsTab: React.FC = () => {
  const {
    data: data = {} as { dashboardData: DashboardData; benchmarks: Benchmarks },
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery<{ dashboardData: DashboardData; benchmarks: Benchmarks }>({
    queryKey: ['efficiency-dora-metrics'],
    queryFn: async () => {
      const [dashboardRes, benchmarksRes] = await Promise.all([
        getEfficiencyDashboard(),
        getDoraBenchmarks(),
      ]);
      // Response wraps in { dashboard: {...} }
      return {
        dashboardData: (dashboardRes.data as any)?.dashboard || dashboardRes.data || null,
        benchmarks: benchmarksRes.data || null,
      };
    },
    staleTime: 30_000,
  });

  const { dashboardData, benchmarks } = data;

  // 错误反馈
  useEffect(() => {
    if (!isError) return;
    message.error(`加载 DORA 指标失败: ${(error as Error)?.message}`);
  }, [isError, error]);

  const getLevel = (value: number | undefined, metricKey: string): string => {
    if (!value || !benchmarks) return '-';
    const category = benchmarks[metricKey as keyof typeof benchmarks];
    if (!category) return '-';
    // Simplified: lower is better for time/rate, higher is better for frequency
    if (metricKey === 'deploymentFrequency') {
      return value >= 5 ? 'Elite' : value >= 2 ? 'High' : value >= 1 ? 'Medium' : 'Low';
    } else {
      return value <= 60 ? 'Elite' : value <= 240 ? 'High' : value <= 720 ? 'Medium' : 'Low';
    }
  };

  const levelColorMap: Record<string, string> = {
    Elite: colors.success[500],
    High: colors.primary[500],
    Medium: colors.warning[500],
    Low: colors.error[400],
  };

  const dora = dashboardData?.dora || {};

  return (
    <div>
      <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">DORA 四大核心指标</Text>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Metric Cards */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="发布频率"
              value={dora.deploymentFrequency || 0}
              suffix="次/周"
              prefix={<ThunderboltOutlined />}
            />
            <div style={{ marginTop: spacing.sm }}>
              <Tag
                color={
                  levelColorMap[
                    getLevel(
                      typeof dora.deploymentFrequency === 'string'
                        ? parseFloat(dora.deploymentFrequency)
                        : dora.deploymentFrequency,
                      'deploymentFrequency'
                    )
                  ]
                }
              >
                {getLevel(
                  typeof dora.deploymentFrequency === 'string'
                    ? parseFloat(dora.deploymentFrequency)
                    : dora.deploymentFrequency,
                  'deploymentFrequency'
                )}
              </Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="变更前置时间"
              value={dora.leadTime || 0}
              suffix="小时"
              prefix={<ClockCircleOutlined />}
              valueStyle={{
                color: (dora.leadTime || 0) <= 24 ? colors.success[500] : colors.warning[500],
              }}
            />
            <div style={{ marginTop: spacing.sm }}>
              <Tag color={levelColorMap[getLevel(dora.leadTime, 'leadTimeForChanges')]}>
                {getLevel(dora.leadTime, 'leadTimeForChanges')}
              </Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="服务恢复时间"
              value={dora.mttr || 0}
              suffix="分钟"
              prefix={<CheckCircleOutlined />}
              valueStyle={{
                color: (dora.mttr || 0) <= 60 ? colors.success[500] : colors.error[400],
              }}
            />
            <div style={{ marginTop: spacing.sm }}>
              <Tag color={levelColorMap[getLevel(dora.mttr, 'meanTimeToRecovery')]}>
                {getLevel(dora.mttr, 'meanTimeToRecovery')}
              </Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="变更失败率"
              value={dora.changeFailureRate || 0}
              suffix="%"
              prefix={<WarningOutlined />}
              valueStyle={{
                color: (dora.changeFailureRate || 0) <= 5 ? colors.success[500] : colors.error[400],
              }}
            />
            <div style={{ marginTop: spacing.sm }}>
              <Tag color={levelColorMap[getLevel(dora.changeFailureRate, 'changeFailureRate')]}>
                {getLevel(dora.changeFailureRate, 'changeFailureRate')}
              </Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Summary */}
      {dashboardData?.summary && (
        <Card title="部署汇总">
          <Row gutter={16}>
            <Col span={8}>
              <Statistic title="总部署次数" value={dashboardData.summary.totalDeployments || 0} />
            </Col>
            <Col span={8}>
              <Statistic
                title="成功部署"
                value={dashboardData.summary.successfulDeployments || 0}
                valueStyle={{ color: colors.success[500] }}
                prefix={<CheckCircleOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="失败部署"
                value={dashboardData.summary.failedDeployments || 0}
                valueStyle={{ color: colors.error[400] }}
                prefix={<WarningOutlined />}
              />
            </Col>
          </Row>
          {dashboardData.summary.totalDeployments && dashboardData.summary.totalDeployments > 0 && (
            <div style={{ marginTop: spacing.md }}>
              <Text type="secondary">成功率: </Text>
              <Progress
                percent={Math.round(
                  ((dashboardData.summary.successfulDeployments || 0) /
                    dashboardData.summary.totalDeployments) *
                    100
                )}
                strokeColor={colors.success[500]}
                style={{ width: 300 }}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default DORAMetricsTab;
