/**
 * EngineerDashboardBuilder - Computes engineer personal dashboard
 *
 * Extracted from TicketBIService.getEngineerDashboard(). Provides:
 * - Personal overview (resolved count, avg resolution, SLA, rank)
 * - Personal time-series trend
 * - Strengths (categories where engineer excels)
 * - Weaknesses (categories needing improvement)
 * - Active tickets with SLA remaining time
 *
 * Stateless computation: takes data context + options, returns result.
 */

import type {
  Ticket,
  TicketSLA,
  DispatchResult,
  EngineerProfile,
  EngineerDashboard,
  TimeGranularity,
} from '../../types';
import type { BIDataContext } from './BIDataContext';
import { createBuckets, filterByPeriod, getDefaultStart } from './TimeSeriesUtils';
import { computeSLARate, buildSLAMap } from './SLAUtils';
import { computeEngineerEfficiency, computeProficiencyScore, computePerformanceGrade } from './EngineerMetricsCalculator';

/** Options for engineer dashboard computation */
export interface EngineerDashboardOptions {
  periodStart?: Date;
  periodEnd?: Date;
  granularity?: TimeGranularity;
}

/** Compute engineer dashboard from data context */
export function buildEngineerDashboard(
  engineerId: string,
  context: BIDataContext,
  options: EngineerDashboardOptions = {}
): EngineerDashboard | null {
  const start = options.periodStart ?? getDefaultStart();
  const end = options.periodEnd ?? new Date();
  const granularity = options.granularity ?? 'day';

  const profile = context.engineerProfiles.get(engineerId);
  if (!profile) return null;

  // Get tickets assigned to this engineer
  const engineerTickets = context.tickets.filter((t) => t.assignee === engineerId);
  const engineerResolved = engineerTickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );
  const engineerActive = engineerTickets.filter(
    (t) => ['open', 'assigned', 'in-progress'].includes(t.status)
  );

  const resolutionHours = engineerResolved.map(
    (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
  );
  const avgResHours =
    resolutionHours.length > 0
      ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length
      : 0;

  // SLA compliance
  const slaMap = buildSLAMap(context.slaRecords);
  const slaRate = computeSLARate(engineerTickets, slaMap);

  // Performance grade and rank
  const metrics = computeEngineerEfficiency({ engineerId, context, granularity, start, end });
  const allMetrics = computeAllEngineerMetrics(start, end, context);
  const sorted = [...allMetrics].sort((a, b) => b.compositeScore - a.compositeScore);
  const rank = sorted.findIndex((m) => m.engineerId === engineerId) + 1;

  // Personal trend
  const buckets = createBuckets(start, end, granularity);
  const personalTrend = buckets.map((bucket) => {
    const bucketResolved = engineerResolved.filter(
      (t) => t.updatedAt >= bucket.start && t.updatedAt <= bucket.end
    );
    const hours = bucketResolved.map(
      (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
    );
    const avgHours =
      hours.length > 0 ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;

    // SLA compliant count in this bucket
    let bucketSLACompliant = 0;
    for (const t of bucketResolved) {
      const sla = slaMap.get(t.id);
      if (sla && !sla.breached) bucketSLACompliant++;
      else if (!sla) bucketSLACompliant++;
    }

    // Received (dispatched to engineer in this bucket)
    const received = context.dispatchResults.filter(
      (d) =>
        d.assignee === engineerId &&
        d.dispatchedAt >= bucket.start &&
        d.dispatchedAt <= bucket.end
    ).length;

    return {
      period: bucket.label,
      resolved: bucketResolved.length,
      avgResolutionHours: Math.round(avgHours * 100) / 100,
      slaCompliant: bucketSLACompliant,
      received,
    };
  });

  // Strengths and weaknesses by category
  const categoryData: Record<
    string,
    { resolved: number; hours: number[]; slaCompliant: number; slaTotal: number }
  > = {};

  for (const t of engineerResolved) {
    if (!categoryData[t.category]) {
      categoryData[t.category] = { resolved: 0, hours: [], slaCompliant: 0, slaTotal: 0 };
    }
    categoryData[t.category].resolved++;
    categoryData[t.category].hours.push(
      (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
    );

    const sla = slaMap.get(t.id);
    categoryData[t.category].slaTotal++;
    if (sla && !sla.breached) categoryData[t.category].slaCompliant++;
    else if (!sla) categoryData[t.category].slaCompliant++;
  }

  const strengths: EngineerDashboard['strengths'] = [];
  const weaknesses: EngineerDashboard['weaknesses'] = [];

  const globalAvgHours =
    resolutionHours.length > 0
      ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length
      : 0;

  for (const [cat, data] of Object.entries(categoryData)) {
    const avgH = data.hours.length > 0 ? data.hours.reduce((a, b) => a + b, 0) / data.hours.length : 0;
    const slaRateCat = data.slaTotal > 0 ? (data.slaCompliant / data.slaTotal) * 100 : 100;
    const proficiencyScore = computeProficiencyScore(data.resolved, avgH, slaRateCat);

    if (avgH <= globalAvgHours * 0.8 && slaRateCat >= 85 && data.resolved >= 2) {
      strengths.push({
        category: cat,
        resolvedCount: data.resolved,
        avgResolutionHours: Math.round(avgH * 100) / 100,
        slaComplianceRate: Math.round(slaRateCat * 100) / 100,
        proficiencyScore: Math.round(proficiencyScore * 100) / 100,
      });
    }

    if (avgH > globalAvgHours * 1.3 && data.resolved >= 1) {
      const suggestion = generateWeaknessSuggestion(cat, avgH, slaRateCat);
      weaknesses.push({
        category: cat,
        resolvedCount: data.resolved,
        avgResolutionHours: Math.round(avgH * 100) / 100,
        slaComplianceRate: Math.round(slaRateCat * 100) / 100,
        suggestion,
      });
    }
  }

  // Sort strengths by proficiency descending
  strengths.sort((a, b) => b.proficiencyScore - a.proficiencyScore);
  // Sort weaknesses by resolution hours descending (worst first)
  weaknesses.sort((a, b) => b.avgResolutionHours - a.avgResolutionHours);

  // Active tickets
  const now = new Date();
  const activeTickets = engineerActive.map((t) => {
    const assignedAt = t.updatedAt;
    const elapsedHours = (now.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
    const sla = slaMap.get(t.id);
    const slaRemainingMs = sla
      ? sla.targetResolutionTimeMs - (now.getTime() - t.createdAt.getTime())
      : 24 * 60 * 60 * 1000 - (now.getTime() - t.createdAt.getTime());
    const slaRemainingHours = slaRemainingMs / (1000 * 60 * 60);

    return {
      ticketId: t.id,
      title: t.title,
      priority: t.priority,
      category: t.category,
      status: t.status,
      assignedAt,
      elapsedHours: Math.round(elapsedHours * 100) / 100,
      slaRemainingHours: Math.round(slaRemainingHours * 100) / 100,
      isOverdue: slaRemainingHours < 0,
    };
  });

  return {
    personalOverview: {
      engineerId,
      engineerName: profile.name,
      currentLoad: profile.currentLoad,
      totalResolved: engineerResolved.length,
      avgResolutionTimeHours: Math.round(avgResHours * 100) / 100,
      slaComplianceRate: Math.round(slaRate * 100) / 100,
      performanceGrade: metrics.performanceGrade,
      rank: rank > 0 ? rank : 1,
      totalInTeam: allMetrics.length,
    },
    personalTrend,
    strengths,
    weaknesses,
    activeTickets,
  };
}

// ==================== Private Helpers ====================

/** Compute all engineer metrics for ranking */
function computeAllEngineerMetrics(
  start: Date,
  end: Date,
  context: BIDataContext
): { engineerId: string; compositeScore: number }[] {
  const engineerIds = new Set<string>();

  for (const t of context.tickets) {
    if (t.assignee) engineerIds.add(t.assignee);
  }
  for (const d of context.dispatchResults) {
    engineerIds.add(d.assignee);
  }
  for (const id of context.engineerProfiles.keys()) {
    engineerIds.add(id);
  }

  return Array.from(engineerIds).map((id) => {
    const result = computeEngineerEfficiency({ engineerId: id, context, start, end });
    return {
      engineerId: id,
      compositeScore: result.compositeScore,
    };
  });
}

/** Generate weakness suggestion for a category */
function generateWeaknessSuggestion(category: string, avgHours: number, slaRate: number): string {
  if (avgHours > 48) {
    return `Resolution time in ${category} is very high. Consider training or pairing with a senior engineer.`;
  }
  if (slaRate < 70) {
    return `SLA compliance in ${category} is low. Review SLA targets and prioritize tickets in this category.`;
  }
  if (avgHours > 12) {
    return `Consider improving efficiency in ${category}. Review common patterns and create runbooks.`;
  }
  return `Below threshold performance`;
}
