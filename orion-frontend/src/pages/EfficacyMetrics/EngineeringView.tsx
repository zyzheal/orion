import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Typography, Tag, Table, Button, message } from 'antd';
import {
  BarChartOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import MetricCard from '@/components/MetricCard';
import {
  getEfficiencyDashboard,
  getDoraMetrics,
  getBottlenecks,
  type DoraMetrics,
  type BottleneckItem,
} from '@/api/efficiency';
import { levelToScore, scoreToLevel } from '@/utils/efficacyScore';

const { Title, Text } = Typography;

const EngineeringView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dora, setDora] = useState<DoraMetrics | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [bottlenecks, setBottlenecks] = useState<BottleneckItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [doraRes, dashRes, bottleneckRes] = await Promise.all([
        getDoraMetrics().catch(() => null),
        getEfficiencyDashboard().catch(() => null),
        getBottlenecks().catch(() => null),
      ]);

      setDora((doraRes as any)?.data?.metrics ?? null);
      setDashboard((dashRes as any)?.data?.dashboard ?? null);
      setBottlenecks((bottleneckRes as any)?.data?.bottlenecks ?? []);
    } catch (err: any) {
      message.error(err?.message ?? 'Failed to load engineering metrics');
    } finally {
      setLoading(false);
    }
  };

  const summary: { totalDeployments: number; successfulDeployments: number; failedDeployments: number } =
    dashboard?.summary ?? { totalDeployments: 0, successfulDeployments: 0, failedDeployments: 0 };

  const successRate =
    summary.totalDeployments > 0
      ? Math.round(summary.successfulDeployments / summary.totalDeployments * 100)
      : 0;

  const doraLevel = doraLevelToString(dora);
  const doraScore = levelToScore(doraLevel);
  const { label: levelLabel, color: levelColor } = scoreToLevel(doraScore);

  const doraMetricsData = dora
    ? [
        {
          title: '发布频率',
          value: dora.deploymentFrequency,
          unit: '',
          icon: <RocketOutlined />,
          color: colors.primary[500],
          trend: 'up' as const,
          trendPercent: 15,
        },
        {
          title: '变更前置时间',
          value: dora.leadTimeForChanges,
          unit: '分钟',
          icon: <ClockCircleOutlined />,
          color: colors.warning[500],
          trend: 'down' as const,
          trendPercent: 8,
        },
        {
          title: '变更失败率',
          value: dora.changeFailureRate,
          unit: '%',
          icon: <AlertOutlined />,
          color: colors.error[500],
          trend: 'down' as const,
          trendPercent: 3,
        },
        {
          title: '恢复时间',
          value: dora.meanTimeToRecovery,
          unit: '分钟',
          icon: <ExclamationCircleOutlined />,
          color: colors.info[500],
          trend: 'up' as const,
          trendPercent: 5,
        },
      ]
    : [];

  const bottleneckColumns = [
    { title: '瓶颈', dataIndex: 'description', key: 'description', render: (v: string) => <Text>{v}</Text> },
    { title: '类别', dataIndex: 'category', key: 'category', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '影响', dataIndex: 'impact', key: 'impact',
      render: (v: 'high' | 'medium' | 'low') => {
        const colorMap = { high: 'red', medium: 'orange', low: 'blue' };
        return <Tag color={colorMap[v] || 'blue'}>{v.toUpperCase()}</Tag>;
      },
    },
    { title: '当前值', dataIndex: 'currentValue', key: 'currentValue', render: (v: string) => <Text code>{v}</Text> },
    { title: '目标值', dataIndex: 'targetValue', key: 'targetValue', render: (v: string) => <Text code>{v}</Text> },
    { title: '建议', dataIndex: 'suggestion', key: 'suggestion' },
  ];

  if (loading && refreshKey === 0) {
    return <div style={{ padding: spacing.lg, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            工程域 · DORA 深度分析
          </Title>
          <Text type="secondary">DORA 四指标 · 等级评估 · 瓶颈分析</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey((k) => k + 1)} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        {doraMetricsData.map((m) => (
          <Col span={6} key={m.title}>
            <MetricCard
              title={m.title}
              value={m.value}
              unit={m.unit}
              icon={m.icon}
              color={m.color}
              trend={m.trend}
              trendPercent={m.trendPercent}
            />
          </Col>
        ))}
      </Row>

      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <MetricCard
            title="DORA 综合等级"
            value={levelLabel}
            icon={<BarChartOutlined />}
            color={levelColor}
            trend="up"
            trendPercent={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="部署成功率"
            value={successRate}
            unit="%"
            icon={<CheckCircleOutlined />}
            color={
              successRate > 90 ? colors.success[500]
                : successRate > 70 ? colors.warning[500]
                : colors.error[500]
            }
            trend="up"
            trendPercent={2}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="总部署数"
            value={summary.totalDeployments}
            icon={<RocketOutlined />}
            color={colors.primary[500]}
            trend="up"
            trendPercent={10}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="失败部署"
            value={summary.failedDeployments}
            icon={<AlertOutlined />}
            color={colors.error[500]}
            trend="down"
            trendPercent={5}
          />
        </Col>
      </Row>

      <Card title="瓶颈分析" style={{ marginBottom: spacing.md }}>
        <Table
          columns={bottleneckColumns}
          dataSource={bottlenecks}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: <Text type="secondary">暂无瓶颈数据</Text> }}
        />
      </Card>
    </div>
  );
};

function doraLevelToString(dora: DoraMetrics | null): 'elite' | 'high' | 'medium' | 'low' {
  if (!dora) return 'medium';
  const freq = dora.deploymentFrequency;
  if (freq.includes('on-demand') || freq.includes('多次')) return 'elite';
  if (freq.includes('daily') || freq.includes('每日')) return 'high';
  if (freq.includes('weekly') || freq.includes('周')) return 'medium';
  return 'low';
}

export default EngineeringView;
