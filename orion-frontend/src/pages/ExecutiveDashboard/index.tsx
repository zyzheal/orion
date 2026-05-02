/**
 * Executive Dashboard Page
 * High-level KPI overview for leadership, including ticket volume trends,
 * SLA compliance trends, team rankings, alerts, and category/priority distribution.
 *
 * Uses mock data initially; real API integration will be added later.
 */
import React, { useMemo } from 'react';
import {
  Row,
  Col,
  Tag,
  Table,
  Typography,
  Badge,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  TrophyOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  FireOutlined,
  BarChartOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { KPIMetric, ExecutiveDashboardData } from '@/types/pages';
import { mockExecutiveDashboard } from '@/pages/__mocks__/mockBIData';
import { useBiDashboard } from '@/hooks/useBiDashboard';
import { Spin, Alert } from 'antd';
import CardPanel from '@/components/CardPanel';
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

  // Fallback to mock data when API is unavailable
  const data = (apiData as ExecutiveDashboardData | undefined) ?? mockExecutiveDashboard;
  const showMockWarning = !apiData;

  // Build KPI metrics from mock data
  const kpiMetrics: KPIMetric[] = useMemo(
    () => [
      {
        title: '总工单数',
        value: data.overview.totalTickets,
        suffix: '个',
        trend: { value: 12.5, direction: 'up' },
        status: 'normal',
      },
      {
        title: '已解决',
        value: data.overview.resolvedTickets,
        suffix: '个',
        trend: { value: 8.3, direction: 'up' },
        status: 'success',
      },
      {
        title: '待处理',
        value: data.overview.openTickets,
        suffix: '个',
        trend: { value: 3.2, direction: 'down' },
        status: 'warning',
      },
      {
        title: '解决率',
        value: `${data.overview.overallResolutionRate}%`,
        trend: { value: 2.1, direction: 'up' },
        status: 'success',
      },
      {
        title: '平均解决时间',
        value: `${data.overview.avgResolutionTimeHours}h`,
        trend: { value: 5.4, direction: 'down' },
        status: 'success',
      },
      {
        title: 'SLA合规率',
        value: `${data.overview.slaComplianceRate}%`,
        trend: { value: 1.2, direction: 'up' },
        status: 'success',
      },
      {
        title: '工程师总数',
        value: data.overview.totalEngineers,
        suffix: '人',
        status: 'normal',
      },
      {
        title: '活跃工程师',
        value: data.overview.activeEngineers,
        suffix: '人',
        status: 'normal',
      },
    ],
    [data]
  );

  // Team ranking table columns
  const topPerformerColumns: ColumnsType<(typeof data.teamRanking.topPerformers)[0]> = [
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

  // Alert cards data
  const alertCards = [
    {
      title: 'SLA违规',
      value: data.alerts.slaBreachedCount,
      suffix: '个',
      color: COLORS.error,
      icon: <FireOutlined />,
    },
    {
      title: '超期工单',
      value: data.alerts.overdueTicketsCount,
      suffix: '个',
      color: colors.warning[500],
      icon: <ClockCircleOutlined />,
    },
    {
      title: '过载工程师',
      value: data.alerts.overloadedEngineers,
      suffix: '人',
      color: COLORS.warning,
      icon: <WarningOutlined />,
    },
    {
      title: '24h+未分配',
      value: data.alerts.unassignedOlderThan24h,
      suffix: '个',
      color: COLORS.info,
      icon: <TeamOutlined />,
    },
  ];

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
  const recentVolumeTrend = data.trends.ticketVolumeTrend.slice(-14);

  return (
    <div style={{ padding: 0 }}>
      {/* Loading state */}
      {loading && !apiData && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin tip="加载效能数据..." size="large" />
        </div>
      )}
      {/* Mock data warning */}
      {showMockWarning && (
        <Alert
          message="API 不可用"
          description="效能仪表盘 API 尚未部署，当前显示模拟数据。"
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}
      {/* Error state */}
      {error && (
        <Alert
          message="加载失败"
          description={error.message}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <TrophyOutlined style={{ marginRight: 8, color: COLORS.warning }} />
          总览看板
        </Title>
        <Text type="secondary">全局工单系统运行指标 — {dayjs().format('YYYY-MM-DD HH:mm')}</Text>
      </div>

      {/* KPI Cards - 8 cards in a 4x2 grid */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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
                data.trends.slaComplianceTrend
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
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Top Performers */}
        <Col xs={24} xl={14}>
          <CardPanel title="团队排名 - 优秀工程师" extra={<Tag color="gold">Top 5</Tag>}>
            <Table
              dataSource={data.teamRanking.topPerformers}
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
              data={data.teamRanking.bottomPerformers.map(
                (m): BarDataItem => ({ label: m.name, value: m.score })
              )}
              height={200}
            />
            <div style={{ marginTop: 8, padding: `0 ${spacing[2]}` }}>
              {data.teamRanking.bottomPerformers.map((member) => (
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
      <div style={{ marginBottom: 24 }}>
        <CardPanel title="告警中心" extra={<Tag color="red">需立即处理</Tag>}>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GaugeChart
                  title="SLA合规率"
                  value={data.overview.slaComplianceRate}
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
              <Tag color="purple">{Object.keys(data.distribution.byCategory).length}个分类</Tag>
            }
          >
            <PieChart
              title="工单分类分布"
              data={Object.entries(data.distribution.byCategory).map(
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
              data={Object.entries(data.distribution.byPriority).flatMap(
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
    </div>
  );
};

export default ExecutiveDashboard;
