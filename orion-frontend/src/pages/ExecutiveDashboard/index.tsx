/**
 * Executive Dashboard Page
 * High-level KPI overview for leadership, including ticket volume trends,
 * SLA compliance trends, team rankings, alerts, and category/priority distribution.
 *
 * Uses mock data initially; real API integration will be added later.
 */
import React, { useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Progress,
  Table,
  Typography,
  Space,
  Divider,
  Badge,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  RiseOutlined,
  FallOutlined,
  TrophyOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  FireOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { KPIMetric } from '@/types/pages';
import { mockExecutiveDashboard } from '@/pages/__mocks__/mockBIData';
import CardPanel from '@/components/CardPanel';
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
 * Simple bar visualization using div elements
 */
const SimpleBar: React.FC<{
  value: number;
  max: number;
  color: string;
  width?: number;
}> = ({ value, max, color, width = 120 }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      style={{
        width,
        height: 8,
        backgroundColor: colors.light.border.light,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.min(percentage, 100)}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: 4,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
};

/**
 * KPI icon mapping
 */
const kpiIcons: Record<string, React.ReactNode> = {
  '总工单数': <BarChartOutlined />,
  '已解决': <CheckCircleOutlined />,
  '待处理': <ClockCircleOutlined />,
  '解决率': <RiseOutlined />,
  '平均解决时间': <ClockCircleOutlined />,
  'SLA合规率': <CheckCircleOutlined />,
  '工程师总数': <TeamOutlined />,
  '活跃工程师': <FireOutlined />,
};

const ExecutiveDashboard: React.FC = () => {
  const data = mockExecutiveDashboard;

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

  // KPI card color mapping
  const kpiColors: Record<string, string> = {
    '总工单数': COLORS.info,
    '已解决': COLORS.success,
    '待处理': COLORS.warning,
    '解决率': COLORS.success,
    '平均解决时间': COLORS.cyan,
    'SLA合规率': COLORS.success,
    '工程师总数': COLORS.purple,
    '活跃工程师': COLORS.info,
  };

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
            backgroundColor: index === 0 ? colors.warning[500] : index === 1 ? colors.neutral[400] : colors.warning[700],
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
        <Space>
          <SimpleBar value={score} max={100} color={score >= 90 ? COLORS.success : COLORS.info} />
          <Text strong style={{ color: score >= 90 ? COLORS.success : COLORS.info }}>
            {score}
          </Text>
        </Space>
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

  // Category distribution - find max count for bar scaling
  const maxCategoryCount = useMemo(
    () => Math.max(...Object.values(data.distribution.byCategory).map((c) => c.count)),
    [data]
  );

  // Priority color mapping
  const priorityColors: Record<string, string> = {
    critical: COLORS.error,
    high: colors.warning[500],
    medium: COLORS.warning,
    low: COLORS.info,
  };

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
  const maxVolume = Math.max(...recentVolumeTrend.map((d) => Math.max(d.created, d.resolved)), 1);

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <TrophyOutlined style={{ marginRight: 8, color: COLORS.warning }} />
          总览看板
        </Title>
        <Text type="secondary">
          全局工单系统运行指标 — {dayjs().format('YYYY-MM-DD HH:mm')}
        </Text>
      </div>

      {/* KPI Cards - 8 cards in a 4x2 grid */}
      <div style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {kpiMetrics.map((metric) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={metric.title}>
              <CardPanel>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        backgroundColor: `${kpiColors[metric.title]}15`,
                        color: kpiColors[metric.title],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: spacing[5],
                      }}
                    >
                      {kpiIcons[metric.title]}
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: spacing[3] }}>
                        {metric.title}
                      </Text>
                      <div style={{ fontSize: spacing[6], fontWeight: 600, lineHeight: 1.2 }}>
                        {metric.value}
                        {metric.suffix && (
                          <Text type="secondary" style={{ fontSize: spacing[4], marginLeft: 4 }}>
                            {metric.suffix}
                          </Text>
                        )}
                      </div>
                      {metric.trend && (
                        <Text
                          style={{
                            fontSize: spacing[3],
                            color:
                              metric.trend.direction === 'up' ? COLORS.success : COLORS.warning,
                          }}
                        >
                          {metric.trend.direction === 'up' ? (
                            <RiseOutlined />
                          ) : (
                            <FallOutlined />
                          )}{' '}
                          {metric.trend.value}%
                        </Text>
                      )}
                    </div>
                  </div>
                </div>
              </CardPanel>
            </Col>
          ))}
        </Row>
      </div>

      {/* Trend Charts Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Ticket Volume Trend */}
        <Col xs={24} xl={12}>
          <CardPanel title="工单量趋势（近14天）" extra={<Tag color="blue">30天数据</Tag>}>
            <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 8px' }}>
              {recentVolumeTrend.map((d, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 160 }}>
                    <div
                      style={{
                        width: 10,
                        height: `${(d.created / maxVolume) * 100}%`,
                        backgroundColor: COLORS.info,
                        borderRadius: '4px 4px 0 0',
                        opacity: 0.8,
                        minWidth: 6,
                      }}
                      title={`创建: ${d.created}`}
                    />
                    <div
                      style={{
                        width: 10,
                        height: `${(d.resolved / maxVolume) * 100}%`,
                        backgroundColor: COLORS.success,
                        borderRadius: '4px 4px 0 0',
                        opacity: 0.8,
                        minWidth: 6,
                      }}
                      title={`解决: ${d.resolved}`}
                    />
                  </div>
                  <Text style={{ fontSize: spacing[2], color: colors.neutral[400] }}>
                    {dayjs(d.period).format('MM/DD')}
                  </Text>
                </div>
              ))}
            </div>
            <Divider style={{ margin: '12px 0 8px' }} />
            <Space size={24}>
              <Space size={4}>
                <div style={{ width: 10, height: 10, backgroundColor: COLORS.info, borderRadius: 2 }} />
                <Text style={{ fontSize: spacing[3] }}>创建</Text>
              </Space>
              <Space size={4}>
                <div style={{ width: 10, height: 10, backgroundColor: COLORS.success, borderRadius: 2 }} />
                <Text style={{ fontSize: spacing[3] }}>解决</Text>
              </Space>
            </Space>
          </CardPanel>
        </Col>

        {/* SLA Compliance Trend */}
        <Col xs={24} xl={12}>
          <CardPanel title="SLA合规率趋势（近14天）" extra={<Tag color="green">{'目标 >90%'}</Tag>}>
            <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 8px' }}>
              {data.trends.slaComplianceTrend.slice(-14).map((d, i) => {
                const rate = d.rate;
                const barColor = rate >= 90 ? COLORS.success : rate >= 80 ? COLORS.warning : COLORS.error;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <div style={{ height: 160, display: 'flex', alignItems: 'flex-end' }}>
                      <div
                        style={{
                          width: 16,
                          height: `${rate}%`,
                          backgroundColor: barColor,
                          borderRadius: '4px 4px 0 0',
                          opacity: 0.8,
                          minWidth: 10,
                        }}
                        title={`SLA: ${rate}%`}
                      />
                    </div>
                    <Text style={{ fontSize: spacing[2], color: colors.neutral[400] }}>
                      {dayjs(d.period).format('MM/DD')}
                    </Text>
                  </div>
                );
              })}
            </div>
            <Divider style={{ margin: '12px 0 8px' }} />
            {/* 90% threshold line reference */}
            <Space size={16}>
              <Space size={4}>
                <div style={{ width: 10, height: 10, backgroundColor: COLORS.success, borderRadius: 2 }} />
                <Text style={{ fontSize: spacing[3] }}>{'达标 (>=90%)'}</Text>
              </Space>
              <Space size={4}>
                <div style={{ width: 10, height: 10, backgroundColor: COLORS.warning, borderRadius: 2 }} />
                <Text style={{ fontSize: spacing[3] }}>预警 (80-90%)</Text>
              </Space>
              <Space size={4}>
                <div style={{ width: 10, height: 10, backgroundColor: COLORS.error, borderRadius: 2 }} />
                <Text style={{ fontSize: spacing[3] }}>{'违规 (<80%)'}</Text>
              </Space>
            </Space>
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
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              {data.teamRanking.bottomPerformers.map((member) => (
                <Card
                  key={member.engineerId}
                  size="small"
                  style={{
                    borderLeft: `3px solid ${member.score < 60 ? COLORS.error : COLORS.warning}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <Text strong>{member.name}</Text>
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: spacing[3] }}>
                        {member.engineerId}
                      </Text>
                    </div>
                    <Tag
                      color={member.score < 60 ? 'error' : 'warning'}
                      style={{ fontWeight: 600 }}
                    >
                      {member.score}分
                    </Tag>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Text type="warning" style={{ fontSize: spacing[3] }}>
                      <WarningOutlined style={{ marginRight: 4 }} />
                      {member.needsAttention}
                    </Text>
                  </div>
                  <Progress
                    percent={member.score}
                    size="small"
                    strokeColor={member.score < 60 ? COLORS.error : COLORS.warning}
                    showInfo={false}
                    style={{ marginTop: 8 }}
                  />
                </Card>
              ))}
            </Space>
          </CardPanel>
        </Col>
      </Row>

      {/* Alerts Section */}
      <div style={{ marginBottom: 24 }}>
        <CardPanel title="告警中心" extra={<Tag color="red">需立即处理</Tag>}>
          <Row gutter={[16, 16]}>
            {alertCards.map((alert) => (
              <Col xs={24} sm={12} lg={6} key={alert.title}>
                <Card
                  size="small"
                  style={{
                    borderLeft: `3px solid ${alert.color}`,
                    backgroundColor: `${alert.color}08`,
                  }}
                >
                  <Statistic
                    title={
                      <Space>
                        <span style={{ color: alert.color }}>{alert.icon}</span>
                        {alert.title}
                      </Space>
                    }
                    value={alert.value}
                    suffix={alert.suffix}
                    valueStyle={{ color: alert.color, fontSize: 28 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </CardPanel>
      </div>

      {/* Distribution Section */}
      <Row gutter={[16, 16]}>
        {/* Category Distribution */}
        <Col xs={24} xl={14}>
          <CardPanel title="工单分类分布" extra={<Tag color="purple">{Object.keys(data.distribution.byCategory).length}个分类</Tag>}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {Object.entries(data.distribution.byCategory).map(([key, val]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: `1px solid ${colors.light.border.light}`,
                  }}
                >
                  <Space style={{ minWidth: 100 }}>
                    <Tag color={COLORS.info}>{categoryNames[key] || key}</Tag>
                  </Space>
                  <SimpleBar
                    value={val.count}
                    max={maxCategoryCount}
                    color={COLORS.info}
                    width={160}
                  />
                  <Space size={16}>
                    <Text style={{ minWidth: 40, textAlign: 'right' }}>
                      {val.count} 个
                    </Text>
                    <Text type="secondary" style={{ minWidth: 60, fontSize: spacing[3] }}>
                      平均 {val.avgResolutionHours}h
                    </Text>
                  </Space>
                </div>
              ))}
            </Space>
          </CardPanel>
        </Col>

        {/* Priority Distribution */}
        <Col xs={24} xl={10}>
          <CardPanel title="优先级分布">
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              {Object.entries(data.distribution.byPriority).map(([key, val]) => (
                <Card key={key} size="small">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <Tag color={priorityColors[key]} style={{ fontWeight: 600 }}>
                      {priorityNames[key] || key}
                    </Tag>
                    <Space>
                      <Text>总数: {val.count}</Text>
                      <Text type="secondary">已解决: {val.resolved}</Text>
                    </Space>
                  </div>
                  <Progress
                    percent={
                      val.count > 0 ? Math.round((val.resolved / val.count) * 100) : 0
                    }
                    size="small"
                    strokeColor={priorityColors[key]}
                    format={(percent) => `${percent}% 已解决`}
                  />
                </Card>
              ))}
            </Space>
          </CardPanel>
        </Col>
      </Row>
    </div>
  );
};

export default ExecutiveDashboard;
