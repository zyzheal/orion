/**
 * Engineer Dashboard Page
 * Personal performance dashboard for individual engineers, including personal
 * metrics, trend analysis, strengths/weaknesses, and active ticket tracking.
 *
 * Uses mock data initially; real API integration will be added later.
 */
import React from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Table,
  Typography,
  Space,
  Badge,
} from 'antd';
import { colors, spacing } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import {
  TrophyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  WarningOutlined,
  FlagOutlined,
  UserOutlined,
} from '@ant-design/icons';
import CardPanel from '@/components/CardPanel';
import { StatCard, TrendLineChart, GaugeChart, BarChart } from '@/components/charts';
import { mockEngineerDashboard } from '@/pages/__mocks__/mockBIData';
import { useBiDashboard } from '@/hooks/useBiDashboard';
import type { EngineerDashboardData } from '@/types/pages';
import { Spin, Alert } from 'antd';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// Color constants
const COLORS = {
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[400],
  info: colors.primary[500],
  purple: colors.purple[500],
  cyan: colors.info[500],
};

/**
 * Priority tag color mapping
 */
const priorityColor = (priority: string): string => {
  switch (priority) {
    case 'critical':
      return COLORS.error;
    case 'high':
      return colors.warning[500];
    case 'medium':
      return COLORS.warning;
    case 'low':
      return COLORS.info;
    default:
      return colors.neutral[400];
  }
};

/**
 * Priority display name
 */
const priorityName = (priority: string): string => {
  const names: Record<string, string> = {
    critical: '紧急',
    high: '高',
    medium: '中',
    low: '低',
  };
  return names[priority] || priority;
};

/**
 * Status display name
 */
const statusName = (status: string): string => {
  const names: Record<string, string> = {
    'in-progress': '处理中',
    assigned: '已分配',
    pending: '待处理',
    resolved: '已解决',
  };
  return names[status] || status;
};

/**
 * Category display name
 */
const categoryName = (category: string): string => {
  const names: Record<string, string> = {
    infrastructure: '基础设施',
    application: '应用',
    database: '数据库',
    network: '网络',
    security: '安全',
    deployment: '部署',
    pipeline: '流水线',
    performance: '性能',
  };
  return names[category] || category;
};

const EngineerDashboard: React.FC = () => {
  const { data: apiData, loading, error } = useBiDashboard('engineer');

  // Fallback to mock data when API is unavailable
  const data = (apiData as EngineerDashboardData | undefined) ?? mockEngineerDashboard;
  const showMockWarning = !apiData;

  // Grade color
  const gradeColorMap: Record<string, string> = {
    A: COLORS.success,
    'A-': COLORS.success,
    'B+': COLORS.info,
    B: COLORS.info,
    C: COLORS.warning,
    D: COLORS.error,
  };

  // Active tickets table columns
  const activeTicketColumns: ColumnsType<(typeof data.activeTickets)[0]> = [
    {
      title: '工单号',
      dataIndex: 'ticketId',
      key: 'ticketId',
      width: 100,
      render: (text: string) => (
        <Text strong style={{ color: COLORS.info }}>
          {text}
        </Text>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => (
        <Tag color={priorityColor(priority)} style={{ fontWeight: 600 }}>
          {priorityName(priority)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => <Tag>{statusName(status)}</Tag>,
    },
    {
      title: '已耗时',
      dataIndex: 'elapsedHours',
      key: 'elapsedHours',
      width: 80,
      render: (hours: number) => `${hours}h`,
    },
    {
      title: 'SLA剩余',
      dataIndex: 'slaRemainingHours',
      key: 'slaRemainingHours',
      width: 100,
      render: (hours: number, _record: (typeof data.activeTickets)[0]) => (
        <Text
          style={{
            color: hours < 0 ? COLORS.error : hours < 4 ? COLORS.warning : 'inherit',
            fontWeight: hours < 4 ? 600 : 400,
          }}
        >
          {hours < 0 ? `超时 ${Math.abs(hours)}h` : `${hours}h`}
        </Text>
      ),
    },
    {
      title: '状态',
      key: 'overdue',
      width: 80,
      render: (_: unknown, record: (typeof data.activeTickets)[0]) =>
        record.isOverdue ? (
          <Badge status="error" text="超期" />
        ) : (
          <Badge status="success" text="正常" />
        ),
    },
  ];

  // Trend data for last 14 days
  const recentTrend = data.personalTrend.slice(-14);
  const maxResolved = Math.max(...recentTrend.map((d) => d.resolved), 1);

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
          description="个人效能仪表盘 API 尚未部署，当前显示模拟数据。"
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
          <UserOutlined style={{ marginRight: 8, color: COLORS.purple }} />
          个人看板
        </Title>
        <Text type="secondary">
          {data.personalOverview.engineerName} — 个人效能与工单管理 —{' '}
          {dayjs().format('YYYY-MM-DD HH:mm')}
        </Text>
      </div>

      {/* Personal Overview Card */}
      <div style={{ marginBottom: 24 }}>
        <CardPanel>
          <Row gutter={[24, 16]} align="middle">
            {/* Left: Name, Rank, Grade */}
            <Col xs={24} sm={8} md={6}>
              <Space direction="vertical" size={8}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      backgroundColor: `${COLORS.purple}15`,
                      color: COLORS.purple,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: spacing[6],
                    }}
                  >
                    <UserOutlined />
                  </div>
                  <div>
                    <Title level={4} style={{ margin: 0 }}>
                      {data.personalOverview.engineerName}
                    </Title>
                    <Text type="secondary" style={{ fontSize: spacing[3] }}>
                      {data.personalOverview.engineerId}
                    </Text>
                  </div>
                </div>
                <Space size={12}>
                  <Tag
                    color="gold"
                    icon={<TrophyOutlined />}
                    style={{ fontWeight: 700, fontSize: spacing[4], padding: '4px 12px' }}
                  >
                    排名 #{data.personalOverview.rank}/{data.personalOverview.totalInTeam}
                  </Tag>
                  <Tag
                    color={
                      gradeColorMap[data.personalOverview.performanceGrade] || colors.neutral[400]
                    }
                    style={{ fontWeight: 700, fontSize: spacing[4], padding: '4px 12px' }}
                  >
                    等级 {data.personalOverview.performanceGrade}
                  </Tag>
                </Space>
              </Space>
            </Col>

            {/* Right: Metrics */}
            <Col xs={24} sm={16} md={18}>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <StatCard
                    title="当前负载"
                    value={data.personalOverview.currentLoad}
                    suffix="个"
                    icon={<ClockCircleOutlined />}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <StatCard
                    title="已解决总数"
                    value={data.personalOverview.totalResolved}
                    suffix="个"
                    icon={<CheckCircleOutlined />}
                    trend={{ value: 12, direction: 'up', good: 'up' }}
                    sparklineData={recentTrend.map(d => d.resolved)}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <StatCard
                    title="平均解决时间"
                    value={data.personalOverview.avgResolutionTimeHours}
                    suffix="h"
                    icon={<ThunderboltOutlined />}
                    trend={{ value: 5, direction: 'down', good: 'down' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <StatCard
                    title="SLA合规率"
                    value={data.personalOverview.slaComplianceRate}
                    suffix="%"
                    icon={<FlagOutlined />}
                  />
                </Col>
              </Row>
            </Col>
          </Row>
        </CardPanel>
      </div>

      {/* Personal Trend Chart */}
      <div style={{ marginBottom: 24 }}>
        <CardPanel title="个人趋势（近14天）" extra={<Tag color="cyan">解决数 & 耗时</Tag>}>
          <TrendLineChart
            title=""
            data={[recentTrend.map(d => ({ period: dayjs(d.period).format('MM/DD'), value: d.resolved, label: '解决数' }))]}
            height={200}
            showArea={true}
            smooth={false}
          />
        </CardPanel>
      </div>

      {/* Strengths & Weaknesses */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Strengths */}
        <Col xs={24} xl={12}>
          <CardPanel title="优势领域" extra={<RiseOutlined style={{ color: COLORS.success }} />}>
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              {data.strengths.map((s) => (
                <Card key={s.category} size="small">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Tag color={COLORS.success}>{categoryName(s.category)}</Tag>
                    <Space>
                      <Text style={{ fontSize: spacing[3] }}>解决 {s.resolvedCount} 个</Text>
                      <Text style={{ fontSize: spacing[3] }}>
                        SLA {(s.slaComplianceRate * 100).toFixed(0)}%
                      </Text>
                    </Space>
                  </div>
                  <GaugeChart value={s.proficiencyScore} title={`熟练度 ${s.proficiencyScore}%`} max={100} size={120} unit="%" />
                </Card>
              ))}
            </Space>
          </CardPanel>
        </Col>

        {/* Weaknesses */}
        <Col xs={24} xl={12}>
          <CardPanel
            title="待提升领域"
            extra={<WarningOutlined style={{ color: COLORS.warning }} />}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              {data.weaknesses.map((w) => (
                <Card
                  key={w.category}
                  size="small"
                  style={{
                    borderLeft: `3px solid ${
                      w.slaComplianceRate < 0.6 ? COLORS.error : COLORS.warning
                    }`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Tag color={w.slaComplianceRate < 0.6 ? 'error' : 'warning'}>
                      {categoryName(w.category)}
                    </Tag>
                    <Space>
                      <Text style={{ fontSize: spacing[3] }}>解决 {w.resolvedCount} 个</Text>
                      <Text style={{ fontSize: spacing[3] }}>
                        SLA {(w.slaComplianceRate * 100).toFixed(0)}%
                      </Text>
                    </Space>
                  </div>
                  <GaugeChart
                    value={Math.round(w.slaComplianceRate * 100)}
                    title={`SLA ${Math.round(w.slaComplianceRate * 100)}%`}
                    max={100}
                    size={120}
                    unit="%"
                    thresholds={{ warning: 70, danger: 60 }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: spacing[3] }}>
                      <WarningOutlined style={{ marginRight: 4 }} />
                      建议: {w.suggestion}
                    </Text>
                  </div>
                </Card>
              ))}
            </Space>
          </CardPanel>
        </Col>
      </Row>

      {/* Ability Distribution */}
      <div style={{ marginBottom: 24 }}>
        <CardPanel title="能力分布">
          <BarChart
            title="各类别熟练度"
            data={[
              ...data.strengths.map(s => ({ label: categoryName(s.category), value: s.proficiencyScore, series: '优势' })),
              ...data.weaknesses.map(w => ({ label: categoryName(w.category), value: Math.round(w.slaComplianceRate * 100), series: '待提升' })),
            ]}
            height={200}
          />
        </CardPanel>
      </div>

      {/* Active Tickets */}
      <div style={{ marginBottom: 24 }}>
        <CardPanel
          title="活跃工单"
          extra={
            <Badge count={data.activeTickets.length} style={{ backgroundColor: COLORS.info }}>
              <Tag>处理中</Tag>
            </Badge>
          }
        >
          <Table
            dataSource={data.activeTickets}
            columns={activeTicketColumns}
            rowKey="ticketId"
            pagination={false}
            size="middle"
            rowClassName={(record) => (record.isOverdue ? 'overdue-row' : '')}
          />
          {/* Inline style for overdue row highlighting */}
          <style>{`
            .overdue-row {
              background-color: ${colors.error[50]} !important;
            }
            .overdue-row:hover td {
              background-color: ${colors.error[100]} !important;
            }
          `}</style>
        </CardPanel>
      </div>
    </div>
  );
};

export default EngineerDashboard;
