/**
 * EfficiencyDashboard Page (TASK-402)
 * 效能看板 - DORA 指标可视化
 *
 * Features:
 * - DORA 指标展示（发布频率、变更前置时间、服务恢复时间、变更失败率）
 * - 趋势图表
 * - 团队对比
 * - 改进建议
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Space, Tabs, message } from 'antd';
import { colors } from '@/tokens';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import MetricCard from '@/components/MetricCard';
import { getDoraMetrics, getDoraBenchmarks, getEfficiencyDashboard, getClickHouseStatus } from '@/api/efficiency';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// ---- Type definitions for API responses ----

interface DoraBenchmarkCategory {
  elite: string;
  high: string;
  medium: string;
}

interface DoraBenchmarks {
  deploymentFrequency: DoraBenchmarkCategory;
  leadTimeForChanges: DoraBenchmarkCategory;
  changeFailureRate: DoraBenchmarkCategory;
  meanTimeToRecovery: DoraBenchmarkCategory;
}

interface DoraMetricsData {
  metrics?: {
    deploymentFrequency?: string;
    leadTimeForChanges?: number;
    changeFailureRate?: number;
    meanTimeToRecovery?: number;
  };
}

interface ClickHouseStatusData {
  connected?: boolean;
  syncedRecords?: number;
  lastSyncAt?: string;
}

interface DashboardDoraData {
  deploymentFrequency?: number;
  leadTime?: number;
  mttr?: number;
  changeFailureRate?: number;
}

interface EfficiencyDashboardData {
  dora?: DashboardDoraData;
}

interface MetricRow {
  key: string;
  name: string;
  icon: React.ReactNode;
  currentValue: string;
  trend: string;
  level: string;
  benchmarkKey: string;
}

const EfficiencyDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [doraMetrics, setDoraMetrics] = useState<DoraMetricsData | null>(null);
  const [benchmarks, setBenchmarks] = useState<DoraBenchmarks | null>(null);
  const [dashboardData, setDashboardData] = useState<EfficiencyDashboardData | null>(null);
  const [clickHouseStatus, setClickHouseStatus] = useState<ClickHouseStatusData | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, benchmarksRes, dashboardRes, statusRes] = await Promise.all([
        getDoraMetrics(),
        getDoraBenchmarks(),
        getEfficiencyDashboard(),
        getClickHouseStatus(),
      ]);
      setDoraMetrics(metricsRes.data.data);
      setBenchmarks(benchmarksRes.data.data);
      setDashboardData(dashboardRes.data.data as unknown as EfficiencyDashboardData | null);
      setClickHouseStatus(statusRes.data.data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载效能数据失败';
      console.error('Failed to load efficiency data:', error);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getLevel = (value: unknown, metricKey: string) => {
    if (!benchmarks || value === undefined) return '-';
    const category = (benchmarks as unknown as Record<string, DoraBenchmarkCategory>)[metricKey];
    if (!category) return '-';
    const strValue = String(value);
    // Simple comparison logic - lower is better for time/rate metrics
    if (metricKey === 'deploymentFrequency') {
      if (strValue.includes('day') || strValue.includes('hour')) return 'Elite';
      if (strValue.includes('week')) return 'High';
      if (strValue.includes('month')) return 'Medium';
      return 'Low';
    } else {
      const numValue = parseFloat(strValue) || 0;
      const elite = parseFloat(category.elite) || 0;
      const high = parseFloat(category.high) || 0;
      const medium = parseFloat(category.medium) || 0;
      if (numValue <= elite || numValue <= high) return 'Elite';
      if (numValue <= medium) return 'High';
      return 'Medium';
    }
  };

  // DORA 指标列定义
  const metricColumns = [
    {
      title: '指标',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: MetricRow) => (
        <Space>
          {record.icon}
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '当前值',
      dataIndex: 'currentValue',
      key: 'currentValue',
      render: (value: unknown, record: MetricRow) => (
        <Text strong style={{ color: record.trend === 'up' ? colors.success[500] : colors.warning[500] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => {
        const colorMap: Record<string, string> = {
          Elite: colors.success[500],
          High: colors.primary[500],
          Medium: colors.warning[500],
          Low: colors.error[400],
        };
        return <Tag color={colorMap[level]}>{level}</Tag>;
      },
    },
    {
      title: 'Benchmark',
      key: 'benchmark',
      render: (_: unknown, record: MetricRow) => {
        if (!benchmarks) return '-';
        const benchmarkKey = record.benchmarkKey;
        const category = (benchmarks as unknown as Record<string, DoraBenchmarkCategory>)[benchmarkKey];
        if (!category) return '-';
        return (
          <Space direction="vertical" size={0}>
            <Text><Tag color="colors.success[500]">Elite</Tag> {category.elite}</Text>
            <Text><Tag color="colors.primary[500]">High</Tag> {category.high}</Text>
            <Text><Tag color="colors.warning[500]">Med</Tag> {category.medium}</Text>
          </Space>
        );
      },
    },
  ];

  const doraMetricsData = doraMetrics
    ? [
        {
          key: 'deploymentFrequency',
          name: '发布频率',
          icon: <ThunderboltOutlined />,
          currentValue: doraMetrics.metrics?.deploymentFrequency || '-',
          trend: 'up',
          level: getLevel(doraMetrics.metrics?.deploymentFrequency, 'deploymentFrequency'),
          benchmarkKey: 'deploymentFrequency',
        },
        {
          key: 'leadTimeForChanges',
          name: '变更前置时间',
          icon: <ClockCircleOutlined />,
          currentValue: `${doraMetrics.metrics?.leadTimeForChanges || '-'} 小时`,
          trend: 'down',
          level: getLevel(doraMetrics.metrics?.leadTimeForChanges, 'leadTimeForChanges'),
          benchmarkKey: 'leadTimeForChanges',
        },
        {
          key: 'changeFailureRate',
          name: '变更失败率',
          icon: <CloseCircleOutlined />,
          currentValue: `${(doraMetrics.metrics?.changeFailureRate || 0).toFixed(1)}%`,
          trend: 'down',
          level: getLevel(doraMetrics.metrics?.changeFailureRate, 'changeFailureRate'),
          benchmarkKey: 'changeFailureRate',
        },
        {
          key: 'meanTimeToRecovery',
          name: '服务恢复时间',
          icon: <CheckCircleOutlined />,
          currentValue: `${doraMetrics.metrics?.meanTimeToRecovery || '-'} 分钟`,
          trend: 'down',
          level: getLevel(doraMetrics.metrics?.meanTimeToRecovery, 'meanTimeToRecovery'),
          benchmarkKey: 'meanTimeToRecovery',
        },
      ]
    : [];

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ThunderboltOutlined style={{ marginRight: 8 }} />
          效能看板
        </Title>
        <Text type="secondary">DORA 指标追踪与团队效能分析</Text>
      </div>

      {/* DORA 指标卡片 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>核心指标</Title>
        <DashboardLayout columns={4} gap={16}>
          <MetricCard
            title="发布频率"
            value={dashboardData?.dora?.deploymentFrequency || '-'}
            unit="次/周"
            trend="up"
            trendPercent={12.5}
            previousValue={156}
            loading={loading}
          />
          <MetricCard
            title="变更前置时间"
            value={dashboardData?.dora?.leadTime || '-'}
            unit="小时"
            trend="down"
            trendPercent={18.2}
            previousValue={28}
            loading={loading}
          />
          <MetricCard
            title="服务恢复时间"
            value={dashboardData?.dora?.mttr || '-'}
            unit="分钟"
            trend="down"
            trendPercent={25.0}
            previousValue={60}
            loading={loading}
          />
          <MetricCard
            title="变更失败率"
            value={dashboardData?.dora?.changeFailureRate || '-'}
            unit="%"
            trend="down"
            trendPercent={2.1}
            previousValue={8.5}
            loading={loading}
          />
        </DashboardLayout>
      </div>

      {/* Tab 切换 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="总览" key="overview">
          {/* DORA 指标明细表 */}
          <Card title="DORA 指标详情" style={{ marginBottom: 16 }}>
            <Table
              columns={metricColumns}
              dataSource={doraMetricsData}
              rowKey="key"
              pagination={false}
              size="small"
              loading={loading}
            />
          </Card>

          {/* ClickHouse 状态 */}
          <Card title="数据同步状态" style={{ marginBottom: 16 }}>
            <Space size="large">
              <div>
                <Text type="secondary">ClickHouse:</Text>{' '}
                <Tag color={clickHouseStatus?.connected ? 'green' : 'red'}>
                  {clickHouseStatus?.connected ? '已连接' : '未连接'}
                </Tag>
              </div>
              <div>
                <Text type="secondary">同步记录:</Text>{' '}
                <Text strong>{clickHouseStatus?.syncedRecords || 0}</Text>
              </div>
              <div>
                <Text type="secondary">最后同步:</Text>{' '}
                {clickHouseStatus?.lastSyncAt ? new Date(clickHouseStatus.lastSyncAt).toLocaleString() : '从未'}
              </div>
            </Space>
          </Card>

          {/* 改进建议 */}
          <Card title="改进建议">
            <div style={{ padding: '12px 16px', background: 'rgba(24, 144, 255, 0.04)', borderRadius: 8, borderLeft: `3px solid ${colors.primary[500]}` }}>
              <Space>
                <TrophyOutlined style={{ color: colors.primary[500] }} />
                <Text>
                  {dashboardData?.dora?.deploymentFrequency && dashboardData.dora.deploymentFrequency < 10
                    ? '建议提高发布频率，向 Elite 级别（每天多次）看齐'
                    : '保持当前发布频率，继续优化其他指标'}
                </Text>
              </Space>
            </div>
          </Card>
        </TabPane>

        <TabPane tab="团队对比" key="teams">
          <Card title="团队效能对比">
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">团队对比功能开发中...</Text>
            </div>
          </Card>
        </TabPane>

        <TabPane tab="趋势分析" key="trend">
          <Card title="近 12 周趋势">
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">图表加载中...（集成 ECharts）</Text>
            </div>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default EfficiencyDashboard;
