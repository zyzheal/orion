/**
 * DoraMetricsPage (P4-01)
 * DORA 效率指标补全页面 - 四大指标概览、等级评估、趋势图表
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  message,
  Row,
  Col,
  Statistic,
  Empty,
  Radio,
  type RadioChangeEvent,
} from 'antd';
import {
  LineChartOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getDoraMetrics,
  getDoraBenchmarks,
  getDORTrends,
  type DoraMetricsResult,
  type DoraBenchmarks,
  type TrendHistoryPoint,
} from '@/api/efficiency';

const { Title, Text } = Typography;

// ---- Simulated fallback data ----

const fallbackMetrics: DoraMetricsResult = {
  metrics: {
    deploymentFrequency: '4.2',
    leadTimeForChanges: 168,
    changeFailureRate: 8.3,
    meanTimeToRecovery: 42,
  },
  timeWindow: {
    window: 'week',
    size: 4,
    start: '2026-07-10',
    end: '2026-08-07',
  },
  calculatedAt: new Date().toISOString(),
};

const fallbackBenchmarks: DoraBenchmarks = {
  deploymentFrequency: {
    elite: '>=5次/周',
    high: '2-5次/周',
    medium: '1-2次/周',
    low: '<1次/周',
  },
  leadTimeForChanges: {
    elite: '<1小时',
    high: '1小时-1天',
    medium: '1天-1周',
    low: '>1周',
  },
  changeFailureRate: {
    elite: '<5%',
    high: '5%-10%',
    medium: '10%-20%',
    low: '>20%',
  },
  meanTimeToRecovery: {
    elite: '<1小时',
    high: '1小时-1天',
    medium: '1天-1周',
    low: '>1周',
  },
};

const fallbackTrends: TrendHistoryPoint[] = [
  { week: 'W28', deploymentFrequency: 3.5, leadTime: 210, mttr: 55, changeFailureRate: 12 },
  { week: 'W29', deploymentFrequency: 4.0, leadTime: 195, mttr: 48, changeFailureRate: 10 },
  { week: 'W30', deploymentFrequency: 4.8, leadTime: 180, mttr: 45, changeFailureRate: 9 },
  { week: 'W31', deploymentFrequency: 4.2, leadTime: 168, mttr: 42, changeFailureRate: 8.3 },
];

// ---- Level determination ----

type DorMetricLevel = 'Elite' | 'High' | 'Medium' | 'Low';

function determineDeploymentFrequencyLevel(value: number): DorMetricLevel {
  if (value >= 5) return 'Elite';
  if (value >= 2) return 'High';
  if (value >= 1) return 'Medium';
  return 'Low';
}

function determineLeadTimeLevel(value: number): DorMetricLevel {
  // value in hours
  if (value <= 1) return 'Elite';
  if (value <= 24) return 'High';
  if (value <= 168) return 'Medium';
  return 'Low';
}

function determineChangeFailureLevel(value: number): DorMetricLevel {
  if (value <= 5) return 'Elite';
  if (value <= 10) return 'High';
  if (value <= 20) return 'Medium';
  return 'Low';
}

function determineMttrLevel(value: number): DorMetricLevel {
  // value in minutes
  if (value <= 60) return 'Elite';
  if (value <= 1440) return 'High';
  if (value <= 10080) return 'Medium';
  return 'Low';
}

const levelColorMap: Record<DorMetricLevel, string> = {
  Elite: colors.success[500],
  High: colors.info[500],
  Medium: colors.warning[500],
  Low: colors.error[500],
};

// ---- SVG Trend Chart ----

interface TrendChartProps {
  data: TrendHistoryPoint[];
  metricKey: 'deploymentFrequency' | 'leadTime' | 'mttr' | 'changeFailureRate';
  metricLabel: string;
  color: string;
}

const TrendChart: React.FC<TrendChartProps> = ({ data, metricKey, metricLabel, color }) => {
  if (!data || data.length === 0) {
    return <Empty description={`暂无 ${metricLabel} 趋势数据`} />;
  }

  const width = 700;
  const height = 100;
  const padding = { top: 15, right: 20, bottom: 25, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d[metricKey]);
  const maxVal = Math.max(...values, 0.01);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const points = data.map((_, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((values[i] - minVal) / range) * chartH;
    return { x, y };
  });

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id={`grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${metricKey})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
      ))}
      {points.map((p, i) => (
        <text
          key={`lbl-${i}`}
          x={p.x}
          y={padding.top + chartH + 15}
          fontSize="10"
          fill={colors.neutral[500]}
          textAnchor="middle"
        >
          {data[i].week}
        </text>
      ))}
      <text
        x={padding.left - 5}
        y={padding.top + 5}
        fontSize="10"
        fill={colors.neutral[500]}
        textAnchor="end"
      >
        {maxVal}
      </text>
      <text
        x={padding.left - 5}
        y={padding.top + chartH}
        fontSize="10"
        fill={colors.neutral[500]}
        textAnchor="end"
      >
        {minVal}
      </text>
    </svg>
  );
};

// ---- Main Page ----

const DoraMetricsPage: React.FC = () => {
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [timeWindow, setTimeWindow] = useState<'7d' | '30d' | '90d'>('30d');

  const [doraResult, setDoraResult] = useState<DoraMetricsResult | null>(null);
  const [benchmarks, setBenchmarks] = useState<DoraBenchmarks | null>(null);
  const [trends, setTrends] = useState<TrendHistoryPoint[]>([]);

  const timeWindowQueryMap: Record<string, number> = {
    '7d': 1,
    '30d': 4,
    '90d': 13,
  };

  const loadData = async (windowLabel: string = timeWindow) => {
    const weeks = timeWindowQueryMap[windowLabel] || 4;

    const metricsRes = await getDoraMetrics({ interval: 'weekly' }).catch(() => null);
    const benchmarksRes = await getDoraBenchmarks().catch(() => null);
    const trendsRes = await getDORTrends({ weeks }).catch(() => null);

    setDoraResult(metricsRes?.data || fallbackMetrics);
    setBenchmarks(benchmarksRes?.data || fallbackBenchmarks);
    setTrends(trendsRes?.data?.trends || fallbackTrends);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshLoading(true);
    try {
      await loadData();
      message.success('DORA 指标已刷新');
    } catch {
      message.error('刷新 DORA 指标失败，请检查网络连接');
    } finally {
      setRefreshLoading(false);
    }
  };

  const handleWindowChange = (e: RadioChangeEvent | { target: { value: string } }) => {
    const value = (e as any).value || e.target.value;
    setTimeWindow(value as '7d' | '30d' | '90d');
  };

  const metrics = doraResult?.metrics || fallbackMetrics.metrics;
  const benchmarksData = benchmarks || fallbackBenchmarks;
  const trendData = trends.length > 0 ? trends : fallbackTrends;

  const depFreq = typeof metrics.deploymentFrequency === 'string'
    ? parseFloat(metrics.deploymentFrequency)
    : (metrics.deploymentFrequency as number);

  const currentDeploymentLevel = determineDeploymentFrequencyLevel(depFreq || 0);
  const currentLeadTimeLevel = determineLeadTimeLevel(metrics.leadTimeForChanges || 0);
  const currentCfrLevel = determineChangeFailureLevel(metrics.changeFailureRate || 0);
  const currentMttrLevel = determineMttrLevel(metrics.meanTimeToRecovery || 0);

  // ---- Benchmark table data ----

  const benchmarkRows = [
    {
      key: 'deploymentFrequency',
      name: '部署频率',
      currentValue: `${depFreq} 次/周`,
      elite: benchmarksData.deploymentFrequency.elite,
      high: benchmarksData.deploymentFrequency.high,
      medium: benchmarksData.deploymentFrequency.medium,
      level: currentDeploymentLevel,
    },
    {
      key: 'leadTimeForChanges',
      name: '变更前置时间',
      currentValue: `${metrics.leadTimeForChanges} 小时`,
      elite: benchmarksData.leadTimeForChanges.elite,
      high: benchmarksData.leadTimeForChanges.high,
      medium: benchmarksData.leadTimeForChanges.medium,
      level: currentLeadTimeLevel,
    },
    {
      key: 'changeFailureRate',
      name: '变更失败率',
      currentValue: `${metrics.changeFailureRate}%`,
      elite: benchmarksData.changeFailureRate.elite,
      high: benchmarksData.changeFailureRate.high,
      medium: benchmarksData.changeFailureRate.medium,
      level: currentCfrLevel,
    },
    {
      key: 'mttr',
      name: '平均恢复时间 (MTTR)',
      currentValue: `${metrics.meanTimeToRecovery} 分钟`,
      elite: benchmarksData.meanTimeToRecovery.elite,
      high: benchmarksData.meanTimeToRecovery.high,
      medium: benchmarksData.meanTimeToRecovery.medium,
      level: currentMttrLevel,
    },
  ];

  const benchmarkColumns = [
    {
      title: '指标名',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '当前值',
      dataIndex: 'currentValue',
      key: 'currentValue',
      width: 140,
      render: (v: string) => <Text strong style={{ color: colors.primary[500] }}>{v}</Text>,
    },
    {
      title: 'Elite 基准',
      dataIndex: 'elite',
      key: 'elite',
      width: 130,
      render: (v: string) => <Text style={{ color: colors.success[500] }}>{v}</Text>,
    },
    {
      title: 'High 基准',
      dataIndex: 'high',
      key: 'high',
      width: 130,
      render: (v: string) => <Text style={{ color: colors.info[500] }}>{v}</Text>,
    },
    {
      title: 'Medium 基准',
      dataIndex: 'medium',
      key: 'medium',
      width: 130,
      render: (v: string) => <Text style={{ color: colors.warning[500] }}>{v}</Text>,
    },
    {
      title: '当前等级',
      dataIndex: 'level',
      key: 'level',
      width: 120,
      render: (v: DorMetricLevel) => (
        <Tag color={levelColorMap[v]} style={{ fontWeight: 600 }}>{v}</Tag>
      ),
    },
  ];

  if (doraResult === null) {
    return <PageSkeleton cards={4} rows={6} />;
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <LineChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          DORA 效率指标
        </Title>
        <Text type="secondary">部署频率 · 变更前置时间 · 变更失败率 · 平均恢复时间</Text>
      </div>

      {/* Control Bar */}
      <div
        style={{
          marginBottom: spacing.md,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text type="secondary">时间窗口</Text>
        <Space>
          <Radio.Group value={timeWindow} onChange={handleWindowChange} buttonStyle="solid" size="small">
            <Radio.Button value="7d">7 天</Radio.Button>
            <Radio.Button value="30d">30 天</Radio.Button>
            <Radio.Button value="90d">90 天</Radio.Button>
          </Radio.Group>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={refreshLoading}
            size="middle"
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* Statistic Cards */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card
            style={{
              background: colors.light.bg.secondary,
              borderRadius: spacing[4],
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.primary[500]}`,
            }}
          >
            <Statistic
              title="部署频率"
              value={depFreq}
              suffix="次/周"
              prefix={<ThunderboltOutlined style={{ color: colors.primary[500] }} />}
              valueStyle={{ color: colors.primary[500] }}
            />
            <div style={{ marginTop: spacing.sm, textAlign: 'right' }}>
              <Tag color={levelColorMap[currentDeploymentLevel]}>{currentDeploymentLevel}</Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              background: colors.light.bg.secondary,
              borderRadius: spacing[4],
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.success[500]}`,
            }}
          >
            <Statistic
              title="变更前置时间"
              value={metrics.leadTimeForChanges}
              suffix="小时"
              prefix={<ClockCircleOutlined style={{ color: colors.success[500] }} />}
              valueStyle={{ color: colors.success[500] }}
            />
            <div style={{ marginTop: spacing.sm, textAlign: 'right' }}>
              <Tag color={levelColorMap[currentLeadTimeLevel]}>{currentLeadTimeLevel}</Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              background: colors.light.bg.secondary,
              borderRadius: spacing[4],
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.error[500]}`,
            }}
          >
            <Statistic
              title="变更失败率"
              value={metrics.changeFailureRate}
              suffix="%"
              prefix={<WarningOutlined style={{ color: colors.error[500] }} />}
              valueStyle={{ color: metrics.changeFailureRate <= 10 ? colors.success[500] : colors.error[500] }}
            />
            <div style={{ marginTop: spacing.sm, textAlign: 'right' }}>
              <Tag color={levelColorMap[currentCfrLevel]}>{currentCfrLevel}</Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              background: colors.light.bg.secondary,
              borderRadius: spacing[4],
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.info[500]}`,
            }}
          >
            <Statistic
              title="平均恢复时间 (MTTR)"
              value={metrics.meanTimeToRecovery}
              suffix="分钟"
              prefix={<CheckCircleOutlined style={{ color: colors.info[500] }} />}
              valueStyle={{ color: colors.info[500] }}
            />
            <div style={{ marginTop: spacing.sm, textAlign: 'right' }}>
              <Tag color={levelColorMap[currentMttrLevel]}>{currentMttrLevel}</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Benchmark Assessment Table */}
      <Card
        title="DORA 等级评估"
        style={{ marginBottom: spacing.lg }}
      >
        <Table
          columns={benchmarkColumns}
          dataSource={benchmarkRows}
          pagination={false}
          size="middle"
          rowKey="key"
          bordered
          style={{ background: colors.light.bg.primary }}
        />
      </Card>

      {/* Trend Charts */}
      <Card title="4 周趋势分析">
        <Row gutter={spacing.lg}>
          <Col span={12}>
            <div style={{ marginBottom: spacing.md }}>
              <Text strong>部署频率 (次/周)</Text>
            </div>
            <TrendChart
              data={trendData}
              metricKey="deploymentFrequency"
              metricLabel="部署频率"
              color={colors.primary[500]}
            />
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: spacing.md }}>
              <Text strong>变更前置时间 (小时)</Text>
            </div>
            <TrendChart
              data={trendData}
              metricKey="leadTime"
              metricLabel="变更前置时间"
              color={colors.success[500]}
            />
          </Col>
        </Row>
        <Row gutter={spacing.lg} style={{ marginTop: spacing.md }}>
          <Col span={12}>
            <div style={{ marginBottom: spacing.md }}>
              <Text strong>变更失败率 (%)</Text>
            </div>
            <TrendChart
              data={trendData}
              metricKey="changeFailureRate"
              metricLabel="变更失败率"
              color={colors.error[500]}
            />
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: spacing.md }}>
              <Text strong>MTTR (分钟)</Text>
            </div>
            <TrendChart
              data={trendData}
              metricKey="mttr"
              metricLabel="平均恢复时间"
              color={colors.info[500]}
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default DoraMetricsPage;
