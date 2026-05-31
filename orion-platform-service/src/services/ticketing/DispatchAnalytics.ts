/**
 * TASK-802: Dispatch Analytics
 *
 * Tracks dispatch quality metrics, assignment success rates,
 * time-to-assignment statistics, and engineer performance data.
 */

import {
  DispatchResult,
  EngineerProfile,
  DispatchScoreBreakdown,
  TicketCategory,
  TicketPriority,
  Ticket,
} from './types';
import { DispatchEventRepository } from '../../repositories/DispatchEventRepository';

/**
 * Dispatch metrics summary
 */
export interface DispatchMetrics {
  /** Total dispatches */
  totalDispatches: number;
  /** Successful (accepted) dispatches */
  successfulDispatches: number;
  /** Failed (rejected/undone) dispatches */
  failedDispatches: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average dispatch score */
  avgDispatchScore: number;
  /** Median dispatch score */
  medianDispatchScore: number;
  /** P95 dispatch score */
  p95DispatchScore: number;
  /** Breakdown by dispatch type */
  byType: Record<string, { count: number; successRate: number }>;
  /** Breakdown by priority */
  byPriority: Record<TicketPriority, { count: number; avgScore: number; successRate: number }>;
  /** Breakdown by category */
  byCategory: Record<TicketCategory, { count: number; avgScore: number; successRate: number }>;
}

/**
 * Assignment success metrics
 */
export interface AssignmentSuccessMetrics {
  /** Total assignments tracked */
  totalAssignments: number;
  /** Accepted assignments */
  acceptedCount: number;
  /** Rejected assignments */
  rejectedCount: number;
  /** Reassigned after initial assignment */
  reassignedCount: number;
  /** Acceptance rate (0-1) */
  acceptanceRate: number;
  /** Rejection rate (0-1) */
  rejectionRate: number;
  /** Average time to acceptance */
  avgTimeToAcceptanceMs: number;
  /** Median time to acceptance */
  medianTimeToAcceptanceMs: number;
  /** P95 time to acceptance */
  p95TimeToAcceptanceMs: number;
}

/**
 * Time-to-assignment statistics
 */
export interface TimeToAssignmentStats {
  /** Overall average time to assignment */
  avgTimeToAssignmentMs: number;
  /** Median time to assignment */
  medianTimeToAssignmentMs: number;
  /** P95 time to assignment */
  p95TimeToAssignmentMs: number;
  /** P99 time to assignment */
  p99TimeToAssignmentMs: number;
  /** Fastest assignment */
  fastestAssignmentMs: number;
  /** Slowest assignment */
  slowestAssignmentMs: number;
  /** Breakdown by priority */
  byPriority: Record<TicketPriority, { avg: number; median: number; count: number }>;
  /** Breakdown by category */
  byCategory: Record<TicketCategory, { avg: number; median: number; count: number }>;
  /** Dispatches within SLA target */
  slaComplianceRate: number;
}

/**
 * Engineer performance data
 */
export interface EngineerPerformance {
  /** Engineer ID */
  engineerId: string;
  /** Engineer name */
  engineerName: string;
  /** Total tickets assigned */
  totalAssigned: number;
  /** Total tickets resolved */
  totalResolved: number;
  /** Average dispatch score when assigned */
  avgDispatchScore: number;
  /** Acceptance rate */
  acceptanceRate: number;
  /** Average time to accept assignment */
  avgAcceptanceTimeMs: number;
  /** SLA compliance rate for assigned tickets */
  slaComplianceRate: number;
  /** Average resolution time */
  avgResolutionTimeMs: number;
  /** Escalation rate */
  escalationRate: number;
  /** Performance grade (A-F) */
  performanceGrade: string;
}

/**
 * Dispatch event for time tracking
 */
interface DispatchEvent {
  ticketId: string;
  createdAt: Date;
  assignedAt?: Date;
  acceptedAt?: Date;
  resolvedAt?: Date;
  dispatchResult?: DispatchResult;
  priority: TicketPriority;
  category: TicketCategory;
}

/**
 * Dispatch Analytics Service
 *
 * Collects and analyzes dispatch quality data
 * to provide insights and performance metrics.
 */
export class DispatchAnalytics {
  /** Dispatch results */
  private dispatchResults: DispatchResult[] = [];

  /** Dispatch events for time tracking - migrated to repository */
  private eventRepository?: DispatchEventRepository;
  private dispatchEvents: Map<string, DispatchEvent> = new Map(); // in-memory cache

  /** Engineer profiles for context */
  private engineers: Map<string, EngineerProfile> = new Map();

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.eventRepository = new DispatchEventRepository(db);
    }
  }

  // ==================== Data Recording ====================

  /**
   * Record a dispatch result
   */
  recordDispatch(result: DispatchResult): void {
    this.dispatchResults.push({ ...result });

    // Update dispatch event
    const event = this.dispatchEvents.get(result.ticketId);
    if (event) {
      event.assignedAt = result.dispatchedAt;
      event.dispatchResult = result;
    }

    // Persist to repository
    if (this.eventRepository) {
      this.eventRepository.updateAssignment(
        result.ticketId,
        result.dispatchedAt,
        result as any
      ).catch(() => {/* ignore */});
    }
  }

  /**
   * Record ticket creation (start the clock)
   */
  recordTicketCreated(ticket: Ticket): void {
    this.dispatchEvents.set(ticket.id, {
      ticketId: ticket.id,
      createdAt: ticket.createdAt,
      priority: ticket.priority,
      category: ticket.category,
    });

    // Persist to repository
    if (this.eventRepository) {
      this.eventRepository.create({
        ticketId: ticket.id,
        priority: ticket.priority,
        category: ticket.category,
      }).catch(() => {/* ignore */});
    }
  }

  /**
   * Record dispatch acceptance
   */
  recordAcceptance(ticketId: string, acceptedAt?: Date): void {
    const event = this.dispatchEvents.get(ticketId);
    const acceptanceTime = acceptedAt || new Date();
    if (event) {
      event.acceptedAt = acceptanceTime;
    }

    // Update dispatch result
    const result = this.dispatchResults
      .slice()
      .reverse()
      .find((r) => r.ticketId === ticketId);
    if (result) {
      result.accepted = true;
      if (event?.acceptedAt) {
        result.timeToAcceptanceMs = event.acceptedAt.getTime() - result.dispatchedAt.getTime();
      }
    }

    // Persist to repository
    if (this.eventRepository) {
      this.eventRepository.updateAcceptance(ticketId, acceptanceTime).catch(() => {/* ignore */});
    }
  }

  /**
   * Record dispatch rejection
   */
  recordRejection(ticketId: string): void {
    const result = this.dispatchResults
      .slice()
      .reverse()
      .find((r) => r.ticketId === ticketId);
    if (result) {
      result.accepted = false;
    }
  }

  /**
   * Record ticket resolution
   */
  recordResolution(ticketId: string, resolvedAt?: Date): void {
    const resolutionTime = resolvedAt || new Date();
    const event = this.dispatchEvents.get(ticketId);
    if (event) {
      event.resolvedAt = resolutionTime;
    }

    // Persist to repository
    if (this.eventRepository) {
      this.eventRepository.updateResolution(ticketId, resolutionTime).catch(() => {/* ignore */});
    }
  }

  /**
   * Register an engineer profile
   */
  registerEngineer(profile: EngineerProfile): void {
    this.engineers.set(profile.id, profile);
  }

  // ==================== Dispatch Metrics ====================

  /**
   * Get comprehensive dispatch metrics
   */
  getDispatchMetrics(options?: {
    periodStart?: Date;
    periodEnd?: Date;
  }): DispatchMetrics {
    const results = this.filterByPeriod(options?.periodStart, options?.periodEnd);

    const total = results.length;
    const successful = results.filter((r) => r.accepted);
    const failed = results.filter((r) => !r.accepted);

    const scores = results.map((r) => r.score);

    // By type
    const byType: Record<string, { count: number; successRate: number }> = {};
    for (const r of results) {
      if (!byType[r.dispatchType]) {
        byType[r.dispatchType] = { count: 0, successRate: 0 };
      }
      byType[r.dispatchType].count++;
    }
    // Calculate success rates by type
    for (const type of Object.keys(byType)) {
      const typeResults = results.filter((r) => r.dispatchType === type);
      const typeAccepted = typeResults.filter((r) => r.accepted).length;
      byType[type].successRate = typeResults.length > 0 ? typeAccepted / typeResults.length : 0;
    }

    // By priority
    const byPriority: Record<TicketPriority, { count: number; avgScore: number; successRate: number }> = {
      critical: { count: 0, avgScore: 0, successRate: 0 },
      high: { count: 0, avgScore: 0, successRate: 0 },
      medium: { count: 0, avgScore: 0, successRate: 0 },
      low: { count: 0, avgScore: 0, successRate: 0 },
    };

    for (const r of results) {
      const breakdown = r.scoreBreakdown;
      if (breakdown) {
        // Infer priority from SLA urgency score
        if (breakdown.slaUrgencyScore >= 70) {
          byPriority.critical.count++;
          byPriority.critical.avgScore += r.score;
          if (r.accepted) byPriority.critical.successRate++;
        } else if (breakdown.slaUrgencyScore >= 50) {
          byPriority.high.count++;
          byPriority.high.avgScore += r.score;
          if (r.accepted) byPriority.high.successRate++;
        } else if (breakdown.slaUrgencyScore >= 30) {
          byPriority.medium.count++;
          byPriority.medium.avgScore += r.score;
          if (r.accepted) byPriority.medium.successRate++;
        } else {
          byPriority.low.count++;
          byPriority.low.avgScore += r.score;
          if (r.accepted) byPriority.low.successRate++;
        }
      }
    }

    // Normalize priority averages
    for (const p of Object.keys(byPriority) as TicketPriority[]) {
      if (byPriority[p].count > 0) {
        byPriority[p].avgScore = Math.round((byPriority[p].avgScore / byPriority[p].count) * 100) / 100;
        byPriority[p].successRate = byPriority[p].successRate / byPriority[p].count;
      }
    }

    // By category (from score breakdown)
    const byCategory: Record<TicketCategory, { count: number; avgScore: number; successRate: number }> = {
      infrastructure: { count: 0, avgScore: 0, successRate: 0 },
      application: { count: 0, avgScore: 0, successRate: 0 },
      database: { count: 0, avgScore: 0, successRate: 0 },
      network: { count: 0, avgScore: 0, successRate: 0 },
      security: { count: 0, avgScore: 0, successRate: 0 },
      deployment: { count: 0, avgScore: 0, successRate: 0 },
      pipeline: { count: 0, avgScore: 0, successRate: 0 },
      performance: { count: 0, avgScore: 0, successRate: 0 },
      cost: { count: 0, avgScore: 0, successRate: 0 },
      other: { count: 0, avgScore: 0, successRate: 0 },
    };

    // Use events to get category info
    for (const r of results) {
      const event = this.dispatchEvents.get(r.ticketId);
      if (event) {
        byCategory[event.category].count++;
        byCategory[event.category].avgScore += r.score;
        if (r.accepted) byCategory[event.category].successRate++;
      }
    }

    for (const cat of Object.keys(byCategory) as TicketCategory[]) {
      if (byCategory[cat].count > 0) {
        byCategory[cat].avgScore = Math.round((byCategory[cat].avgScore / byCategory[cat].count) * 100) / 100;
        byCategory[cat].successRate = byCategory[cat].successRate / byCategory[cat].count;
      }
    }

    return {
      totalDispatches: total,
      successfulDispatches: successful.length,
      failedDispatches: failed.length,
      successRate: total > 0 ? successful.length / total : 0,
      avgDispatchScore: scores.length > 0 ? this.calculateMean(scores) : 0,
      medianDispatchScore: scores.length > 0 ? this.calculateMedian(scores) : 0,
      p95DispatchScore: scores.length > 0 ? this.calculatePercentile(scores, 0.95) : 0,
      byType,
      byPriority,
      byCategory,
    };
  }

  // ==================== Assignment Success ====================

  /**
   * Get assignment success metrics
   */
  getAssignmentSuccess(options?: {
    periodStart?: Date;
    periodEnd?: Date;
  }): AssignmentSuccessMetrics {
    const results = this.filterByPeriod(options?.periodStart, options?.periodEnd);

    const accepted = results.filter((r) => r.accepted);
    const rejected = results.filter((r) => !r.accepted);
    const timesToAcceptance = accepted
      .map((r) => r.timeToAcceptanceMs)
      .filter((t): t is number => t !== undefined);

    // Count reassigned (tickets with multiple dispatch results)
    const ticketCounts = new Map<string, number>();
    for (const r of results) {
      ticketCounts.set(r.ticketId, (ticketCounts.get(r.ticketId) || 0) + 1);
    }
    const reassigned = Array.from(ticketCounts.values()).filter((c) => c > 1).length;

    return {
      totalAssignments: results.length,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      reassignedCount: reassigned,
      acceptanceRate: results.length > 0 ? accepted.length / results.length : 0,
      rejectionRate: results.length > 0 ? rejected.length / results.length : 0,
      avgTimeToAcceptanceMs: timesToAcceptance.length > 0 ? this.calculateMean(timesToAcceptance) : 0,
      medianTimeToAcceptanceMs: timesToAcceptance.length > 0 ? this.calculateMedian(timesToAcceptance) : 0,
      p95TimeToAcceptanceMs: timesToAcceptance.length > 0 ? this.calculatePercentile(timesToAcceptance, 0.95) : 0,
    };
  }

  // ==================== Time to Assignment ====================

  /**
   * Get time-to-assignment statistics
   */
  getTimeToAssignment(options?: {
    periodStart?: Date;
    periodEnd?: Date;
  }): TimeToAssignmentStats {
    let events = Array.from(this.dispatchEvents.values());

    // Filter by period
    if (options?.periodStart) {
      events = events.filter((e) => e.createdAt >= options.periodStart!);
    }
    if (options?.periodEnd) {
      events = events.filter((e) => e.createdAt <= options.periodEnd!);
    }

    // Only events that were assigned
    const assigned = events.filter((e) => e.assignedAt !== undefined);

    const assignmentTimes = assigned.map(
      (e) => e.assignedAt!.getTime() - e.createdAt.getTime()
    );

    // By priority
    const byPriority: Record<TicketPriority, { avg: number; median: number; count: number }> = {
      critical: { avg: 0, median: 0, count: 0 },
      high: { avg: 0, median: 0, count: 0 },
      medium: { avg: 0, median: 0, count: 0 },
      low: { avg: 0, median: 0, count: 0 },
    };

    for (const e of assigned) {
      const time = e.assignedAt!.getTime() - e.createdAt.getTime();
      byPriority[e.priority].count++;
      byPriority[e.priority].avg += time;
    }

    // Calculate medians per priority
    for (const p of Object.keys(byPriority) as TicketPriority[]) {
      const pEvents = assigned.filter((e) => e.priority === p);
      const pTimes = pEvents.map((e) => e.assignedAt!.getTime() - e.createdAt.getTime());
      if (pTimes.length > 0) {
        byPriority[p].avg = Math.round(byPriority[p].avg / pTimes.length);
        byPriority[p].median = this.calculateMedian(pTimes);
      }
    }

    // By category
    const byCategory: Record<TicketCategory, { avg: number; median: number; count: number }> = {
      infrastructure: { avg: 0, median: 0, count: 0 },
      application: { avg: 0, median: 0, count: 0 },
      database: { avg: 0, median: 0, count: 0 },
      network: { avg: 0, median: 0, count: 0 },
      security: { avg: 0, median: 0, count: 0 },
      deployment: { avg: 0, median: 0, count: 0 },
      pipeline: { avg: 0, median: 0, count: 0 },
      performance: { avg: 0, median: 0, count: 0 },
      cost: { avg: 0, median: 0, count: 0 },
      other: { avg: 0, median: 0, count: 0 },
    };

    for (const e of assigned) {
      const time = e.assignedAt!.getTime() - e.createdAt.getTime();
      byCategory[e.category].count++;
      byCategory[e.category].avg += time;
    }

    for (const cat of Object.keys(byCategory) as TicketCategory[]) {
      const cEvents = assigned.filter((e) => e.category === cat);
      const cTimes = cEvents.map((e) => e.assignedAt!.getTime() - e.createdAt.getTime());
      if (cTimes.length > 0) {
        byCategory[cat].avg = Math.round(byCategory[cat].avg / cTimes.length);
        byCategory[cat].median = this.calculateMedian(cTimes);
      }
    }

    // SLA compliance (assigned within 10% of total SLA time)
    let slaCompliant = 0;
    for (const e of assigned) {
      const totalTime = e.resolvedAt
        ? e.resolvedAt.getTime() - e.createdAt.getTime()
        : Date.now() - e.createdAt.getTime();
      const assignmentTime = e.assignedAt!.getTime() - e.createdAt.getTime();

      if (totalTime > 0 && assignmentTime / totalTime < 0.1) {
        slaCompliant++;
      }
    }

    return {
      avgTimeToAssignmentMs: assignmentTimes.length > 0 ? this.calculateMean(assignmentTimes) : 0,
      medianTimeToAssignmentMs: assignmentTimes.length > 0 ? this.calculateMedian(assignmentTimes) : 0,
      p95TimeToAssignmentMs: assignmentTimes.length > 0 ? this.calculatePercentile(assignmentTimes, 0.95) : 0,
      p99TimeToAssignmentMs: assignmentTimes.length > 0 ? this.calculatePercentile(assignmentTimes, 0.99) : 0,
      fastestAssignmentMs: assignmentTimes.length > 0 ? Math.min(...assignmentTimes) : 0,
      slowestAssignmentMs: assignmentTimes.length > 0 ? Math.max(...assignmentTimes) : 0,
      byPriority,
      byCategory,
      slaComplianceRate: assigned.length > 0 ? slaCompliant / assigned.length : 0,
    };
  }

  // ==================== Engineer Performance ====================

  /**
   * Get performance data for an engineer
   */
  getEngineerPerformance(engineerId: string): EngineerPerformance | null {
    const engineer = this.engineers.get(engineerId);
    if (!engineer) return null;

    const results = this.dispatchResults.filter((r) => r.assignee === engineerId);
    const assigned = results.length;
    const accepted = results.filter((r) => r.accepted).length;

    const scores = results.map((r) => r.score);
    const acceptanceTimes = results
      .filter((r) => r.timeToAcceptanceMs !== undefined)
      .map((r) => r.timeToAcceptanceMs!);

    // Get resolution data from engineer profile
    const stats = engineer.resolutionStats;

    // Calculate escalation rate
    const escalationRate = stats.totalResolved > 0
      ? stats.escalationCount / stats.totalResolved
      : 0;

    // Calculate performance grade
    const grade = this.calculatePerformanceGrade({
      acceptanceRate: assigned > 0 ? accepted / assigned : 0,
      slaComplianceRate: stats.slaComplianceRate,
      avgScore: scores.length > 0 ? this.calculateMean(scores) : 0,
      escalationRate,
    });

    return {
      engineerId,
      engineerName: engineer.name,
      totalAssigned: assigned,
      totalResolved: stats.totalResolved,
      avgDispatchScore: scores.length > 0 ? Math.round(this.calculateMean(scores) * 100) / 100 : 0,
      acceptanceRate: assigned > 0 ? accepted / assigned : 0,
      avgAcceptanceTimeMs: acceptanceTimes.length > 0 ? this.calculateMean(acceptanceTimes) : 0,
      slaComplianceRate: stats.slaComplianceRate,
      avgResolutionTimeMs: stats.avgResolutionTimeMs,
      escalationRate,
      performanceGrade: grade,
    };
  }

  /**
   * Get performance data for all engineers
   */
  getAllEngineerPerformances(): EngineerPerformance[] {
    return Array.from(this.engineers.keys())
      .map((id) => this.getEngineerPerformance(id))
      .filter((p): p is EngineerPerformance => p !== null)
      .sort((a, b) => b.avgDispatchScore - a.avgDispatchScore);
  }

  // ==================== Internal Helpers ====================

  /**
   * Filter dispatch results by time period
   */
  private filterByPeriod(periodStart?: Date, periodEnd?: Date): DispatchResult[] {
    let results = [...this.dispatchResults];

    if (periodStart) {
      results = results.filter((r) => r.dispatchedAt >= periodStart);
    }
    if (periodEnd) {
      results = results.filter((r) => r.dispatchedAt <= periodEnd);
    }

    return results;
  }

  /**
   * Calculate mean of an array
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100;
  }

  /**
   * Calculate median of an array
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Calculate percentile of an array
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(percentile * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate performance grade
   */
  private calculatePerformanceGrade(metrics: {
    acceptanceRate: number;
    slaComplianceRate: number;
    avgScore: number;
    escalationRate: number;
  }): string {
    // Weighted score
    const score =
      metrics.acceptanceRate * 30 +
      metrics.slaComplianceRate * 30 +
      (metrics.avgScore / 100) * 25 +
      (1 - metrics.escalationRate) * 15;

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  // ==================== Clear ====================

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.dispatchResults = [];
    this.dispatchEvents.clear();
    this.engineers.clear();
  }
}
