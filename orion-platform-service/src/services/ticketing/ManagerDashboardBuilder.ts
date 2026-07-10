/**
 * ManagerDashboardBuilder - Computes manager/team-level BI dashboard
 *
 * Extracted from TicketBIService.getManagerDashboard(). Provides:
 * - Team overview (resolved count, avg resolution time, SLA, team load)
 * - Per-member metrics with efficiency scores
 * - Heatmap (day-of-week x hour-of-day)
 * - Week-over-week comparison
 * - Transfer analysis (reasons, most-transferred tickets)
 *
 * Stateless computation: takes data context + options, returns result.
 */

import type {
  Ticket,
  TicketSLA,
  DispatchResult,
  TransferRecord,
  EngineerProfile,
  ManagerDashboard,
  TimeGranularity,
} from '../../types';
import type { BIDataContext } from './BIDataContext';
import { createBuckets, filterByPeriod, getDefaultStart } from './TimeSeriesUtils';
import { computeSLARate, buildSLAMap } from './SLAUtils';
import { computeEngineerEfficiency, computeProficiencyScore, computePerformanceGrade } from './EngineerMetricsCalculator';

/** Options for manager dashboard computation */
export interface ManagerDashboardOptions {
  periodStart?: Date;
  periodEnd?: Date;
}

/** Compute manager dashboard from data context */
export function buildManagerDashboard(
  context: BIDataContext,
  options: ManagerDashboardOptions = {}
): ManagerDashboard {
  const start = options.periodStart ?? getDefaultStart();
  const end = options.periodEnd ?? new Date();

  const tickets = filterByPeriod(context.tickets, start, end);
  const slaMap = buildSLAMap(context.slaRecords);

  // ---- Team Overview ----
  const resolved = tickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );
  const resolutionHours = resolved.map(
    (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
  );
  const avgResHours =
    resolutionHours.length > 0
      ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length
      : 0;

  const slaDetails = computeSLADetails(tickets, slaMap);

  const teamLoadPct = context.engineerProfiles.size > 0
    ? (Array.from(context.engineerProfiles.values()).reduce(
        (sum, p) => sum + (p.currentLoad / p.maxCapacity) * 100,
        0
      ) / context.engineerProfiles.size)
    : 0;

  // ---- Member Metrics ----
  const memberMetrics = computeAllMemberMetrics(start, end, context);

  // ---- Heatmap ----
  const heatmap = computeHeatmap(tickets);

  // ---- Week Over Week ----
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const currentWeekStart = new Date(end.getTime() - weekMs);
  const previousWeekStart = new Date(currentWeekStart.getTime() - weekMs);

  const currentWeekTickets = filterByPeriod(context.tickets, currentWeekStart, end);
  const previousWeekTickets = filterByPeriod(context.tickets, previousWeekStart, currentWeekStart);

  const currentWeekCreated = currentWeekTickets.length;
  const previousWeekCreated = previousWeekTickets.length;
  const currentWeekResolved = currentWeekTickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  ).length;
  const previousWeekResolved = previousWeekTickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  ).length;

  const currentResTimes = currentWeekTickets
    .filter((t) => t.status === 'resolved' || t.status === 'closed')
    .map((t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60));
  const previousResTimes = previousWeekTickets
    .filter((t) => t.status === 'resolved' || t.status === 'closed')
    .map((t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60));

  const currentAvgRes = currentResTimes.length > 0
    ? currentResTimes.reduce((a, b) => a + b, 0) / currentResTimes.length
    : 0;
  const previousAvgRes = previousResTimes.length > 0
    ? previousResTimes.reduce((a, b) => a + b, 0) / previousResTimes.length
    : 0;

  const computeWeekSLA = (tkts: Ticket[]): number => {
    const weekSlaMap = buildSLAMap(
      context.slaRecords.filter((s) => tkts.some((t) => t.id === s.ticketId))
    );
    return computeSLARate(tkts, weekSlaMap);
  };

  const currentSLA = computeWeekSLA(currentWeekTickets);
  const previousSLA = computeWeekSLA(previousWeekTickets);

  const weekOverWeek = {
    ticketsCreatedChange:
      previousWeekCreated > 0
        ? ((currentWeekCreated - previousWeekCreated) / previousWeekCreated) * 100
        : 0,
    resolvedChange:
      previousWeekResolved > 0
        ? ((currentWeekResolved - previousWeekResolved) / previousWeekResolved) * 100
        : 0,
    avgResolutionTimeChange:
      previousAvgRes > 0
        ? ((currentAvgRes - previousAvgRes) / previousAvgRes) * 100
        : 0,
    slaComplianceChange: Math.round((currentSLA - previousSLA) * 100) / 100,
  };

  // ---- Transfer Analysis ----
  const transfersInPeriod = context.transferRecords.filter(
    (tr) => tr.transferredAt >= start && tr.transferredAt <= end
  );

  const ticketTransferCounts = new Map<string, number>();
  for (const tr of transfersInPeriod) {
    ticketTransferCounts.set(tr.ticketId, (ticketTransferCounts.get(tr.ticketId) || 0) + 1);
  }

  const transferReasonCounts: Record<string, number> = {};
  for (const tr of transfersInPeriod) {
    transferReasonCounts[tr.reason] = (transferReasonCounts[tr.reason] || 0) + 1;
  }

  const topTransferReasons = Object.entries(transferReasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const mostTransferredTickets = Array.from(ticketTransferCounts.entries())
    .map(([ticketId, transferCount]) => {
      const ticket = context.tickets.find((t) => t.id === ticketId);
      return {
        ticketId,
        title: ticket?.title || 'Unknown',
        transferCount,
      };
    })
    .sort((a, b) => b.transferCount - a.transferCount)
    .slice(0, 10);

  return {
    teamOverview: {
      totalTickets: tickets.length,
      resolvedCount: resolved.length,
      avgResolutionTimeHours: Math.round(avgResHours * 100) / 100,
      slaComplianceRate: slaDetails.total > 0 ? Math.round((slaDetails.compliant / slaDetails.total) * 10000) / 100 : 100,
      teamLoadPercentage: Math.round(teamLoadPct * 100) / 100,
    },
    memberMetrics,
    heatmap,
    weekOverWeek,
    transferAnalysis: {
      totalTransfers: transfersInPeriod.length,
      avgTransfersPerTicket:
        tickets.length > 0
          ? Math.round((transfersInPeriod.length / tickets.length) * 100) / 100
          : 0,
      topTransferReasons,
      mostTransferredTickets,
    },
    periodStart: start,
    periodEnd: end,
  };
}

// ==================== Private Helpers ====================

/** Compute per-member metrics */
function computeAllMemberMetrics(
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
    const metrics = computeEngineerEfficiency({ engineerId: id, context, start, end });
    const profile = context.engineerProfiles.get(id);
    if (profile) {
      return { ...metrics, engineerName: profile.name };
    }
    return { ...metrics, engineerName: id };
  });
}

/** Compute heatmap: day-of-week x hour-of-day */
function computeHeatmap(tickets: Ticket[]): { dayOfWeek: number; hourOfDay: number; ticketCount: number }[] {
  const heatmapMap = new Map<string, number>();

  for (const t of tickets) {
    const day = t.createdAt.getDay();
    const hour = t.createdAt.getHours();
    const key = `${day}-${hour}`;
    heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1);
  }

  return Array.from(heatmapMap.entries()).map(([key, count]) => {
    const [day, hour] = key.split('-').map(Number);
    return { dayOfWeek: day, hourOfDay: hour, ticketCount: count };
  });
}

/** Compute SLA compliance details */
function computeSLADetails(
  tickets: Ticket[],
  slaMap: Map<string, TicketSLA>
): { compliant: number; total: number } {
  let compliant = 0;
  let total = 0;

  for (const t of tickets) {
    const sla = slaMap.get(t.id);
    if (sla) {
      total++;
      if (!sla.breached) compliant++;
    } else if (t.status === 'resolved' || t.status === 'closed') {
      total++;
      compliant++;
    }
  }

  return { compliant, total };
}
