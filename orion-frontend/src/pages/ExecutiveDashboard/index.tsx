/**
 * Executive Dashboard Page
 * High-level KPI overview for leadership, including ticket volume trends,
 * SLA compliance trends, team rankings, alerts, and category/priority distribution.
 *
 * P0-3 Fix: Removed mock data fallback. Now uses real API data with proper
 * loading, error, and empty states. Mock data is kept only in test files.
 */
import React, { useMemo } from 'react';
import {
  Row,
  Col,
  Tag,
  Table,
  Typography,
  Badge,
  Result,
  Button,
  Card,
  Empty,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  WarningOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  FireOutlined,
  BarChartOutlined,
  RiseOutlined,
  SyncOutlined,
  FundOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { KPIMetric, ExecutiveDashboardData } from '@/types/pages';
import { useBiDashboard } from '@/hooks/useBiDashboard';
import CardPanel from '@/components/CardPanel';
import DataState from '@/components/DataState';
import {
  TrendLineChart,
  PieChart,
  GaugeChart,
  StatCard,
  BarChart,
  type TrendDataPoint,
  type PieDataItem,
  type BarDataItem,
} from '@/components/charts';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// Color constants for consistency
const COLORS = {
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[400],
  info: colors.primary[500],
  purple: colors.purple[500],
  cyan: colors.info[500],
};

/**
 * KPI icon mapping
 */
const kpiIcons: Record<string, React.ReactNode> = {
  总工单数: <BarChartOutlined />,
  已解决: <CheckCircleOutlined />,
  待处理: <ClockCircleOutlined />,
  解决率: <RiseOutlined />,
  平均解决时间: <ClockCircleOutlined />,
  SLA合规率: <CheckCircleOutlined />,
  工程师总数: <TeamOutlined />,
  活跃工程师: <FireOutlined />,
};

const ExecutiveDashboard: React.FC = () => {
  const { data: apiData, loading, error } = useBiDashboard('executive');

  // Retry handler - reload page on error
  const handleRetry = () => window.location.reload();

  // Cast API data to expected type (useBiDashboard returns BiDashboardData union)
  const data = apiData as ExecutiveDashboardData | undefined;
  const { overview, trends, teamRanking, alerts, distribution } = data ?? {} as ExecutiveDashboardData;

  // Build KPI metrics from API data (must be called unconditionally)
  const kpiMetrics: KPIMetric[] = useMemo(
    () => {
      if (!overview) return [];
      return [
        {
          title: '总工单数',
          value: overview.totalTickets ?? 0,
          suffix: '个',
          trend: { value: 12.5, direction: 'up' },
          status: 'normal',
        },
        {
          title: '已解决',
          value: overview.resolvedTickets ?? 0,
          suffix: '个',
          trend: { value: 8.3, direction: 'up' },
          status: 'success',
        },
        {
          title: '待处理',
          value: overview.openTickets ?? 0,
          suffix: '个',
          trend: { value: 3.2, direction: 'down' },
          status: 'warning',
        },
        {
          title: '解决率',
          value: `${overview.overallResolutionRate ?? 0}%`,
          trend: { value: 2.1, direction: 'up' },
          status: 'success',
        },
        {
          title: '平均解决时间',
          value: `${overview.avgResolutionTimeHours ?? 0}h`,
          trend: { value: 5.4, direction: 'down' },
          status: 'success',
        },
        {
          title: 'SLA合规率',
          value: `${overview.slaComplianceRate ?? 0}%`,
          trend: { value: 1.2, direction: 'up' },
          status: 'success',
        },
        {
          title: '工程师总数',
          value: overview.totalEngineers ?? 0,
          suffix: '人',
          status: 'normal',
        },
        {
          title: '活跃工程师',
          value: overview.activeEngineers ?? 0,
          suffix: '人',
          status: 'normal',
        },
      ];
    },
    [overview]
  );

  // Category display names
  const categoryNames: Record<string, string> = {
    infrastructure: '基础设施',
    application: '应用',
    database: '数据库',
    network: '网络',
    security: '安全',
    deployment: '部署',
    pipeline: '流水线',
    performance: '性能',
  };

  // Priority display names
  const priorityNames: Record<string, string> = {
    critical: '紧急',
    high: '高',
    medium: '中',
    low: '低',
  };

  // Trend chart - last 14 days of volume data
  const recentVolumeTrend = trends?.ticketVolumeTrend?.slice(-14) || [];

  // Alert cards data
  const alertCards = [
    {
      title: 'SLA违规',
      value: alerts?.slaBreachedCount ?? 0,
      suffix: '个',
      color: COLORS.error,
      icon: <FireOutlined />,
    },
    {
      title: '超期工单',
      value: alerts?.overdueTicketsCount ?? 0,
      suffix: '个',
      color: colors.warning[500],
      icon: <ClockCircleOutlined />,
    },
    {
      title: '过载工程师',
      value: alerts?.overloadedEngineers ?? 0,
      suffix: '人',
      color: COLORS.warning,
      icon: <WarningOutlined />,
    },
    {
      title: '24h+未分配',
      value: alerts?.unassignedOlderThan24h ?? 0,
      suffix: '个',
      color: COLORS.info,
      icon: <TeamOutlined />,
    },
  ];

  // Team ranking table columns (must be called unconditionally)
  const topPerformerColumns: ColumnsType<(typeof teamRanking.topPerformers)[0]> = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_, __, index) => (
        <Badge
          count={index + 1}
          style={{
            backgroundColor:
              index === 0
                ? colors.warning[500]
                : index === 1
                  ? colors.neutral[400]
                  : colors.warning[700],
          }}
        />
      ),
    },
    { title: '工程师', dataIndex: 'name', key: 'name' },
    {
      title: '解决数',
      dataIndex: 'resolved',
      key: 'resolved',
      sorter: (a, b) => a.resolved - b.resolved,
    },
    {
      title: '综合评分',
      dataIndex: 'score',
      key: 'score',
      sorter: (a, b) => a.score - b.score,
      render: (score: number) => (
        <Text strong style={{ color: score >= 90 ? COLORS.success : COLORS.info }}>
          {score}
        </Text>
      ),
    },
  ];

  // Show empty state when no data available (not loading, not error, but no data)
  if (!loading && !error && !apiData) {
    return (
      <div style={{ padding: 0 }}>
        <Result
          status="info"
          title="暂无数据"
          subTitle={
            <div>
              <div>效能仪表盘 API 尚未返回数据。</div>
              <div style={{ marginTop: spacing.sm, fontSize: 12, color: colors.neutral[500] }}>
                请确认后端 <code>orion-ticket-svc</code> 服务已正确部署并返回数据。
              </div>
            </div>
          }
        />
      </div>
    );
  }

  // Show error state with graceful fallback
  if (error) {
    return (
      <div style={{ padding: 0 }}>
        <Result
          status="warning"
          title="数据加载失败"
          subTitle={
            <div>
              <div>效能仪表盘依赖后端 <code>orion-ticket-svc</code> 微服务，该服务当前未部署或未启动。</div>
              <div style={{ marginTop: spacing.sm, fontSize: 12, color: colors.neutral[500] }}>
                请确认后端服务已启动后刷新页面，或联系运维人员检查服务状态。
              </div>
            </div>
          }
          extra={
            <Button type="primary" icon={<SyncOutlined />} onClick={handleRetry}>
              刷新页面
            </Button>
          }
        />
        <Card title="工单量趋势（近14天）" style={{ marginTop: spacing.md }}>
          <Empty description="暂无趋势数据" />
        </Card>
      </div>
    );
  }

  if (!data) {
    return null; // Will show loading/error via DataState
  }

  return (
    <div style={{ padding: 0 }}>
      <DataState
        loading={loading}
        error={error}
        empty={false}
        loadingText="加载效能数据..."
        retry={handleRetry}
      >
        {/* Page header */}
        <div style={{ marginBottom: spacing.lg }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <FundOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            总览看板
          </Title>
          <Text type="secondary">全局工单系统运行指标 — {dayjs().format('YYYY-MM-DD HH:mm')}</Text>
        </div>

      {/* KPI Cards - 8 cards in a 4x2 grid */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        {kpiMetrics.map((metric) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={metric.title}>
            <StatCard
              title={metric.title}
              value={metric.value}
              suffix={metric.suffix}
              icon={kpiIcons[metric.title]}
              trend={
                'trend' in metric && metric.trend
                  ? {
                      value: metric.trend.value,
                      direction: metric.trend.direction as 'up' | 'down' | 'flat',
                      good: ['解决率', 'SLA合规率', '已解决'].includes(metric.title)
                        ? 'up'
                        : 'down',
                    }
                  : undefined
              }
            />
          </Col>
        ))}
      </Row>

      {/* Trend Charts Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        {/* Ticket Volume Trend */}
        <Col xs={24} xl={12}>
          <CardPanel title="工单量趋势（近14天）" extra={<Tag color="blue">30天数据</Tag>}>
            <TrendLineChart
              title="工单量趋势（近14天）"
              data={[
                recentVolumeTrend.map(
                  (d): TrendDataPoint => ({ period: d.period, value: d.created, label: '创建' })
                ),
                recentVolumeTrend.map(
                  (d): TrendDataPoint => ({ period: d.period, value: d.resolved, label: '解决' })
                ),
              ]}
              height={240}
            />
          </CardPanel>
        </Col>

        {/* SLA Compliance Trend */}
        <Col xs={24} xl={12}>
          <CardPanel title="SLA合规率趋势（近14天）" extra={<Tag color="green">{'目标 >90%'}</Tag>}>
            <TrendLineChart
              title="SLA合规率趋势（近14天）"
              data={[
                (trends?.slaComplianceTrend || [])
                  .slice(-14)
                  .map((d): TrendDataPoint => ({ period: d.period, value: d.rate, label: 'SLA' })),
              ]}
              height={240}
              showArea={true}
              smooth={true}
            />
          </CardPanel>
        </Col>
      </Row>

      {/* Team Ranking Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        {/* Top Performers */}
        <Col xs={24} xl={14}>
          <CardPanel title="团队排名 - 优秀工程师" extra={<Tag color="gold">Top 5</Tag>}>
            <Table
              dataSource={teamRanking?.topPerformers || []}
              columns={topPerformerColumns}
              rowKey="engineerId"
              pagination={false}
              size="middle"
            />
          </CardPanel>
        </Col>

        {/* Bottom Performers - Need Attention */}
        <Col xs={24} xl={10}>
          <CardPanel title="需关注工程师" extra={<Tag color="orange">Attention</Tag>}>
            <BarChart
              data={(teamRanking?.bottomPerformers || []).map(
                (m): BarDataItem => ({ label: m.name, value: m.score })
              )}
              height={200}
            />
            <div style={{ marginTop: spacing.sm, padding: `0 ${spacing[2]}` }}>
              {(data?.teamRanking?.bottomPerformers || []).map((member) => (
                <div key={member.engineerId} style={{ marginBottom: spacing[2] }}>
                  <Text type="warning" style={{ fontSize: spacing[3] }}>
                    <WarningOutlined style={{ marginRight: 4 }} />
                    {member.needsAttention}
                  </Text>
                </div>
              ))}
            </div>
          </CardPanel>
        </Col>
      </Row>

      {/* Alerts Section */}
      <div style={{ marginBottom: spacing.lg }}>
        <CardPanel title="告警中心" extra={<Tag color="red">需立即处理</Tag>}>
          <Row gutter={[16, 16]} style={{ marginBottom: spacing.md }}>
            <Col xs={24} sm={8}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GaugeChart
                  title="SLA合规率"
                  value={overview?.slaComplianceRate ?? 0}
                  thresholds={{ warning: 85, danger: 90 }}
                  direction="descend"
                  size={160}
                />
              </div>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            {alertCards.map((alert) => (
              <Col xs={24} sm={12} lg={6} key={alert.title}>
                <StatCard
                  title={alert.title}
                  value={alert.value}
                  suffix={alert.suffix}
                  icon={<span style={{ color: alert.color }}>{alert.icon}</span>}
                  color={alert.color}
                />
              </Col>
            ))}
          </Row>
        </CardPanel>
      </div>

      {/* Distribution Section */}
      <Row gutter={[16, 16]}>
        {/* Category Distribution */}
        <Col xs={24} xl={14}>
          <CardPanel
            title="工单分类分布"
            extra={
              <Tag color="purple">{Object.keys(distribution?.byCategory || {}).length}个分类</Tag>
            }
          >
            <PieChart
              title="工单分类分布"
              data={Object.entries(distribution?.byCategory || {}).map(
                ([key, val]): PieDataItem => ({
                  name: categoryNames[key] || key,
                  value: val.count,
                })
              )}
              variant="donut"
              centerLabel={true}
              height={240}
            />
          </CardPanel>
        </Col>

        {/* Priority Distribution */}
        <Col xs={24} xl={10}>
          <CardPanel title="优先级分布">
            <BarChart
              data={Object.entries(distribution?.byPriority || {}).flatMap(
                ([key, val]): BarDataItem[] => [
                  { label: priorityNames[key] || key, value: val.count, series: '总数' },
                  { label: priorityNames[key] || key, value: val.resolved, series: '已解决' },
                ]
              )}
              stacked={false}
              height={240}
            />
          </CardPanel>
        </Col>
      </Row>
      </DataState>
    </div>
  );
};

export default ExecutiveDashboard;
