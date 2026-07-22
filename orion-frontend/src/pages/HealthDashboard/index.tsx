/**
 * Health Dashboard Page (Task 6.8)
 * 系统健康仪表盘：KPI 卡片、服务健康列表、告警列表、趋势图
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Space, Spin, message, Statistic, Empty, Button } from 'antd';
import {
  HeartOutlined,
  AlertOutlined,
  ClockCircleOutlined,
  LineChartOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  getHealthDashboard,
  type HealthAlert,
  type ServiceHealthRow,
  type TrendPoint,
} from '@/api/health';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ==================== Chart Component ====================

const TrendChart: React.FC<{ data: TrendPoint[] }> = ({ data }) => {
  if (!data.length) return <Empty description="暂无趋势数据" />;

  const maxScore = 100;
  const chartWidth = 800;
  const chartHeight = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;

  // Build SVG path for health score
  const scorePoints = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + innerH - (d.healthScore / maxScore) * innerH,
  }));

  const linePath = scorePoints.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaPath =
    linePath +
    ` L${scorePoints[scorePoints.length - 1].x},${padding.top + innerH}` +
    ` L${scorePoints[0].x},${padding.top + innerH} Z`;

  // Grid lines
  const gridLines = [0, 25, 50, 75, 100].map((v) => ({
    y: padding.top + innerH - (v / maxScore) * innerH,
    label: `${v}`,
  }));

  // X-axis labels (show every 4 hours)
  const xLabels = data.filter((_, i) => i % 4 === 0 || i === data.length - 1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', maxWidth: chartWidth, height: 'auto' }}>
        {/* Grid */}
        {gridLines.map((g) => (
          <g key={g.y}>
            <line x1={padding.left} y1={g.y} x2={padding.left + innerW} y2={g.y} stroke={colors.neutral[200]} strokeDasharray="4 4" />
            <text x={padding.left - 6} y={g.y + 4} textAnchor="end" fontSize="10" fill={colors.neutral[500]}>
              {g.label}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={`${colors.primary[500]}18`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={colors.primary[500]} strokeWidth={2} />

        {/* Data points */}
        {scorePoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={colors.primary[500]} stroke={colors.neutral[0]} strokeWidth={1.5} />
        ))}

        {/* X labels */}
        {xLabels.map((d, i) => {
          const idx = data.indexOf(d);
          return (
            <text
              key={i}
              x={padding.left + idx * xStep}
              y={chartHeight - 6}
              textAnchor="middle"
              fontSize="10"
              fill={colors.neutral[500]}
            >
              {dayjs(d.timestamp).format('HH:mm')}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

// ==================== Main Component ====================

const HealthDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<{ score: number; level: string } | null>(null);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [avgLatencyMs, setAvgLatencyMs] = useState(0);
  const [errorRate, setErrorRate] = useState(0);
  const [services, setServices] = useState<ServiceHealthRow[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getHealthDashboard();
      setScore({ score: data.score.score, level: data.score.level });
      setActiveAlerts(data.activeAlerts);
      setAvgLatencyMs(data.avgLatencyMs);
      setErrorRate(data.errorRate);
      setServices(data.services);
      setAlerts(data.alerts);
      setTrend(data.trend);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载健康仪表盘数据失败';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // 每 30 秒轮询
    const timer = setInterval(loadData, 30_000);
    return () => clearInterval(timer);
  }, []);

  // ==================== Alert Severity ====================

  const severityTag = (severity: string) => {
    const map: Record<string, { color: string; text: string }> = {
      critical: { color: colors.error[500],   text: '严重' },
      warning:  { color: colors.warning[500],  text: '警告' },
      info:     { color: colors.info[500],     text: '信息' },
    };
    const cfg = map[severity] ?? map.info;
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  const statusTag = (status: string) => {
    const map: Record<string, { color: string; text: string }> = {
      active:       { color: colors.error[500],   text: '活跃' },
      acknowledged: { color: colors.warning[500],  text: '已确认' },
      resolved:     { color: colors.success[500],  text: '已解决' },
    };
    const cfg = map[status] ?? { color: colors.neutral[400], text: status };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  const serviceStatusTag = (status: string) => {
    const map: Record<string, { color: string; text: string }> = {
      healthy:   { color: colors.success[500], text: '健康' },
      degraded:  { color: colors.warning[500], text: '降级' },
      unhealthy: { color: colors.error[500],   text: '异常' },
    };
    const cfg = map[status] ?? { color: colors.neutral[400], text: status };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  // ==================== Alert Columns ====================

  const alertColumns: ColumnsType<HealthAlert> = [
    {
      title: '服务',
      dataIndex: 'serviceName',
      key: 'serviceName',
      width: 160,
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (s: string) => severityTag(s),
    },
    {
      title: '描述',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '活跃', value: 'active' },
        { text: '已确认', value: 'acknowledged' },
        { text: '已解决', value: 'resolved' },
      ],
      onFilter: (value, record: HealthAlert) => record.status === value,
      render: (s: string) => statusTag(s),
    },
    {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      key: 'triggeredAt',
      width: 170,
      sorter: (a: HealthAlert, b: HealthAlert) => dayjs(a.triggeredAt).unix() - dayjs(b.triggeredAt).unix(),
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm'),
    },
  ];

  // ==================== Service Health Columns ====================

  const serviceColumns: ColumnsType<ServiceHealthRow> = [
    {
      title: '服务',
      dataIndex: 'serviceName',
      key: 'serviceName',
      width: 180,
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '健康', value: 'healthy' },
        { text: '降级', value: 'degraded' },
        { text: '异常', value: 'unhealthy' },
      ],
      onFilter: (value, record: ServiceHealthRow) => record.status === value,
      render: (s: string) => serviceStatusTag(s),
    },
    {
      title: '平均延迟',
      dataIndex: 'latencyMs',
      key: 'latencyMs',
      width: 120,
      sorter: (a: ServiceHealthRow, b: ServiceHealthRow) => a.latencyMs - b.latencyMs,
      render: (v: number) => (
        <Text style={{ color: v > 500 ? colors.error[500] : v > 200 ? colors.warning[500] : undefined }}>
          {v} ms
        </Text>
      ),
    },
    {
      title: '错误率',
      dataIndex: 'errorRate',
      key: 'errorRate',
      width: 120,
      sorter: (a: ServiceHealthRow, b: ServiceHealthRow) => a.errorRate - b.errorRate,
      render: (v: number) => (
        <Text style={{ color: v > 5 ? colors.error[500] : v > 1 ? colors.warning[500] : colors.success[500] }}>
          {v.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: '可用性',
      dataIndex: 'uptimePercent',
      key: 'uptimePercent',
      width: 120,
      sorter: (a: ServiceHealthRow, b: ServiceHealthRow) => a.uptimePercent - b.uptimePercent,
      render: (v: number) => (
        <Text style={{ color: v < 99 ? colors.warning[500] : colors.success[500] }}>
          {v.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: '最近检测',
      dataIndex: 'lastChecked',
      key: 'lastChecked',
      width: 160,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  // ==================== Render ====================

  return (
    <Spin spinning={loading}>
      <div style={{ padding: spacing.lg }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg, flexWrap: 'wrap', gap: spacing.md }}>
          <div>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              <HeartOutlined style={{ marginRight: 12, color: colors.error[500] }} />
              健康仪表盘
            </Title>
            <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
              全系统健康状态总览与趋势分析
            </Text>
            {error && <Tag color={colors.error[500]} style={{ marginLeft: 8 }}>加载失败</Tag>}
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
        </div>

        {/* KPI Cards */}
        <Row gutter={16} style={{ marginBottom: spacing.lg }}>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="健康评分"
                value={score?.score ?? 0}
                suffix="/ 100"
                valueStyle={{
                  color: (score?.score ?? 0) >= 80
                    ? colors.success[500]
                    : (score?.score ?? 0) >= 60
                      ? colors.warning[500]
                      : colors.error[500],
                }}
                prefix={<HeartOutlined />}
              />
              {score && (
                <div style={{ marginTop: 4 }}>
                  <Tag color={score.level === 'healthy' ? colors.success[500] : score.level === 'warning' ? colors.warning[500] : colors.error[500]}>
                    {score.level === 'healthy' ? '健康' : score.level === 'warning' ? '警告' : '严重'}
                  </Tag>
                </div>
              )}
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="活跃告警"
                value={activeAlerts}
                valueStyle={{ color: activeAlerts > 0 ? colors.error[500] : colors.success[500] }}
                prefix={<AlertOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="平均延迟"
                value={avgLatencyMs}
                suffix="ms"
                valueStyle={{ color: avgLatencyMs > 200 ? colors.warning[500] : colors.success[500] }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="全局错误率"
                value={errorRate}
                suffix="%"
                precision={2}
                valueStyle={{ color: errorRate > 2 ? colors.error[500] : errorRate > 0.5 ? colors.warning[500] : colors.success[500] }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Service Health Table */}
        <Card
          style={{ marginBottom: spacing.lg }}
          title={
            <Space>
              <CheckCircleOutlined style={{ color: colors.primary[500] }} />
              服务健康列表
            </Space>
          }
        >
          <Table<ServiceHealthRow>
            rowKey="serviceId"
            columns={serviceColumns}
            dataSource={services}
            pagination={false}
            size="small"
            scroll={{ x: 800 }}
            locale={{ emptyText: <Empty description="暂无服务健康数据" /> }}
          />
        </Card>

        {/* Alerts Table */}
        <Card
          style={{ marginBottom: spacing.lg }}
          title={
            <Space>
              <AlertOutlined style={{ color: colors.error[500] }} />
              告警列表
            </Space>
          }
        >
          <Table<HealthAlert>
            rowKey="id"
            columns={alertColumns}
            dataSource={alerts}
            pagination={{ pageSize: 5 }}
            scroll={{ x: 700 }}
            locale={{ emptyText: <Empty description="暂无告警" /> }}
          />
        </Card>

        {/* Trend Chart */}
        <Card
          title={
            <Space>
              <LineChartOutlined style={{ color: colors.info[500] }} />
              健康趋势（24h）
            </Space>
          }
        >
          {trend.length > 0 ? (
            <TrendChart data={trend} />
          ) : (
            <Empty description="暂无趋势数据" />
          )}
        </Card>
      </div>
    </Spin>
  );
};

export default HealthDashboard;
