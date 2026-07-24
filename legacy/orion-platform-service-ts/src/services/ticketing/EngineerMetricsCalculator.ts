// @ts-nocheck
/**
 * EngineerMetricsCalculator - Per-engineer efficiency and performance computation
 *
 * Extracted from TicketBIService. Computes:
 * - EngineerEfficiencyMetrics (workload, efficiency, quality, collaboration)
 * - EfficiencyScore (4-dimensional composite score)
 * - Proficiency score for categories
 * - Performance grade
 */

import type {
  Ticket,
  TicketSLA,
  DispatchResult,
  TransferRecord,
  CommentRecord,
  EngineerProfile,
  EngineerEfficiencyMetrics,
  TimeGranularity,
} from '../../types';
import type { BIDataContext } from './BIDataContext';
import { computeSLARate, computeResolutionTimeStats } from './SLAUtils';

// ==================== Engineer Efficiency Metrics ====================

export interface EngineerMetricsInput {
  engineerId: string;
  context: BIDataContext;
  granularity?: TimeGranularity;
  start?: Date;
  end?: Date;
}

/** Compute full efficiency metrics for an engineer */
export function computeEngineerEfficiency(input: EngineerMetricsInput): EngineerEfficiencyMetrics {
  const { engineerId, context, granularity = 'day', start, end } = input;
  const periodStart = start ?? getDefaultStart();
  const periodEnd = end ?? new Date();

  const profile = context.engineerProfiles.get(engineerId);
  const engineerName = profile?.name || engineerId;

  // Get tickets for this engineer
  const engineerTickets = context.tickets.filter(
    (t) => t.assignee === engineerId && t.createdAt >= periodStart && t.createdAt <= periodEnd
  );
  const resolved = engineerTickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );
  const slaMap = new Map(context.slaRecords.map((s) => [s.ticketId, s]));

  // Workload
  const transfersGiven = context.transferRecords.filter(
    (tr) => tr.fromEngineer === engineerId && tr.transferredAt >= periodStart && tr.transferredAt <= periodEnd
  );
  const totalTransferred = transfersGiven.length;

  // Calculate avg active tickets
  const activeDays = countActiveDays(engineerId, periodStart, periodEnd, context.tickets);
  const avgActive =
    activeDays > 0
      ? engineerTickets.filter(
          (t) => ['open', 'assigned', 'in-progress'].includes(t.status)
        ).length / Math.max(activeDays, 1)
      : 0;

  // Peak concurrent (max open at any point)
  const peakConcurrent = computePeakConcurrent(engineerId, periodStart, periodEnd, context.tickets);

  // Efficiency metrics
  const resolutionTimes = resolved.map(
    (t) => t.updatedAt.getTime() - t.createdAt.getTime()
  );
  const sortedRes = [...resolutionTimes].sort((a, b) => a - b);

  const avgRes = sortedRes.length > 0
    ? sortedRes.reduce((a, b) => a + b, 0) / sortedRes.length
    : 0;
  const medianRes = sortedRes.length > 0 ? sortedRes[Math.floor(sortedRes.length / 2)] : 0;
  const p95Res = sortedRes.length > 0
    ? sortedRes[Math.min(Math.ceil(0.95 * sortedRes.length) - 1, sortedRes.length - 1)]
    : 0;

  // First response time (from dispatch results)
  const dispatches = context.dispatchResults.filter(
    (d) =>
      d.assignee === engineerId &&
      d.dispatchedAt >= periodStart && d.dispatchedAt <= periodEnd
  );

  // Transfer hold times
  const transferHoldTimes = transfersGiven
    .filter((tr) => tr.holdTimeMs !== undefined)
    .map((tr) => tr.holdTimeMs!);

  const avgTransferHold =
    transferHoldTimes.length > 0
      ? transferHoldTimes.reduce((a, b) => a + b, 0) / transferHoldTimes.length
      : 0;

  // Tickets per day
  const daysInPeriod = Math.max(
    1,
    (periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)
  );
  const ticketsPerDay = Math.round((resolved.length / daysInPeriod) * 100) / 100;

  // Quality
  let slaCompliant = 0;
  let slaTotal = 0;
  for (const t of resolved) {
    const sla = slaMap.get(t.id);
    if (sla) {
      slaTotal++;
      if (!sla.breached) slaCompliant++;
    } else {
      slaTotal++;
      slaCompliant++;
    }
  }

  // First-time resolve rate (no transfers)
  const ticketsWithTransfer = new Set(
    context.transferRecords
      .filter((tr) => tr.transferredAt >= periodStart && tr.transferredAt <= periodEnd)
      .map((tr) => tr.ticketId)
  );
  const firstTimeResolved = resolved.filter((t) => !ticketsWithTransfer.has(t.id)).length;
  const firstTimeResolveRate =
    resolved.length > 0 ? (firstTimeResolved / resolved.length) * 100 : 100;

  // Escalation rate
  const escalated = engineerTickets.filter((t) => t.escalationLevel > 0).length;
  const escalationRate =
    engineerTickets.length > 0 ? (escalated / engineerTickets.length) * 100 : 0;

  // Reopen rate (approximate)
  const reopened = 0;
  const reopenRate = resolved.length > 0 ? (reopened / resolved.length) * 100 : 0;

  // Customer satisfaction from profile
  const customerSatisfactionScore = profile?.resolutionStats?.satisfactionScore || 0;

  // Collaboration
  const transfersReceived = context.transferRecords.filter(
    (tr) => tr.toEngineer === engineerId && tr.transferredAt >= periodStart && tr.transferredAt <= periodEnd
  ).length;

  const commentsCount = context.commentRecords.filter(
    (c) =>
      c.authorId === engineerId &&
      c.createdAt >= periodStart && c.createdAt <= periodEnd
  ).length;

  // Backup coverage (approximated by transfers received)
  const backupCoverageCount = transfersReceived;

  // Composite score
  const scoreData = computeEfficiencyScore(engineerId, periodStart, periodEnd, context);

  // Performance grade
  const performanceGrade = computePerformanceGrade(scoreData.score);

  // Trend
  const trend = computeTrend(resolved, periodStart, periodEnd);

  const periodLabel = computePeriodLabel(periodStart, granularity);

  return {
    engineerId,
    engineerName,
    period: periodLabel,
    workload: {
      totalAssigned: engineerTickets.length,
      totalResolved: resolved.length,
      totalTransferred,
      avgActiveTickets: Math.round(avgActive * 100) / 100,
      peakConcurrent,
    },
    efficiency: {
      avgResolutionTimeMs: Math.round(avgRes),
      medianResolutionTimeMs: Math.round(medianRes),
      p95ResolutionTimeMs: Math.round(p95Res),
      avgFirstResponseTimeMs: 0,
      avgTransferHoldTimeMs: Math.round(avgTransferHold),
      ticketsPerDay,
    },
    quality: {
      slaComplianceRate: slaTotal > 0 ? Math.round((slaCompliant / slaTotal) * 10000) / 100 : 100,
      firstTimeResolveRate: Math.round(firstTimeResolveRate * 100) / 100,
      escalationRate: Math.round(escalationRate * 100) / 100,
      reopenRate: Math.round(reopenRate * 100) / 100,
      customerSatisfactionScore,
    },
    collaboration: {
      transfersReceived,
      transfersGiven: totalTransferred,
      backupCoverageCount,
      commentsCount,
    },
    compositeScore: Math.round(scoreData.score * 100) / 100,
    performanceGrade,
    trend,
  };
}

// ==================== Efficiency Score (4-dimensional) ====================

export interface EfficiencyScoreInput {
  engineerId: string;
  context: BIDataContext;
  start?: Date;
  end?: Date;
}

export interface EfficiencyScoreResult {
  score: number;
  breakdown: {
    workloadScore: number;
    efficiencyScore: number;
    qualityScore: number;
    teamworkScore: number;
  };
}

/** Compute 4-dimensional efficiency score for an engineer */
export function computeEfficiencyScore(
  engineerId: string,
  start: Date,
  end: Date,
  context: BIDataContext
): EfficiencyScoreResult {
  const profile = context.engineerProfiles.get(engineerId);
  const engineerTickets = context.tickets.filter(
    (t) => t.assignee === engineerId && t.createdAt >= start && t.createdAt <= end
  );
  const resolved = engineerTickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );

  // Workload Score (25%)
  const capacity = profile?.maxCapacity || 10;
  const utilizationScore = profile
    ? Math.min((profile.currentLoad / capacity) * 100, 100)
    : 50;
  const throughputScore = resolved.length > 0 ? Math.min(resolved.length * 5, 100) : 0;
  const workloadScore = utilizationScore * 0.4 + throughputScore * 0.6;

  // Efficiency Score (30%)
  const resolutionTimes = resolved.map(
    (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
  );
  const avgHours =
    resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

  // Score inversely proportional to avg hours (lower is better)
  // Assume 4 hours is excellent, 48 hours is poor
  const speedScore =
    avgHours > 0 ? Math.max(0, Math.min(100, (48 - avgHours) / 44 * 100)) : 50;

  const slaMap = new Map(context.slaRecords.map((s) => [s.ticketId, s]));
  const slaRate = computeSLARate(resolved, slaMap);
  const efficiencyScore = speedScore * 0.5 + slaRate * 0.5;

  // Quality Score (30%)
  const firstTimeResolveRate = computeFirstTimeResolveRate(resolved, start, end, context.transferRecords);
  const escalated = engineerTickets.filter((t) => t.escalationLevel > 0).length;
  const nonEscalationRate =
    engineerTickets.length > 0
      ? ((engineerTickets.length - escalated) / engineerTickets.length) * 100
      : 100;

  const reopenRate = 0;
  const nonReopenRate = 100 - reopenRate;
  const qualityScore = firstTimeResolveRate * 0.4 + nonEscalationRate * 0.3 + nonReopenRate * 0.3;

  // Teamwork Score (15%)
  const transfersReceived = context.transferRecords.filter(
    (tr) => tr.toEngineer === engineerId && tr.transferredAt >= start && tr.transferredAt <= end
  ).length;
  const transfersGiven = context.transferRecords.filter(
    (tr) => tr.fromEngineer === engineerId && tr.transferredAt >= start && tr.transferredAt <= end
  ).length;
  const commentsCount = context.commentRecords.filter(
    (c) => c.authorId === engineerId && c.createdAt >= start && c.createdAt <= end
  ).length;

  const totalTransfers = transfersReceived + transfersGiven;
  const balanceScore =
    totalTransfers > 0
      ? Math.min(
          100,
          (1 - Math.abs(transfersReceived - transfersGiven) / totalTransfers) * 100
        )
      : 50;
  const communicationScore = Math.min(commentsCount * 10, 100);
  const teamworkScore = balanceScore * 0.5 + communicationScore * 0.5;

  // Composite
  const compositeScore =
    workloadScore * 0.25 +
    efficiencyScore * 0.3 +
    qualityScore * 0.3 +
    teamworkScore * 0.15;

  return {
    score: Math.round(Math.min(Math.max(compositeScore, 0), 100) * 100) / 100,
    breakdown: {
      workloadScore: Math.round(Math.min(Math.max(workloadScore, 0), 100) * 100) / 100,
      efficiencyScore: Math.round(Math.min(Math.max(efficiencyScore, 0), 100) * 100) / 100,
      qualityScore: Math.round(Math.min(Math.max(qualityScore, 0), 100) * 100) / 100,
      teamworkScore: Math.round(Math.min(Math.max(teamworkScore, 0), 100) * 100) / 100,
    },
  };
}

// ==================== Performance Assessment ====================

/** Compute proficiency score for a category (0-100) */
export function computeProficiencyScore(resolvedCount: number, avgHours: number, slaRate: number): number {
  // Volume score (0-33): more is better, cap at 50 tickets
  const volumeScore = Math.min((resolvedCount / 50) * 33, 33);

  // Speed score (0-33): faster is better, cap at 24 hours
  const speedScore = avgHours > 0 ? Math.max(0, Math.min(33, (24 - avgHours) / 24 * 33)) : 33;

  // SLA score (0-34)
  const slaScore = (slaRate / 100) * 34;

  return volumeScore + speedScore + slaScore;
}

/** Generate weakness suggestion for a category */
export function generateWeaknessSuggestion(category: string, avgHours: number, slaRate: number): string {
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

/** Compute performance grade from composite score */
export function computePerformanceGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/** Get reason why engineer needs attention (for bottom performers) */
export function getNeedsAttentionReason(metrics: {
  compositeScore: number;
  workload: { totalResolved: number };
  efficiency?: { avgResolutionTimeMs: number };
  quality?: { slaComplianceRate: number };
}): string {
  const reasons: string[] = [];

  if (metrics.compositeScore < 60) {
    reasons.push('Overall performance below threshold');
  }
  if (metrics.workload.totalResolved < 5) {
    reasons.push('Low resolution throughput');
  }

  return reasons.length > 0 ? reasons.join('; ') : 'Below threshold performance';
}

// ==================== Helper Functions ====================

/** Get default start date (30 days ago) */
function getDefaultStart(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

/** Count active days for an engineer */
function countActiveDays(engineerId: string, start: Date, end: Date, tickets: Ticket[]): number {
  const days = new Set<string>();

  for (const t of tickets) {
    if (t.assignee === engineerId && t.createdAt >= start && t.createdAt <= end) {
      days.add(t.createdAt.toISOString().slice(0, 10));
    }
  }

  return days.size;
}

/** Compute peak concurrent tickets for an engineer */
function computePeakConcurrent(engineerId: string, start: Date, end: Date, tickets: Ticket[]): number {
  const engineerTickets = tickets.filter(
    (t) =>
      t.assignee === engineerId &&
      t.createdAt >= start &&
      t.createdAt <= end
  );

  if (engineerTickets.length === 0) return 0;

  // Create timeline events
  const events: { time: number; delta: number }[] = [];
  for (const t of engineerTickets) {
    events.push({ time: t.createdAt.getTime(), delta: 1 });
    if (t.status === 'resolved' || t.status === 'closed') {
      events.push({ time: t.updatedAt.getTime(), delta: -1 });
    } else {
      events.push({ time: end.getTime(), delta: -1 });
    }
  }

  events.sort((a, b) => a.time - b.time);

  let peak = 0;
  let current = 0;
  for (const event of events) {
    current += event.delta;
    peak = Math.max(peak, current);
  }

  return peak;
}

/** Compute first-time resolve rate (no transfers) */
function computeFirstTimeResolveRate(
  resolved: Ticket[],
  start: Date,
  end: Date,
  transferRecords: TransferRecord[]
): number {
  if (resolved.length === 0) return 100;

  const transferredTicketIds = new Set(
    transferRecords
      .filter((tr) => tr.transferredAt >= start && tr.transferredAt <= end)
      .map((tr) => tr.ticketId)
  );

  const firstTime = resolved.filter((t) => !transferredTicketIds.has(t.id)).length;
  return (firstTime / resolved.length) * 100;
}

/** Compute performance trend */
function computeTrend(resolved: Ticket[], start: Date, end: Date): 'improving' | 'stable' | 'declining' {
  if (resolved.length < 2) return 'stable';

  const midPoint = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
  const firstHalf = resolved.filter((t) => t.updatedAt >= start && t.updatedAt < midPoint);
  const secondHalf = resolved.filter((t) => t.updatedAt >= midPoint && t.updatedAt <= end);

  const firstHalfAvg = firstHalf.length > 0
    ? firstHalf.reduce((a, t) => a + (t.updatedAt.getTime() - t.createdAt.getTime()), 0) / firstHalf.length
    : 0;
  const secondHalfAvg = secondHalf.length > 0
    ? secondHalf.reduce((a, t) => a + (t.updatedAt.getTime() - t.createdAt.getTime()), 0) / secondHalf.length
    : 0;

  if (secondHalfAvg < firstHalfAvg * 0.9) return 'improving';
  if (secondHalfAvg > firstHalfAvg * 1.1) return 'declining';
  return 'stable';
}

/** Format a date as a period label */
function computePeriodLabel(date: Date, granularity: TimeGranularity): string {
  switch (granularity) {
    case 'hour':
      return date.toISOString().slice(0, 13);
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'week': {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().slice(0, 10);
    }
    case 'month':
      return date.toISOString().slice(0, 7);
    case 'quarter': {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    }
    case 'year':
      return date.getFullYear().toString();
    default:
      return date.toISOString().slice(0, 10);
  }
}
