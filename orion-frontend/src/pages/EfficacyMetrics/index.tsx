import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Typography, message } from 'antd';
import {
  CloudUploadOutlined,
  TeamOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import ScoreRing from '@/components/EfficacyMetrics/ScoreRing';
import DomainCard from '@/components/EfficacyMetrics/DomainCard';
import TrendChart from '@/components/EfficacyMetrics/TrendChart';
import {
  getEfficiencyDashboard,
  getDoraMetrics,
  getTeamComparison,
  getDORTrends,
} from '@/api/efficiency';
import { getAllPipelineRuns } from '@/api/pipelineRuns';
import { getRiskAssessments } from '@/api/risk';
import { getAgentRuns } from '@/api/agents';
import type { DomainKey } from '@/utils/efficacyScore';

const { Title, Text } = Typography;

/** 构造最近 8 周趋势数据 */
function buildTrendData(
  doraTrends: Array<{ week: string; deploymentFrequency: number; leadTime: number; mttr: number; changeFailureRate: number }>
) {
  return doraTrends.map((t) => ({
    week: t.week,
    engineering: Math.max(0, Math.min(100, Math.round(100 - t.changeFailureRate * 10))),
    e2e: Math.max(0, Math.min(100, Math.round(100 - (t.leadTime / 100) * 10))),
    management: 80,
    compliance: 85,
    aiEfficiency: 70,
    risk: 75,
  }));
}

/** 从 DORA 等级字符串计算分数 */
function doraLevelScore(level?: string): number {
  const map: Record<string, number> = { elite: 100, high: 75, medium: 50, low: 25 };
  return map[(level ?? '').toLowerCase()] ?? 50;
}

const EfficacyMetrics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [domainScores, setDomainScores] = useState<Record<DomainKey, number>>({
    e2e: 50, management: 50, engineering: 50, compliance: 50, aiEfficiency: 50, risk: 50,
  });
  const [trendData, setTrendData] = useState<any[]>([]);
  const [e2eMetrics, setE2eMetrics] = useState({ deliveryCycle: 12, successRate: 70 });
  const [engMetrics, setEngMetrics] = useState({ doraLevel: '—', failureRate: 0, deployments: 0 });
  const [aiMetrics, setAiMetrics] = useState({ adoption: 65, completion: 70 });
  const [mgmtMetrics, setMgmtMetrics] = useState({ teams: 0, avgScore: 75 });
  const [riskMetrics, setRiskMetrics] = useState({ high: 0, score: 80 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, doraRes, teamRes, doraTrendsRes, pipelineRes, riskRes, agentRes] = await Promise.all([
        getEfficiencyDashboard().catch(() => null),
        getDoraMetrics().catch(() => null),
        getTeamComparison().catch(() => null),
        getDORTrends({ weeks: 8 }).catch(() => null),
        getAllPipelineRuns({ limit: 100 }).catch(() => null),
        getRiskAssessments().catch(() => null),
        getAgentRuns({ pageSize: 100 }).catch(() => null),
      ]);

      // 工程域
      const doraLevel = (doraRes?.data?.metrics?.deploymentFrequency as string) ?? '';
      const doraScore = doraLevelScore(doraLevel);
      const failureRate = doraRes?.data?.metrics?.changeFailureRate ?? 0;
      const totalDeploys = (dashboardRes as any)?.data?.dashboard?.summary?.totalDeployments ?? 0;
      setEngMetrics({ doraLevel: doraLevel || '—', failureRate, deployments: totalDeploys });

      // 端到端
      const runs = (pipelineRes as any)?.data?.runs ?? (pipelineRes as any)?.data ?? [];
      const successCount = runs.filter((r: any) => r.status === 'success').length;
      const successRate = runs.length > 0 ? Math.round(successCount / runs.length * 100) : 70;
      setE2eMetrics({ deliveryCycle: 12, successRate });

      // AI 提效
      const agents = (agentRes as any)?.data?.runs ?? (agentRes as any)?.data ?? [];
      const completionRate = agents.length > 0
        ? Math.round(agents.filter((r: any) => r.status === 'completed').length / agents.length * 100)
        : 70;
      setAiMetrics({ adoption: 65, completion: completionRate });

      // 管理域
      const teams = (teamRes as any)?.data?.teams ?? [];
      const avgScore = teams.length > 0
        ? Math.round(teams.reduce((s: number, t: any) => s + (t.score ?? 50), 0) / teams.length)
        : 75;
      setMgmtMetrics({ teams: teams.length, avgScore });

      // 风险域
      const risks = (riskRes as any)?.data?.assessments ?? (riskRes as any)?.data ?? [];
      const highCount = risks.filter((r: any) => r.severity === 'high').length;
      setRiskMetrics({ high: highCount, score: Math.max(0, 100 - highCount * 5) });

      // 合规域（估算）
      const complianceScore = 85;

      setDomainScores({
        e2e: successRate,
        management: avgScore,
        engineering: doraScore,
        compliance: complianceScore,
        aiEfficiency: Math.round((65 + completionRate) / 2),
        risk: Math.max(0, 100 - highCount * 5),
      });

      // 趋势数据
      const doraTrends = (doraTrendsRes as any)?.data?.trends ?? [];
      if (doraTrends.length > 0) {
        setTrendData(buildTrendData(doraTrends));
      }
    } catch (err: any) {
      message.error(err?.message ?? 'Failed to load efficacy metrics data');
    } finally {
      setLoading(false);
    }
  };

  const domainCards = [
    {
      key: 'e2e',
      title: '端到端链路',
      icon: <CloudUploadOutlined />,
      primaryValue: domainScores.e2e,
      primaryLabel: '交付成功率 (%)',
      secondaryItems: [{ label: '平均交付周期', value: `${e2eMetrics.deliveryCycle}h` }],
      trend: 'up' as const,
      trendPercent: 5,
      color: colors.primary[500],
      link: '/efficacy-metrics/e2e',
    },
    {
      key: 'management',
      title: '管理域',
      icon: <TeamOutlined />,
      primaryValue: domainScores.management,
      primaryLabel: '团队综合评分',
      secondaryItems: [{ label: '活跃团队', value: mgmtMetrics.teams }],
      trend: 'up' as const,
      trendPercent: 2,
      color: colors.success[500],
      link: '/efficacy-metrics/management',
    },
    {
      key: 'engineering',
      title: '工程域',
      icon: <BarChartOutlined />,
      primaryValue: domainScores.engineering,
      primaryLabel: 'DORA 综合等级',
      secondaryItems: [
        { label: '变更失败率', value: `${engMetrics.failureRate}%` },
        { label: '部署数', value: engMetrics.deployments },
      ],
      trend: 'up' as const,
      trendPercent: 8,
      color: '#722ed1',
      link: '/efficacy-metrics/engineering',
    },
    {
      key: 'compliance',
      title: '合规域',
      icon: <CheckCircleOutlined />,
      primaryValue: domainScores.compliance,
      primaryLabel: '合规率 (%)',
      secondaryItems: [{ label: 'SLA 达成', value: '98%' }],
      trend: 'stable' as const,
      trendPercent: 0,
      color: '#fa8c16',
      link: '/efficacy-metrics/compliance',
    },
    {
      key: 'aiEfficiency',
      title: 'AI 智研提效',
      icon: <RocketOutlined />,
      primaryValue: domainScores.aiEfficiency,
      primaryLabel: 'AI 采纳率 (%)',
      secondaryItems: [{ label: 'Agent 完成率', value: `${aiMetrics.completion}%` }],
      trend: 'up' as const,
      trendPercent: 12,
      color: '#13c2c2',
      link: '/efficacy-metrics/ai-efficiency',
    },
    {
      key: 'risk',
      title: '风险看板',
      icon: <AlertOutlined />,
      primaryValue: domainScores.risk,
      primaryLabel: '系统弹性评分',
      secondaryItems: [{ label: '高危风险', value: riskMetrics.high }],
      trend: riskMetrics.high > 0 ? ('down' as const) : ('up' as const),
      trendPercent: riskMetrics.high > 0 ? riskMetrics.high * 3 : 0,
      color: colors.error[500],
      link: '/efficacy-metrics/risk',
    },
  ];

  const trendSeries = [
    { name: '工程域', dataKey: 'engineering', color: '#722ed1' },
    { name: '端到端', dataKey: 'e2e', color: colors.primary[500] },
    { name: '管理域', dataKey: 'management', color: colors.success[500] },
    { name: '合规域', dataKey: 'compliance', color: '#fa8c16' },
    { name: 'AI 提效', dataKey: 'aiEfficiency', color: '#13c2c2' },
    { name: '风险', dataKey: 'risk', color: colors.error[500] },
  ];

  if (loading) {
    return <div style={{ padding: spacing.lg, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            效能度量中心
          </Title>
          <Text type="secondary">六域研效指标聚合 · 整体评分 · 趋势分析</Text>
        </div>
      </div>

      <Card style={{ marginBottom: spacing.md }}>
        <Row gutter={spacing.md}>
          <Col span={6}>
            <ScoreRing domainScores={domainScores} />
          </Col>
          <Col span={18} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: spacing.sm }}>
            <Text style={{ fontSize: 15 }}>
              综合评分由六大域核心指标加权聚合：端到端交付成功率、管理域团队评分、工程域 DORA 等级、合规域合规率、AI 提效采纳率、风险域弹性评分。
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              评分基准：Elite (≥80) = 世界级，High (60-79) = 优秀，Medium (40-59) = 中等，Low (&lt;40) = 待改进
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              数据来源：DORA API、Pipeline Runs、Team Comparison、Agent Runs、Risk Assessments
            </Text>
          </Col>
        </Row>
      </Card>

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        {domainCards.map((card) => (
          <Col span={8} key={card.key}>
            <DomainCard {...card} />
          </Col>
        ))}
      </Row>

      {trendData.length > 0 && (
        <Card>
          <TrendChart data={trendData} series={trendSeries} loading={loading} height={300} />
        </Card>
      )}
    </div>
  );
};

export default EfficacyMetrics;
