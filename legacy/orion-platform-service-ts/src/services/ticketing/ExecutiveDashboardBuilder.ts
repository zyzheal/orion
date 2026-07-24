// @ts-nocheck
/**
 * ExecutiveDashboardBuilder - Computes executive/manager-level BI dashboard
 *
 * Extracted from TicketBIService.getExecutiveDashboard(). Provides:
 * - Overview KPIs (total, resolved, open, resolution rate, SLA compliance)
 * - Time-series trends (volume, resolution time, SLA, team load)
 * - Team ranking (top/bottom performers)
 * - Alerts (SLA breaches, overdue, overloaded, unassigned)
 * - Distribution (by category, priority, source)
 *
 * Stateless computation: takes data context + options, returns result.
 */

import type {
  Ticket,
  TicketSLA,
  DispatchResult,
  EngineerProfile,
  ExecutiveDashboard,
  TimeGranularity,
} from '../../types';
import type { BIDataContext } from './BIDataContext';
import { createBuckets, formatPeriod, getDefaultStart, filterByPeriod } from './TimeSeriesUtils';
import { computeSLARate, buildSLAMap } from './SLAUtils';
import { computeEngineerEfficiency } from './EngineerMetricsCalculator';

/** Options for executive dashboard computation */
export interface ExecutiveDashboardOptions {
  periodStart?: Date;
  periodEnd?: Date;
  granularity?: TimeGranularity;
}

/** Compute executive dashboard from data context */
export function buildExecutiveDashboard(
  context: BIDataContext,
  options: ExecutiveDashboardOptions = {}
): ExecutiveDashboard {
  const start = options.periodStart ?? getDefaultStart();
  const end = options.periodEnd ?? new Date();
  const granularity = options.granularity ?? 'day';

  const tickets = filterByPeriod(context.tickets, start, end);
  const slaMap = buildSLAMap(context.slaRecords);

  // ---- Overview KPIs ----
  const resolvedTickets = tickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );
  const openTickets = tickets.filter(
    (t) => ['open', 'assigned', 'in-progress'].includes(t.status)
  );

  const resolutionTimes = resolvedTickets.map(
    (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
  );
  const avgResolutionHours =
    resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

  const slaComplianceRate = computeSLARate(tickets, slaMap);

  // Engineer counts
  const engineerIds = new Set(
    context.dispatchResults
      .filter((d) => d.dispatchedAt >= start && d.dispatchedAt <= end)
      .map((d) => d.assignee)
  );
  for (const t of tickets) {
    if (t.assignee) engineerIds.add(t.assignee);
  }
  const totalEngineers = context.engineerProfiles.size || engineerIds.size;
  const activeEngineers = engineerIds.size;

  // ---- Trends ----
  const buckets = createBuckets(start, end, granularity);

  const ticketVolumeTrend = buckets.map((bucket) => {
    const bucketTickets = filterByPeriod(context.tickets, bucket.start, bucket.end);
    const resolved = bucketTickets.filter(
      (t) =>
        (t.status === 'resolved' || t.status === 'closed') &&
        t.updatedAt >= bucket.start &&
        t.updatedAt <= bucket.end
    );
    return {
      period: bucket.label,
      created: bucketTickets.filter((t) => t.createdAt >= bucket.start && t.createdAt <= bucket.end).length,
      resolved: resolved.length,
      open: bucketTickets.filter(
        (t) => ['open', 'assigned', 'in-progress'].includes(t.status)
      ).length,
    };
  });

  const resolutionTimeTrend = buckets.map((bucket) => {
    const bucketResolved = context.tickets.filter(
      (t) =>
        (t.status === 'resolved' || t.status === 'closed') &&
        t.updatedAt >= bucket.start &&
        t.updatedAt <= bucket.end
    );
    const hours = bucketResolved.map(
      (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
    );
    const sorted = [...hours].sort((a, b) => a - b);
    return {
      period: bucket.label,
      avgHours: hours.length > 0 ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 100) / 100 : 0,
      medianHours: sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0,
    };
  });

  const slaComplianceTrend = buckets.map((bucket) => {
    const bucketTickets = filterByPeriod(context.tickets, bucket.start, bucket.end);
    const bucketSlaMap = buildSLAMap(
      context.slaRecords.filter((s) => {
        const ticket = context.tickets.find((t) => t.id === s.ticketId);
        return ticket && ticket.createdAt >= bucket.start && ticket.createdAt <= bucket.end;
      })
    );
    return {
      period: bucket.label,
      rate: computeSLARate(bucketTickets, bucketSlaMap),
    };
  });

  const teamLoadTrend = buckets.map((bucket) => {
    const active = context.tickets.filter(
      (t) =>
        ['open', 'assigned', 'in-progress'].includes(t.status) &&
        t.createdAt <= bucket.end
    );
    return {
      period: bucket.label,
      load: active.length,
    };
  });

  // ---- Team Ranking ----
  const engineerMetrics = getAllEngineerMetrics(start, end, context);
  const sorted = [...engineerMetrics].sort((a, b) => b.compositeScore - a.compositeScore);

  const topPerformers = sorted.slice(0, 5).map((m) => ({
    engineerId: m.engineerId,
    name: m.engineerName,
    score: m.compositeScore,
    resolved: m.workload.totalResolved,
  }));

  const bottomPerformers = sorted
    .filter((m) => m.compositeScore < 70)
    .slice(-5)
    .map((m) => ({
      engineerId: m.engineerId,
      name: m.engineerName,
      score: m.compositeScore,
      needsAttention: m.performanceGrade === 'D' || m.performanceGrade === 'F'
        ? `Performance grade ${m.performanceGrade}`
        : 'Below threshold performance',
    }));

  // ---- Alerts ----
  const slaBreachedCount = context.slaRecords.filter(
    (s) => s.breached && isTicketInPeriod(s.ticketId, start, end, context.tickets)
  ).length;

  const overdueTicketsCount = openTickets.filter((t) => {
    if (t.dueDate) return t.dueDate.getTime() < end.getTime();
    return end.getTime() - t.createdAt.getTime() > 24 * 60 * 60 * 1000;
  }).length;

  const overloadedEngineers = Array.from(context.engineerProfiles.values()).filter(
    (p) => p.currentLoad / p.maxCapacity > 0.8
  ).length;

  const unassignedOlderThan24h = openTickets.filter(
    (t) => !t.assignee && end.getTime() - t.createdAt.getTime() > 24 * 60 * 60 * 1000
  ).length;

  // ---- Distribution ----
  const byCategory: Record<string, { count: number; avgResolutionHours: number }> = {};
  const byPriority: Record<string, { count: number; resolved: number }> = {};
  const bySource: Record<string, number> = {};

  for (const t of tickets) {
    byCategory[t.category] = byCategory[t.category] || { count: 0, avgResolutionHours: 0 };
    byCategory[t.category].count++;

    byPriority[t.priority] = byPriority[t.priority] || { count: 0, resolved: 0 };
    byPriority[t.priority].count++;
    if (t.status === 'resolved' || t.status === 'closed') {
      byPriority[t.priority].resolved++;
    }

    bySource[t.source] = (bySource[t.source] || 0) + 1;
  }

  // Calculate avg resolution hours by category
  const categoryResTimes: Record<string, number[]> = {};
  for (const t of resolvedTickets) {
    const hours = (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
    categoryResTimes[t.category] = categoryResTimes[t.category] || [];
    categoryResTimes[t.category].push(hours);
  }
  for (const [cat, times] of Object.entries(categoryResTimes)) {
    if (byCategory[cat]) {
      byCategory[cat].avgResolutionHours = Math.round(
        (times.reduce((a, b) => a + b, 0) / times.length) * 100
      ) / 100;
    }
  }

  return {
    overview: {
      totalTickets: tickets.length,
      resolvedTickets: resolvedTickets.length,
      openTickets: openTickets.length,
      overallResolutionRate:
        tickets.length > 0 ? (resolvedTickets.length / tickets.length) * 100 : 0,
      avgResolutionTimeHours: Math.round(avgResolutionHours * 100) / 100,
      slaComplianceRate: Math.round(slaComplianceRate * 100) / 100,
      totalEngineers,
      activeEngineers,
    },
    trends: {
      ticketVolumeTrend,
      resolutionTimeTrend,
      slaComplianceTrend,
      teamLoadTrend,
    },
    teamRanking: { topPerformers, bottomPerformers },
    alerts: {
      slaBreachedCount,
      overdueTicketsCount,
      overloadedEngineers,
      unassignedOlderThan24h,
    },
    distribution: { byCategory, byPriority, bySource },
    periodStart: start,
    periodEnd: end,
  };
}

// ==================== Private Helpers ====================

/** Get all engineer efficiency metrics for ranking */
function getAllEngineerMetrics(
  start: Date,
  end: Date,
  context: BIDataContext
): ReturnType<typeof computeEngineerEfficiency>[] {
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
    const profile = context.engineerProfiles.get(id);
    const metrics = computeEngineerEfficiency({ engineerId: id, context, start, end });
    if (profile) {
      return { ...metrics, engineerName: profile.name };
    }
    return { ...metrics, engineerName: id };
  });
}

/** Check if a ticket falls within a period */
function isTicketInPeriod(ticketId: string, start: Date, end: Date, tickets: Ticket[]): boolean {
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) return false;
  return ticket.createdAt >= start && ticket.createdAt <= end;
}
