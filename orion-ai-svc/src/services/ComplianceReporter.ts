// orion-ai-svc/src/services/ComplianceReporter.ts

import { threatMonitor, type ThreatEvent } from './ThreatMonitor';
import { costTracker } from './CostTracker';

export interface ComplianceReport {
  id: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: {
    totalRequests: number;
    totalCost: number;
    totalThreats: number;
    resolvedThreats: number;
    securityScore: number;
  };
  costBreakdown: Record<string, number>;
  threatAnalysis: {
    byLevel: Record<string, number>;
    byType: Record<string, number>;
    trend: Array<{ date: string; count: number }>;
  };
  recommendations: string[];
}

export class ComplianceReporter {
  async generateReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    // 获取威胁统计
    const threatStats = await threatMonitor.getThreatStats(startDate, endDate);
    const threats = await threatMonitor.getThreats(startDate, endDate);

    // 获取成本统计
    const costByScenario = await costTracker.getCostByScenario(startDate, endDate);
    const costByProvider = await costTracker.getCostByProvider(startDate, endDate);

    // 计算安全评分 (0-100)
    const totalEvents = Math.max(threatStats.total, 1);
    const threatRate = threatStats.total / totalEvents;
    const resolvedRate = threatStats.resolved / totalEvents;
    const criticalWeight = threatStats.byLevel.critical * 10;
    const highWeight = threatStats.byLevel.high * 5;
    const securityScore = Math.max(0, Math.min(100,
      100 - (threatRate * 50) - (criticalWeight + highWeight) + (resolvedRate * 30)
    ));

    // 生成建议
    const recommendations: string[] = [];
    if (threatStats.byLevel.critical > 0) {
      recommendations.push('发现Critical级别威胁，建议立即处理');
    }
    if (threatStats.byLevel.high > 2) {
      recommendations.push('High级别威胁数量较多，建议加强监控');
    }
    if (threatStats.total > 0 && resolvedRate < 0.8) {
      recommendations.push('威胁解决率低于80%，建议优化响应流程');
    }
    const totalCost = Object.values(costByScenario).reduce((a, b) => a + b, 0);
    if (totalCost > 1000) {
      recommendations.push(`本月AI成本$${totalCost.toFixed(2)}，建议优化模型使用`);
    }
    if (recommendations.length === 0) {
      recommendations.push('安全状态良好，继续保持');
    }

    // 构建趋势数据
    const trend: Array<{ date: string; count: number }> = [];
    const dayMs = 24 * 60 * 60 * 1000;
    for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + dayMs)) {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const dayThreats = threats.filter(t => {
        const ts = new Date(t.timestamp);
        return ts >= dayStart && ts <= dayEnd;
      });
      trend.push({
        date: d.toISOString().split('T')[0],
        count: dayThreats.length,
      });
    }

    const report: ComplianceReport = {
      id: crypto.randomUUID(),
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary: {
        totalRequests: 0,
        totalCost,
        totalThreats: threatStats.total,
        resolvedThreats: threatStats.resolved,
        securityScore: Math.round(securityScore),
      },
      costBreakdown: { ...costByScenario, ...costByProvider },
      threatAnalysis: {
        byLevel: threatStats.byLevel as Record<string, number>,
        byType: threatStats.byType as Record<string, number>,
        trend,
      },
      recommendations,
    };

    return report;
  }

  async getSecurityScore(startDate: Date, endDate: Date): Promise<number> {
    const report = await this.generateReport(startDate, endDate);
    return report.summary.securityScore;
  }
}

export const complianceReporter = new ComplianceReporter();
