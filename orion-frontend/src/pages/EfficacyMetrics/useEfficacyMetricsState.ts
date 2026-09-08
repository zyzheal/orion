/**
 * useEfficacyMetricsState.ts - 效能度量中心状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 212)
 */
import { useState, useEffect } from 'react';
import { message } from 'antd';
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

/** 构造最近 8 周趋势数据 */
function buildTrendData(
  doraTrends: Array<{
    week: string;
    deploymentFrequency: number;
    leadTime: number;
    mttr: number;
    changeFailureRate: number;
  }>
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

export function useEfficacyMetricsState() {
  const [loading, setLoading] = useState(true);
  const [domainScores, setDomainScores] = useState<Record<DomainKey, number>>({
    e2e: 50,
    management: 50,
    engineering: 50,
    compliance: 50,
    aiEfficiency: 50,
    risk: 50,
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
      const [dashboardRes, doraRes, teamRes, doraTrendsRes, pipelineRes, riskRes, agentRes] =
        await Promise.all([
          getEfficiencyDashboard().catch(() => null),
          getDoraMetrics().catch(() => null),
          getTeamComparison().catch(() => null),
          getDORTrends({ weeks: 8 }).catch(() => null),
          getAllPipelineRuns({ limit: 100 }).catch(() => null),
          getRiskAssessments().catch(() => null),
          getAgentRuns({ pageSize: 100 }).catch(() => null),
        ]);

      const doraLevel = (doraRes?.data?.metrics?.deploymentFrequency as string) ?? '';
      const doraScore = doraLevelScore(doraLevel);
      const failureRate = doraRes?.data?.metrics?.changeFailureRate ?? 0;
      const totalDeploys = (dashboardRes as any)?.data?.dashboard?.summary?.totalDeployments ?? 0;
      setEngMetrics({ doraLevel: doraLevel || '—', failureRate, deployments: totalDeploys });

      const runs = (pipelineRes as any)?.data?.runs ?? (pipelineRes as any)?.data ?? [];
      const successCount = runs.filter((r: any) => r.status === 'success').length;
      const successRate = runs.length > 0 ? Math.round((successCount / runs.length) * 100) : 70;
      setE2eMetrics({ deliveryCycle: 12, successRate });

      const agents = (agentRes as any)?.data?.runs ?? (agentRes as any)?.data ?? [];
      const completionRate =
        agents.length > 0
          ? Math.round(
              (agents.filter((r: any) => r.status === 'completed').length / agents.length) * 100
            )
          : 70;
      setAiMetrics({ adoption: 65, completion: completionRate });

      const teams = (teamRes as any)?.data?.teams ?? [];
      const avgScore =
        teams.length > 0
          ? Math.round(teams.reduce((s: number, t: any) => s + (t.score ?? 50), 0) / teams.length)
          : 75;
      setMgmtMetrics({ teams: teams.length, avgScore });

      const risks = (riskRes as any)?.data?.assessments ?? (riskRes as any)?.data ?? [];
      const highCount = risks.filter((r: any) => r.severity === 'high').length;
      setRiskMetrics({ high: highCount, score: Math.max(0, 100 - highCount * 5) });

      const complianceScore = 85;

      setDomainScores({
        e2e: successRate,
        management: avgScore,
        engineering: doraScore,
        compliance: complianceScore,
        aiEfficiency: Math.round((65 + completionRate) / 2),
        risk: Math.max(0, 100 - highCount * 5),
      });

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

  return {
    loading,
    domainScores,
    trendData,
    e2eMetrics,
    engMetrics,
    aiMetrics,
    mgmtMetrics,
    riskMetrics,
  };
}
