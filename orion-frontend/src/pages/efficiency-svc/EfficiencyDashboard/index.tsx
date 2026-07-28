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
import { Typography, Card, Table, Tag, Space, Tabs, message, Tooltip, Modal, Button, Select } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import MetricCard from '@/components/MetricCard';
import { TrendLineChart, BarChart } from '@/components/charts';
import type { TrendDataPoint } from '@/components/charts';
import {
  getDoraMetrics,
  getDoraBenchmarks,
  getEfficiencyDashboard,
  getClickHouseStatus,
  getTeams,
  getTeamComparison,
  getDORTrends,
} from '@/api/efficiency';
import type { TeamInfo, TeamMetrics } from '@/api/efficiency';
import { DORA_TOOLTIPS, STORAGE_KEYS, ONBOARDING_STEPS, DORA_LEVELS } from '@/constants/dora-guidance';

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
  trends?: {
    deploymentFrequency?: number;
    leadTime?: number;
    mttr?: number;
    changeFailureRate?: number;
  };
  summary?: {
    totalDeployments?: number;
    successfulDeployments?: number;
    failedDeployments?: number;
  };
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [teamComparison, setTeamComparison] = useState<TeamMetrics[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [trends, setTrends] = useState<TrendDataPoint[][] | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // Check if user has seen onboarding
  useEffect(() => {
    const hasSeen = localStorage.getItem(STORAGE_KEYS.hasSeenOnboarding);
    if (!hasSeen) {
      setShowOnboarding(true);
    }
  }, []);

  // Close onboarding and mark as seen
  const handleCloseOnboarding = () => {
    localStorage.setItem(STORAGE_KEYS.hasSeenOnboarding, 'true');
    setShowOnboarding(false);
  };

  const loadData = async () => {
    setLoading(true);
    setTrendsLoading(true);
    try {
      const [metricsRes, benchmarksRes, dashboardRes, statusRes, teamsRes, trendsRes] = await Promise.all([
        getDoraMetrics(),
        getDoraBenchmarks(),
        getEfficiencyDashboard(),
        getClickHouseStatus(),
        getTeams(),
        getDORTrends({ weeks: 12 }),
      ]);
      setDoraMetrics(metricsRes.data);
      setBenchmarks(benchmarksRes.data);
      setDashboardData(dashboardRes.data as unknown as EfficiencyDashboardData | null);
      setClickHouseStatus(statusRes.data);
      setTeams(teamsRes.data?.teams || []);

      // Map historical trends API response to chart format
      const trendResult = trendsRes.data as { trends?: Array<{ week: string; deploymentFrequency: number; leadTime: number; mttr: number; changeFailureRate: number }> } | undefined;
      if (trendResult?.trends && trendResult.trends.length > 0) {
        setTrends([
          trendResult.trends.map((t) => ({ period: t.week, value: t.deploymentFrequency, label: '部署频率' })),
          trendResult.trends.map((t) => ({ period: t.week, value: t.leadTime, label: '交付周期(h)' })),
          trendResult.trends.map((t) => ({ period: t.week, value: t.mttr, label: 'MTTR(h)' })),
        ]);
      } else {
        setTrends(null);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载效能数据失败';
      message.error(msg);
    } finally {
      setLoading(false);
      setTrendsLoading(false);
    }
  };

  // Load team comparison data
  const loadTeamComparison = async (teamIds?: string[]) => {
    setComparisonLoading(true);
    try {
      const res = await getTeamComparison({ teamIds: teamIds?.join(','), interval: 'weekly' });
      setTeamComparison(res.data?.teams || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载团队对比数据失败';
      message.error(msg);
    } finally {
      setComparisonLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load comparison when tab changes or teams are selected
  useEffect(() => {
    if (activeTab === 'teams') {
      loadTeamComparison(selectedTeams.length > 0 ? selectedTeams : undefined);
    }
  }, [activeTab, selectedTeams]);

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
        <Text
          strong
          style={{ color: record.trend === 'up' ? colors.success[500] : colors.warning[500] }}
        >
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
        const category = (benchmarks as unknown as Record<string, DoraBenchmarkCategory>)[
          benchmarkKey
        ];
        if (!category) return '-';
        return (
          <Space direction="vertical" size={0}>
            <Text>
              <Tag color="colors.success[500]">Elite</Tag> {category.elite}
            </Text>
            <Text>
              <Tag color="colors.primary[500]">High</Tag> {category.high}
            </Text>
            <Text>
              <Tag color="colors.warning[500]">Med</Tag> {category.medium}
            </Text>
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
      <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            效能看板
          </Title>
          <Text type="secondary">DORA 指标追踪与团队效能分析</Text>
        </div>
        <Tooltip title="查看帮助">
          <Button
            type="text"
            icon={<QuestionCircleOutlined />}
            onClick={() => setShowOnboarding(true)}
            style={{ fontSize: 18 }}
          />
        </Tooltip>
      </div>

      {/* DORA 指标卡片 */}
      <div style={{ marginBottom: spacing.md }}>
        <Title level={3} style={{ marginBottom: spacing.sm }}>核心指标</Title>
        <DashboardLayout columns={4} gap={16}>
          <MetricCard
            title="发布频率"
            value={dashboardData?.dora?.deploymentFrequency || '-'}
            unit="次/周"
            trend="up"
            trendPercent={12.5}
            previousValue={156}
            loading={loading}
            tooltip={DORA_TOOLTIPS.deploymentFrequency.description}
          />
          <MetricCard
            title="变更前置时间"
            value={dashboardData?.dora?.leadTime || '-'}
            unit="小时"
            trend="down"
            trendPercent={18.2}
            previousValue={28}
            loading={loading}
            tooltip={DORA_TOOLTIPS.leadTimeForChanges.description}
          />
          <MetricCard
            title="服务恢复时间"
            value={dashboardData?.dora?.mttr || '-'}
            unit="分钟"
            trend="down"
            trendPercent={25.0}
            previousValue={60}
            loading={loading}
            tooltip={DORA_TOOLTIPS.meanTimeToRecovery.description}
          />
          <MetricCard
            title="变更失败率"
            value={dashboardData?.dora?.changeFailureRate || '-'}
            unit="%"
            trend="down"
            trendPercent={2.1}
            previousValue={8.5}
            loading={loading}
            tooltip={DORA_TOOLTIPS.changeFailureRate.description}
          />
        </DashboardLayout>
      </div>

      {/* Tab 切换 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="总览" key="overview">
          {/* DORA 指标明细表 */}
          <Card title="DORA 指标详情" style={{ marginBottom: spacing.md }}>
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
          <Card title="数据同步状态" style={{ marginBottom: spacing.md }}>
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
                {clickHouseStatus?.lastSyncAt
                  ? new Date(clickHouseStatus.lastSyncAt).toLocaleString()
                  : '从未'}
              </div>
            </Space>
          </Card>

          {/* 改进建议 */}
          <Card title="改进建议">
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(24, 144, 255, 0.04)',
                borderRadius: 8,
                borderLeft: `3px solid ${colors.primary[500]}`,
              }}
            >
              <Space>
                <TrophyOutlined style={{ color: colors.primary[500] }} />
                <Text>
                  {dashboardData?.dora?.deploymentFrequency &&
                  dashboardData.dora.deploymentFrequency < 10
                    ? '建议提高发布频率，向 Elite 级别（每天多次）看齐'
                    : '保持当前发布频率，继续优化其他指标'}
                </Text>
              </Space>
            </div>
          </Card>
        </TabPane>

        <TabPane tab="团队对比" key="teams">
          <Card title="团队效能对比" style={{ marginBottom: spacing.md }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* 团队选择 */}
              <div>
                <Text type="secondary" style={{ marginRight: spacing.sm }}>选择对比团队：</Text>
                <Select
                  mode="multiple"
                  style={{ width: 400 }}
                  placeholder="选择要对比的团队"
                  value={selectedTeams}
                  onChange={(values) => setSelectedTeams(values)}
                  options={teams.map((t) => ({ label: t.teamName, value: t.teamId }))}
                  allowClear
                />
              </div>

              {/* 排名表格 */}
              {teamComparison.length > 0 && (
                <Table
                  dataSource={teamComparison}
                  rowKey="teamId"
                  loading={comparisonLoading}
                  pagination={false}
                  columns={[
                    {
                      title: '排名',
                      key: 'rank',
                      width: 60,
                      render: (_: unknown, __: unknown, index: number) => index + 1,
                    },
                    {
                      title: '团队',
                      dataIndex: 'teamName',
                      key: 'teamName',
                    },
                    {
                      title: '等级',
                      dataIndex: 'level',
                      key: 'level',
                      render: (level: string) => {
                        const levelInfo = DORA_LEVELS.find((l) => l.level === level);
                        return <Tag color={levelInfo?.color || colors.neutral[500]}>{levelInfo?.name || level}</Tag>;
                      },
                    },
                    {
                      title: '评分',
                      dataIndex: 'score',
                      key: 'score',
                      render: (score: number) => <Text strong>{score}</Text>,
                    },
                    {
                      title: '部署频率',
                      key: 'deploymentFrequency',
                      render: (record: TeamMetrics) => `${record.metrics.deploymentFrequency?.toFixed(1) || '-'} 次/周`,
                    },
                    {
                      title: '前置时间',
                      key: 'leadTime',
                      render: (record: TeamMetrics) =>
                        record.metrics.leadTimeMinutes ? `${record.metrics.leadTimeMinutes.toFixed(1)} min` : '-',
                    },
                    {
                      title: 'MTTR',
                      key: 'mttr',
                      render: (record: TeamMetrics) =>
                        record.metrics.mttrMinutes ? `${record.metrics.mttrMinutes.toFixed(1)} min` : '-',
                    },
                    {
                      title: '失败率',
                      key: 'failureRate',
                      render: (record: TeamMetrics) => `${record.metrics.changeFailureRate?.toFixed(1) || '-'}%`,
                    },
                  ]}
                />
              )}

              {/* 无数据提示 */}
              {teamComparison.length === 0 && !comparisonLoading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Text type="secondary">暂无团队数据，请等待部署记录积累</Text>
                </div>
              )}
            </Space>
          </Card>
        </TabPane>

        <TabPane tab="趋势分析" key="trend">
          <Card title="近 12 周趋势" style={{ marginBottom: spacing.md }}>
            <TrendLineChart
              title="DORA 指标趋势"
              data={trends || []}
              height={280}
              smooth={true}
              loading={trendsLoading}
            />
          </Card>
          <Card title="部署频率分布">
            <BarChart
              title="各团队部署次数"
              data={teamComparison.map((t) => ({
                label: t.teamName || t.teamId,
                value: t.metrics?.deploymentFrequency || 0,
              }))}
              height={200}
              loading={comparisonLoading}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* 新手引导 Modal */}
      <Modal
        title="效能看板入门指南"
        open={showOnboarding}
        onCancel={handleCloseOnboarding}
        footer={[
          <Button key="skip" onClick={handleCloseOnboarding}>
            以后再说
          </Button>,
          <Button key="start" type="primary" onClick={handleCloseOnboarding}>
            开始使用
          </Button>,
        ]}
        width={600}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {ONBOARDING_STEPS.map((step, index) => (
            <div
              key={index}
              style={{
                padding: '16px 0',
                borderBottom: index < ONBOARDING_STEPS.length - 1 ? '1px solid colors.neutral[200]' : 'none',
              }}
            >
              <Title level={5} style={{ marginBottom: spacing.sm }}>
                {index + 1}. {step.title}
              </Title>
              <Text style={{ whiteSpace: 'pre-wrap' }}>{step.content}</Text>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default EfficiencyDashboard;
