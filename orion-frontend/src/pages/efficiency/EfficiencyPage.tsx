/**
 * EfficiencyPage (Phase 2)
 * 效能运营页 - DORA 指标面板、开发者画像、瓶颈分析
 *
 * Note: This is a focused version complementing EfficiencyDashboard, emphasizing
 * developer profiles and bottleneck analysis.
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Tabs,
  Table,
  Tag,
  Space,
  Button,
  message,
  Row,
  Col,
  Statistic,
  Progress,
  Avatar,
  Alert,
} from 'antd';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  UserOutlined,
  TeamOutlined,
  LineChartOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getDoraBenchmarks,
  getEfficiencyDashboard,
  getTeamComparison,
  getTeams,
} from '@/api/efficiency';
import type { TeamMetrics } from '@/api/efficiency';

const { Title, Text } = Typography;

// ---- DORA Metrics Tab ----

const DORAMetricsTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<{
    dora?: { deploymentFrequency?: string | number; leadTime?: number; mttr?: number; changeFailureRate?: number };
    summary?: { totalDeployments?: number; successfulDeployments?: number; failedDeployments?: number };
  } | null>(null);
  const [benchmarks, setBenchmarks] = useState<{
    deploymentFrequency?: { elite?: string; high?: string; medium?: string; low?: string };
    leadTimeForChanges?: { elite?: string; high?: string; medium?: string; low?: string };
    changeFailureRate?: { elite?: string; high?: string; medium?: string; low?: string };
    meanTimeToRecovery?: { elite?: string; high?: string; medium?: string; low?: string };
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, benchmarksRes] = await Promise.all([
        getEfficiencyDashboard(),
        getDoraBenchmarks(),
      ]);
      setDashboardData(dashboardRes.data?.data || null);
      setBenchmarks(benchmarksRes.data?.data || null);
    } catch (error: unknown) {
      message.error(`加载 DORA 指标失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">DORA 四大核心指标</Text>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>

      {/* Metric Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="发布频率"
              value={dora.deploymentFrequency || 0}
              suffix="次/周"
              prefix={<ThunderboltOutlined />}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color={levelColorMap[getLevel(typeof dora.deploymentFrequency === 'string' ? parseFloat(dora.deploymentFrequency) : dora.deploymentFrequency, 'deploymentFrequency')]}>
                {getLevel(typeof dora.deploymentFrequency === 'string' ? parseFloat(dora.deploymentFrequency) : dora.deploymentFrequency, 'deploymentFrequency')}
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
              valueStyle={{ color: (dora.leadTime || 0) <= 24 ? colors.success[500] : colors.warning[500] }}
            />
            <div style={{ marginTop: 8 }}>
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
              valueStyle={{ color: (dora.mttr || 0) <= 60 ? colors.success[500] : colors.error[400] }}
            />
            <div style={{ marginTop: 8 }}>
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
              valueStyle={{ color: (dora.changeFailureRate || 0) <= 5 ? colors.success[500] : colors.error[400] }}
            />
            <div style={{ marginTop: 8 }}>
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
              <Statistic title="成功部署" value={dashboardData.summary.successfulDeployments || 0} valueStyle={{ color: colors.success[500] }} prefix={<CheckCircleOutlined />} />
            </Col>
            <Col span={8}>
              <Statistic title="失败部署" value={dashboardData.summary.failedDeployments || 0} valueStyle={{ color: colors.error[400] }} prefix={<WarningOutlined />} />
            </Col>
          </Row>
          {dashboardData.summary.totalDeployments && dashboardData.summary.totalDeployments > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">成功率: </Text>
              <Progress
                percent={Math.round(((dashboardData.summary.successfulDeployments || 0) / dashboardData.summary.totalDeployments) * 100)}
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

// ---- Developer Profile Tab ----

const DeveloperProfileTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<DeveloperProfile[]>([]);

  interface DeveloperProfile {
    id: string;
    name: string;
    team: string;
    role: string;
    commits: number;
    prs: number;
    reviews: number;
    bugsFixed: number;
    avgReviewTime: number; // minutes
    avgPRSize: number; // lines
    codeQuality: number; // 0-100
    activeDays: number;
    specialty: string[];
  }

  // Mock data until backend provides this
  useEffect(() => {
    const timer = setTimeout(() => {
      setProfiles([
        { id: 'dev-001', name: '张三', team: '前端组', role: '高级工程师', commits: 234, prs: 45, reviews: 67, bugsFixed: 23, avgReviewTime: 15, avgPRSize: 120, codeQuality: 92, activeDays: 22, specialty: ['React', 'TypeScript', '微前端'] },
        { id: 'dev-002', name: '李四', team: '后端组', role: '中级工程师', commits: 189, prs: 38, reviews: 52, bugsFixed: 18, avgReviewTime: 22, avgPRSize: 200, codeQuality: 85, activeDays: 20, specialty: ['Go', 'gRPC', 'K8s'] },
        { id: 'dev-003', name: '王五', team: '平台组', role: '高级工程师', commits: 156, prs: 32, reviews: 89, bugsFixed: 12, avgReviewTime: 8, avgPRSize: 80, codeQuality: 95, activeDays: 21, specialty: ['CI/CD', 'Terraform', 'Platform'] },
        { id: 'dev-004', name: '赵六', team: 'QA组', role: '测试工程师', commits: 98, prs: 21, reviews: 134, bugsFixed: 45, avgReviewTime: 12, avgPRSize: 50, codeQuality: 88, activeDays: 22, specialty: ['自动化测试', '性能测试', 'Selenium'] },
        { id: 'dev-005', name: '孙七', team: 'SRE组', role: 'SRE 工程师', commits: 145, prs: 28, reviews: 41, bugsFixed: 31, avgReviewTime: 18, avgPRSize: 150, codeQuality: 90, activeDays: 21, specialty: ['Prometheus', 'Grafana', 'Incident'] },
        { id: 'dev-006', name: '周八', team: 'AI组', role: 'ML 工程师', commits: 112, prs: 19, reviews: 15, bugsFixed: 8, avgReviewTime: 30, avgPRSize: 350, codeQuality: 78, activeDays: 19, specialty: ['Python', 'TensorFlow', 'MLOps'] },
      ]);
      setLoading(false);
    }, 300);
    setLoading(true);
    return () => clearTimeout(timer);
  }, []);

  const columns = [
    {
      title: '开发者',
      key: 'name',
      width: 160,
      render: (_: unknown, record: DeveloperProfile) => (
        <Space>
          <Avatar style={{ backgroundColor: colors.primary[500] }} icon={<UserOutlined />}>{record.name.charAt(0)}</Avatar>
          <Space direction="vertical" size={0}>
            <Text strong>{record.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.role}</Text>
          </Space>
        </Space>
      ),
    },
    { title: '团队', dataIndex: 'team', key: 'team', width: 80 },
    { title: '提交数', dataIndex: 'commits', key: 'commits', width: 80, render: (v: number) => <Text strong>{v}</Text> },
    { title: 'PR数', dataIndex: 'prs', key: 'prs', width: 60 },
    { title: '评审数', dataIndex: 'reviews', key: 'reviews', width: 80 },
    { title: '修复Bug', dataIndex: 'bugsFixed', key: 'bugsFixed', width: 80, render: (v: number) => <Text style={{ color: colors.success[500] }}>{v}</Text> },
    { title: '平均评审时间', dataIndex: 'avgReviewTime', key: 'avgReviewTime', width: 120, render: (v: number) => `${v} 分钟` },
    {
      title: '代码质量',
      dataIndex: 'codeQuality',
      key: 'codeQuality',
      width: 120,
      render: (v: number) => (
        <Progress
          percent={v}
          size="small"
          strokeColor={v >= 90 ? colors.success[500] : v >= 80 ? colors.primary[500] : colors.warning[500]}
          style={{ width: 80 }}
        />
      ),
    },
    { title: '活跃天数', dataIndex: 'activeDays', key: 'activeDays', width: 80, render: (v: number) => `${v}/22` },
    {
      title: '专长',
      key: 'specialty',
      render: (_: unknown, record: DeveloperProfile) => (
        <Space wrap>
          {record.specialty.slice(0, 2).map((s: string, i: number) => (
            <Tag key={i} color="blue" style={{ fontSize: 11 }}>{s}</Tag>
          ))}
          {record.specialty.length > 2 && <Tag style={{ fontSize: 11 }}>+{record.specialty.length - 2}</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">开发者画像基于近期活动数据自动生成，用于识别效能瓶颈和优势</Text>
      </div>
      <Alert
        message="数据说明"
        description="开发者画像基于 Git 提交、PR 评审、Bug 修复等公开数据生成，仅用于团队效能分析，不作个人绩效考评依据"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Table columns={columns} dataSource={profiles} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10 }} />
    </div>
  );
};

// ---- Bottleneck Analysis Tab ----

const BottleneckAnalysisTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [bottlenecks, setBottlenecks] = useState<BottleneckItem[]>([]);
  const [teamComparison, setTeamComparison] = useState<TeamMetrics[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  interface BottleneckItem {
    id: string;
    category: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    metric: string;
    currentValue: string;
    targetValue: string;
    suggestion: string;
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setBottlenecks([
        { id: 'bn-001', category: '代码评审', description: 'PR 平均等待评审时间超过 4 小时', impact: 'high', metric: 'avg PR review wait time', currentValue: '4.2h', targetValue: '< 1h', suggestion: '增加 reviewer 数量或设置自动分配机制' },
        { id: 'bn-002', category: 'CI/CD', description: '构建失败率较高，平均每天 3 次构建失败', impact: 'high', metric: 'build failure rate', currentValue: '12%', targetValue: '< 5%', suggestion: '分析失败模式，增加 flaky test 检测' },
        { id: 'bn-003', category: '测试', description: '端到端测试耗时过长，阻塞部署流水线', impact: 'medium', metric: 'e2e test duration', currentValue: '45min', targetValue: '< 15min', suggestion: '拆分测试套件，并行执行' },
        { id: 'bn-004', category: '部署', description: '部署窗口集中，导致排队等待', impact: 'medium', metric: 'deploy queue time', currentValue: '2.5h', targetValue: '< 30min', suggestion: '实施自动化部署，减少手动干预' },
        { id: 'bn-005', category: '环境', description: '预发布环境不稳定，影响测试进度', impact: 'low', metric: 'env availability', currentValue: '85%', targetValue: '> 99%', suggestion: '使用临时环境 (Ephemeral Environments)' },
      ]);
      setLoading(false);
    }, 300);
    setLoading(true);
    return () => clearTimeout(timer);
  }, []);

  // Load team comparison
  const loadTeamComparison = async () => {
    setTeamLoading(true);
    try {
      const [teamsRes, comparisonRes] = await Promise.all([
        getTeams(),
        getTeamComparison({ interval: 'weekly' }),
      ]);
      const teamIds = teamsRes.data?.data?.teams?.map((t: { teamId: string }) => t.teamId) || [];
      if (teamIds.length > 0) {
        setTeamComparison(comparisonRes.data?.data?.teams || []);
      }
    } catch {
      setTeamComparison([]);
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    loadTeamComparison();
  }, []);

  const impactColorMap: Record<string, string> = {
    high: 'error',
    medium: 'warning',
    low: 'info',
  };

  const impactLabelMap: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };

  const bottleneckColumns = [
    { title: '瓶颈类别', dataIndex: 'category', key: 'category', width: 100, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '影响度',
      dataIndex: 'impact',
      key: 'impact',
      width: 80,
      render: (v: string) => <Tag color={impactColorMap[v]}>{impactLabelMap[v]}</Tag>,
    },
    { title: '当前值', dataIndex: 'currentValue', key: 'currentValue', width: 80, render: (v: string) => <Text type="danger">{v}</Text> },
    { title: '目标值', dataIndex: 'targetValue', key: 'targetValue', width: 80, render: (v: string) => <Text type="success">{v}</Text> },
    { title: '优化建议', dataIndex: 'suggestion', key: 'suggestion' },
  ];

  const teamColumns = [
    { title: '团队', dataIndex: 'teamName', key: 'teamName', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      render: (v: string) => <Tag color={v === 'elite' ? 'success' : v === 'high' ? 'blue' : v === 'medium' ? 'warning' : 'default'}>{v}</Tag>,
    },
    { title: '评分', dataIndex: 'score', key: 'score', render: (v: number) => <Text strong>{v}</Text> },
    { title: '部署频率', key: 'depFreq', render: (r: TeamMetrics) => `${r.metrics.deploymentFrequency?.toFixed(1)} 次/周` },
    { title: '前置时间', key: 'leadTime', render: (r: TeamMetrics) => r.metrics.leadTimeMinutes ? `${r.metrics.leadTimeMinutes} min` : '-' },
    { title: 'MTTR', key: 'mttr', render: (r: TeamMetrics) => r.metrics.mttrMinutes ? `${r.metrics.mttrMinutes} min` : '-' },
    { title: '失败率', key: 'failRate', render: (r: TeamMetrics) => `${r.metrics.changeFailureRate?.toFixed(1)}%` },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Bottleneck Table */}
      <Card title={<span><WarningOutlined style={{ color: colors.warning[500] }} /> 效能瓶颈分析</span>}>
        <Table columns={bottleneckColumns} dataSource={bottlenecks} rowKey="id" loading={loading} size="middle" pagination={false} />
      </Card>

      {/* Team Comparison */}
      <Card title={<span><TeamOutlined /> 团队效能对比</span>} extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadTeamComparison} loading={teamLoading}>刷新</Button>}>
        <Table columns={teamColumns} dataSource={teamComparison} rowKey="teamId" loading={teamLoading} size="middle" pagination={false} />
      </Card>

      {/* Recommendations */}
      <Card title={<span><LineChartOutlined /> 改进建议</span>}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="优先处理高影响度瓶颈"
            description="建议优先解决「代码评审等待时间」和「构建失败率」两个高影响度瓶颈，预计可提升整体交付效率 30% 以上"
            type="warning"
            showIcon
          />
          <Alert
            message="持续改进"
            description="建议建立定期效能回顾机制，每月分析 DORA 指标趋势，识别新的瓶颈"
            type="info"
            showIcon
          />
        </Space>
      </Card>
    </Space>
  );
};

// ---- Main Page ----

const EfficiencyPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dora');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <PageSkeleton rows={6} />;
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          效能运营
        </Title>
        <Text type="secondary">DORA 指标面板、开发者画像和效能瓶颈分析</Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab={<span><ThunderboltOutlined />DORA 指标</span>} key="dora">
          <DORAMetricsTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><UserOutlined />开发者画像</span>} key="profiles">
          <DeveloperProfileTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><LineChartOutlined />瓶颈分析</span>} key="bottlenecks">
          <BottleneckAnalysisTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default EfficiencyPage;
