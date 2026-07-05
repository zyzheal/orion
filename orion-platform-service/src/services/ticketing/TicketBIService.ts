/**
 * TASK-TICKET-BI: Ticket BI Analytics Service
 *
 * Comprehensive BI analytics for the ticketing system:
 * - Executive dashboard (boss view with KPIs, trends, rankings, alerts)
 * - Manager dashboard (team detail with member metrics, heatmap, transfer analysis)
 * - Engineer dashboard (personal view with trends, strengths, weaknesses)
 * - Engineer efficiency metrics with composite scoring
 * - Time aggregation at multiple granularities
 * - Period comparison and BI data export
 *
 * Pure computation service -- no side effects, no timers.
 */

import {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketSLA,
  DispatchResult,
  EngineerProfile,
  TimeGranularity,
  EngineerEfficiencyMetrics,
  ExecutiveDashboard,
  ManagerDashboard,
  EngineerDashboard,
  BIExportData,
  EfficiencyScore,
  PeriodComparison,
} from './types';
import { BITransferRecordRepository } from '../../repositories/BITransferRecordRepository';
import { BICommentRecordRepository } from '../../repositories/BICommentRecordRepository';

/**
 * Transfer record for analytics
 */
export interface TransferRecord {
  id: string;
  ticketId: string;
  fromEngineer: string;
  toEngineer: string;
  reason: string;
  transferredAt: Date;
  holdTimeMs?: number;
}

/**
 * Comment record for collaboration metrics
 */
export interface CommentRecord {
  id: string;
  ticketId: string;
  authorId: string;
  createdAt: Date;
}

/**
 * Options for dashboard queries
 */
export interface DashboardOptions {
  periodStart?: Date;
  periodEnd?: Date;
  granularity?: TimeGranularity;
}

/**
 * Ticket BI Analytics Service
 *
 * Provides multi-level analytics dashboards:
 * - Executive: high-level KPIs, trends, rankings, alerts
 * - Manager: team metrics, heatmap, week-over-week, transfers
 * - Engineer: personal performance, strengths/weaknesses, active work
 */
export class TicketBIService {
  /** Ticket data */
  private tickets: Ticket[] = [];

  /** SLA records */
  private slaRecords: TicketSLA[] = [];

  /** Dispatch results */
  private dispatchResults: DispatchResult[] = [];

  /** Transfer records - runtime cache */
  private transferRecordRepository?: BITransferRecordRepository;
  private transferRecords: TransferRecord[] = []; // in-memory runtime cache

  /** Comment records - runtime cache */
  private commentRecordRepository?: BICommentRecordRepository;
  private commentRecords: CommentRecord[] = []; // in-memory runtime cache

  /** Engineer profiles */
  private engineerProfiles: Map<string, EngineerProfile> = new Map();

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.transferRecordRepository = new BITransferRecordRepository(db);
      this.commentRecordRepository = new BICommentRecordRepository(db);
    }
  }

  /**
   * Set ticket data for analysis
   */
  setTickets(tickets: Ticket[]): void {
    this.tickets = [...tickets];
  }

  /**
   * Set SLA records for analysis
   */
  setSLARecords(records: TicketSLA[]): void {
    this.slaRecords = [...records];
  }

  /**
   * Set dispatch results for analysis
   */
  setDispatchResults(results: DispatchResult[]): void {
    this.dispatchResults = [...results];
  }

  /**
   * Set transfer records for analysis
   */
  setTransferRecords(records: TransferRecord[]): void {
    this.transferRecords = [...records];

    // Persist to repository
    if (this.transferRecordRepository) {
      for (const record of records) {
        this.transferRecordRepository.create({
          id: record.id,
          ticketId: record.ticketId,
          fromEngineer: record.fromEngineer,
          toEngineer: record.toEngineer,
          reason: record.reason,
          transferredAt: record.transferredAt,
          holdTimeMs: record.holdTimeMs ?? null,
        }).catch(() => {/* ignore */});
      }
    }
  }

  /**
   * Set comment records for analysis
   */
  setCommentRecords(records: CommentRecord[]): void {
    this.commentRecords = [...records];

    // Persist to repository
    if (this.commentRecordRepository) {
      for (const record of records) {
        this.commentRecordRepository.create({
          id: record.id,
          ticketId: record.ticketId,
          authorId: record.authorId,
          createdAt: record.createdAt,
        }).catch(() => {/* ignore */});
      }
    }
  }

  /**
   * Set engineer profiles for context
   */
  setEngineerProfiles(profiles: EngineerProfile[]): void {
    this.engineerProfiles.clear();
    for (const p of profiles) {
      this.engineerProfiles.set(p.id, p);
    }
  }

  /**
   * Load all data at once
   */
  loadData(data: {
    tickets: Ticket[];
    slaRecords?: TicketSLA[];
    dispatchResults?: DispatchResult[];
    transferRecords?: TransferRecord[];
    commentRecords?: CommentRecord[];
    engineerProfiles?: EngineerProfile[];
  }): void {
    this.tickets = [...data.tickets];
    this.slaRecords = data.slaRecords ? [...data.slaRecords] : [];
    this.dispatchResults = data.dispatchResults ? [...data.dispatchResults] : [];
    this.transferRecords = data.transferRecords ? [...data.transferRecords] : [];
    this.commentRecords = data.commentRecords ? [...data.commentRecords] : [];
    if (data.engineerProfiles) {
      this.setEngineerProfiles(data.engineerProfiles);
    }

    // Persist transfer and comment records to repository
    if (this.transferRecordRepository && data.transferRecords) {
      for (const record of data.transferRecords) {
        this.transferRecordRepository.create({
          id: record.id,
          ticketId: record.ticketId,
          fromEngineer: record.fromEngineer,
          toEngineer: record.toEngineer,
          reason: record.reason,
          transferredAt: record.transferredAt,
          holdTimeMs: record.holdTimeMs ?? null,
        }).catch(() => {/* ignore */});
      }
    }
    if (this.commentRecordRepository && data.commentRecords) {
      for (const record of data.commentRecords) {
        this.commentRecordRepository.create({
          id: record.id,
          ticketId: record.ticketId,
          authorId: record.authorId,
          createdAt: record.createdAt,
        }).catch(() => {/* ignore */});
      }
    }
  }

  // ==================== Executive Dashboard ====================

  /**
   * Get executive dashboard (boss view)
   */
  getExecutiveDashboard(options?: DashboardOptions): ExecutiveDashboard {
    const start = options?.periodStart || this.getDefaultStart();
    const end = options?.periodEnd || new Date();
    const granularity = options?.granularity || 'day';

    const tickets = this.filterByPeriod(this.tickets, start, end);
    const slaMap = new Map(this.slaRecords.map((s) => [s.ticketId, s]));

    // Overview KPIs
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

    // SLA compliance
    let slaCompliant = 0;
    let slaTotal = 0;
    for (const t of tickets) {
      const sla = slaMap.get(t.id);
      if (sla) {
        slaTotal++;
        if (!sla.breached) slaCompliant++;
      } else if (t.status === 'resolved' || t.status === 'closed') {
        slaTotal++;
        slaCompliant++;
      }
    }
    const slaComplianceRate = slaTotal > 0 ? (slaCompliant / slaTotal) * 100 : 100;

    // Engineer counts
    const engineerIds = new Set(
      this.dispatchResults
        .filter((d) => d.dispatchedAt >= start && d.dispatchedAt <= end)
        .map((d) => d.assignee)
    );
    // Also count from ticket assignments
    for (const t of tickets) {
      if (t.assignee) engineerIds.add(t.assignee);
    }
    const totalEngineers = this.engineerProfiles.size || engineerIds.size;
    const activeEngineers = engineerIds.size;

    // Trends
    const buckets = this.createBuckets(start, end, granularity);
    const ticketVolumeTrend = buckets.map((bucket) => {
      const bucketTickets = this.getTicketsInBucket(bucket.start, bucket.end);
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
      const bucketResolved = this.tickets.filter(
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
      const bucketTickets = this.getTicketsInBucket(bucket.start, bucket.end);
      let compliant = 0;
      let total = 0;
      for (const t of bucketTickets) {
        const sla = slaMap.get(t.id);
        if (sla) {
          total++;
          if (!sla.breached) compliant++;
        } else if (t.status === 'resolved' || t.status === 'closed') {
          total++;
          compliant++;
        }
      }
      return {
        period: bucket.label,
        rate: total > 0 ? (compliant / total) * 100 : 100,
      };
    });

    const teamLoadTrend = buckets.map((bucket) => {
      const active = this.tickets.filter(
        (t) =>
          ['open', 'assigned', 'in-progress'].includes(t.status) &&
          t.createdAt <= bucket.end
      );
      return {
        period: bucket.label,
        load: active.length,
      };
    });

    // Team ranking
    const engineerMetrics = this.getAllEngineerMetrics(start, end);
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
        needsAttention: this.getNeedsAttentionReason(m),
      }));

    // Alerts
    const slaBreachedCount = this.slaRecords.filter(
      (s) => s.breached && this.isTicketInPeriod(s.ticketId, start, end)
    ).length;

    const overdueTicketsCount = openTickets.filter((t) => {
      if (t.dueDate) return t.dueDate.getTime() < end.getTime();
      return end.getTime() - t.createdAt.getTime() > 24 * 60 * 60 * 1000;
    }).length;

    // Overloaded engineers (>80% capacity)
    const overloadedEngineers = Array.from(this.engineerProfiles.values()).filter(
      (p) => p.currentLoad / p.maxCapacity > 0.8
    ).length;

    const unassignedOlderThan24h = openTickets.filter(
      (t) => !t.assignee && end.getTime() - t.createdAt.getTime() > 24 * 60 * 60 * 1000
    ).length;

    // Distribution
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

  // ==================== Manager Dashboard ====================

  /**
   * Get manager dashboard (team view)
   */
  getManagerDashboard(options?: DashboardOptions): ManagerDashboard {
    const start = options?.periodStart || this.getDefaultStart();
    const end = options?.periodEnd || new Date();

    const tickets = this.filterByPeriod(this.tickets, start, end);
    const slaMap = new Map(this.slaRecords.map((s) => [s.ticketId, s]));

    // Team overview
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

    let slaCompliant = 0;
    let slaTotal = 0;
    for (const t of tickets) {
      const sla = slaMap.get(t.id);
      if (sla) {
        slaTotal++;
        if (!sla.breached) slaCompliant++;
      } else if (t.status === 'resolved' || t.status === 'closed') {
        slaTotal++;
        slaCompliant++;
      }
    }

    const teamLoadPct = this.engineerProfiles.size > 0
      ? (Array.from(this.engineerProfiles.values()).reduce(
          (sum, p) => sum + (p.currentLoad / p.maxCapacity) * 100,
          0
        ) / this.engineerProfiles.size)
      : 0;

    // Member metrics
    const memberMetrics = this.getAllEngineerMetrics(start, end);

    // Heatmap: day of week x hour of day
    const heatmap = this.computeHeatmap(tickets);

    // Week over week comparison
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const currentWeekStart = new Date(end.getTime() - weekMs);
    const previousWeekStart = new Date(currentWeekStart.getTime() - weekMs);

    const currentWeekTickets = this.filterByPeriod(this.tickets, currentWeekStart, end);
    const previousWeekTickets = this.filterByPeriod(this.tickets, previousWeekStart, currentWeekStart);

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

    const currentAvgRes =
      currentResTimes.length > 0
        ? currentResTimes.reduce((a, b) => a + b, 0) / currentResTimes.length
        : 0;
    const previousAvgRes =
      previousResTimes.length > 0
        ? previousResTimes.reduce((a, b) => a + b, 0) / previousResTimes.length
        : 0;

    // SLA for current and previous week
    const computeSLA = (tkts: Ticket[]) => {
      let c = 0;
      let total = 0;
      for (const t of tkts) {
        const sla = slaMap.get(t.id);
        if (sla) {
          total++;
          if (!sla.breached) c++;
        } else if (t.status === 'resolved' || t.status === 'closed') {
          total++;
          c++;
        }
      }
      return total > 0 ? (c / total) * 100 : 100;
    };

    const currentSLA = computeSLA(currentWeekTickets);
    const previousSLA = computeSLA(previousWeekTickets);

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

    // Transfer analysis
    const transfersInPeriod = this.transferRecords.filter(
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
        const ticket = this.tickets.find((t) => t.id === ticketId);
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
        slaComplianceRate: slaTotal > 0 ? Math.round((slaCompliant / slaTotal) * 10000) / 100 : 100,
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

  // ==================== Engineer Dashboard ====================

  /**
   * Get engineer personal dashboard
   */
  getEngineerDashboard(
    engineerId: string,
    options?: DashboardOptions
  ): EngineerDashboard | null {
    const start = options?.periodStart || this.getDefaultStart();
    const end = options?.periodEnd || new Date();
    const granularity = options?.granularity || 'day';

    const profile = this.engineerProfiles.get(engineerId);
    if (!profile) return null;

    // Get tickets assigned to this engineer
    const engineerTickets = this.tickets.filter((t) => t.assignee === engineerId);
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
    const slaMap = new Map(this.slaRecords.map((s) => [s.ticketId, s]));
    let slaCompliant = 0;
    let slaTotal = 0;
    for (const t of engineerTickets) {
      const sla = slaMap.get(t.id);
      if (sla) {
        slaTotal++;
        if (!sla.breached) slaCompliant++;
      } else if (t.status === 'resolved' || t.status === 'closed') {
        slaTotal++;
        slaCompliant++;
      }
    }
    const slaRate = slaTotal > 0 ? (slaCompliant / slaTotal) * 100 : 100;

    // Performance grade from efficiency metrics
    const metrics = this.getEngineerEfficiency(engineerId, granularity, start, end);
    const score = this.getEfficiencyScore(engineerId, start, end);

    // Rank among team
    const allMetrics = this.getAllEngineerMetrics(start, end);
    const sorted = [...allMetrics].sort((a, b) => b.compositeScore - a.compositeScore);
    const rank = sorted.findIndex((m) => m.engineerId === engineerId) + 1;

    // Personal trend
    const buckets = this.createBuckets(start, end, granularity);
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
      const received = this.dispatchResults.filter(
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
      const proficiencyScore = this.computeProficiencyScore(data.resolved, avgH, slaRateCat);

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
        const suggestion = this.generateWeaknessSuggestion(cat, avgH, slaRateCat);
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
      const assignedAt = t.updatedAt; // Use updatedAt as proxy for assignment time
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

  // ==================== Engineer Efficiency Metrics ====================

  /**
   * Get efficiency metrics for a specific engineer
   */
  getEngineerEfficiency(
    engineerId: string,
    granularity: TimeGranularity = 'day',
    start?: Date,
    end?: Date
  ): EngineerEfficiencyMetrics {
    const periodStart = start || this.getDefaultStart();
    const periodEnd = end || new Date();

    const profile = this.engineerProfiles.get(engineerId);
    const engineerName = profile?.name || engineerId;

    // Get tickets for this engineer
    const engineerTickets = this.tickets.filter(
      (t) => t.assignee === engineerId && t.createdAt >= periodStart && t.createdAt <= periodEnd
    );
    const resolved = engineerTickets.filter(
      (t) => t.status === 'resolved' || t.status === 'closed'
    );
    const slaMap = new Map(this.slaRecords.map((s) => [s.ticketId, s]));

    // Workload
    const transfersGiven = this.transferRecords.filter(
      (tr) => tr.fromEngineer === engineerId && tr.transferredAt >= periodStart && tr.transferredAt <= periodEnd
    );
    const totalTransferred = transfersGiven.length;

    // Calculate avg active tickets
    const activeDays = this.countActiveDays(engineerId, periodStart, periodEnd);
    const avgActive =
      activeDays > 0
        ? engineerTickets.filter(
            (t) => ['open', 'assigned', 'in-progress'].includes(t.status)
          ).length / Math.max(activeDays, 1)
        : 0;

    // Peak concurrent (max open at any point)
    const peakConcurrent = this.computePeakConcurrent(engineerId, periodStart, periodEnd);

    // Efficiency metrics
    const resolutionTimes = resolved.map(
      (t) => t.updatedAt.getTime() - t.createdAt.getTime()
    );
    const sortedRes = [...resolutionTimes].sort((a, b) => a - b);

    const avgRes =
      sortedRes.length > 0
        ? sortedRes.reduce((a, b) => a + b, 0) / sortedRes.length
        : 0;
    const medianRes =
      sortedRes.length > 0 ? sortedRes[Math.floor(sortedRes.length / 2)] : 0;
    const p95Res =
      sortedRes.length > 0
        ? sortedRes[Math.min(Math.ceil(0.95 * sortedRes.length) - 1, sortedRes.length - 1)]
        : 0;

    // First response time (from dispatch results)
    const dispatches = this.dispatchResults.filter(
      (d) =>
        d.assignee === engineerId &&
        d.dispatchedAt >= periodStart &&
        d.dispatchedAt <= periodEnd
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
      this.transferRecords
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

    // Reopen rate (approximate: count of resolved tickets that have workflow history with reopen)
    const reopened = 0; // Would need workflow history to compute accurately
    const reopenRate = resolved.length > 0 ? (reopened / resolved.length) * 100 : 0;

    // Customer satisfaction from profile
    const customerSatisfactionScore = profile?.resolutionStats?.satisfactionScore || 0;

    // Collaboration
    const transfersReceived = this.transferRecords.filter(
      (tr) => tr.toEngineer === engineerId && tr.transferredAt >= periodStart && tr.transferredAt <= periodEnd
    ).length;

    const commentsCount = this.commentRecords.filter(
      (c) =>
        c.authorId === engineerId &&
        c.createdAt >= periodStart &&
        c.createdAt <= periodEnd
    ).length;

    // Backup coverage (tickets where engineer was backup -- approximated by transfers received)
    const backupCoverageCount = transfersReceived;

    // Composite score
    const scoreData = this.getEfficiencyScore(engineerId, periodStart, periodEnd);

    // Performance grade
    const performanceGrade = this.computePerformanceGrade(scoreData.score);

    // Trend
    const trend = this.computeTrend(
      resolved,
      periodStart,
      periodEnd
    );

    const periodLabel = this.formatPeriod(periodStart, granularity);

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
        avgFirstResponseTimeMs: 0, // Would need first response timestamps
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

  // ==================== Efficiency Score ====================

  /**
   * Get efficiency score with 4-dimensional breakdown
   * - Workload: 25%
   * - Efficiency: 30%
   * - Quality: 30%
   * - Teamwork: 15%
   */
  getEfficiencyScore(
    engineerId: string,
    start?: Date,
    end?: Date
  ): EfficiencyScore {
    const periodStart = start || this.getDefaultStart();
    const periodEnd = end || new Date();

    const profile = this.engineerProfiles.get(engineerId);
    const engineerTickets = this.tickets.filter(
      (t) => t.assignee === engineerId && t.createdAt >= periodStart && t.createdAt <= periodEnd
    );
    const resolved = engineerTickets.filter(
      (t) => t.status === 'resolved' || t.status === 'closed'
    );
    const slaMap = new Map(this.slaRecords.map((s) => [s.ticketId, s]));

    // Workload Score (25%)
    // Based on: throughput vs capacity, consistent activity
    const capacity = profile?.maxCapacity || 10;
    const utilizationScore = profile
      ? Math.min((profile.currentLoad / capacity) * 100, 100)
      : 50;
    const throughputScore = resolved.length > 0 ? Math.min(resolved.length * 5, 100) : 0;
    const workloadScore = utilizationScore * 0.4 + throughputScore * 0.6;

    // Efficiency Score (30%)
    // Based on: resolution speed, responsiveness
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

    // SLA compliance as part of efficiency
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
    const slaScore = slaTotal > 0 ? (slaCompliant / slaTotal) * 100 : 100;

    const efficiencyScore = speedScore * 0.5 + slaScore * 0.5;

    // Quality Score (30%)
    // Based on: first-time resolve, no escalation, low reopen
    const firstTimeResolveRate = this.computeFirstTimeResolveRate(resolved, periodStart, periodEnd);
    const escalated = engineerTickets.filter((t) => t.escalationLevel > 0).length;
    const nonEscalationRate =
      engineerTickets.length > 0
        ? ((engineerTickets.length - escalated) / engineerTickets.length) * 100
        : 100;

    // Reopen rate (approximate)
    const reopenRate = 0;
    const nonReopenRate = 100 - reopenRate;

    const qualityScore =
      firstTimeResolveRate * 0.4 + nonEscalationRate * 0.3 + nonReopenRate * 0.3;

    // Teamwork Score (15%)
    // Based on: transfers received/given ratio, comments, backup coverage
    const transfersReceived = this.transferRecords.filter(
      (tr) => tr.toEngineer === engineerId && tr.transferredAt >= periodStart && tr.transferredAt <= periodEnd
    ).length;
    const transfersGiven = this.transferRecords.filter(
      (tr) => tr.fromEngineer === engineerId && tr.transferredAt >= periodStart && tr.transferredAt <= periodEnd
    ).length;
    const commentsCount = this.commentRecords.filter(
      (c) =>
        c.authorId === engineerId &&
        c.createdAt >= periodStart &&
        c.createdAt <= periodEnd
    ).length;

    // Collaboration ratio (receiving help and giving help)
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

  // ==================== Period Comparison ====================

  /**
   * Compare current period vs previous period
   */
  comparePeriods(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): PeriodComparison {
    // Current period metrics
    const currentTickets = this.filterByPeriod(this.tickets, currentStart, currentEnd);
    const currentResolved = currentTickets.filter(
      (t) => t.status === 'resolved' || t.status === 'closed'
    );
    const slaMap = new Map(this.slaRecords.map((s) => [s.ticketId, s]));

    const currentResTimes = currentResolved.map(
      (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
    );
    const currentAvgRes =
      currentResTimes.length > 0
        ? currentResTimes.reduce((a, b) => a + b, 0) / currentResTimes.length
        : 0;

    const currentSLA = this.computeSLARate(currentTickets, slaMap);

    const currentMetrics: Record<string, number> = {
      ticketsCreated: currentTickets.length,
      ticketsResolved: currentResolved.length,
      avgResolutionHours: Math.round(currentAvgRes * 100) / 100,
      slaComplianceRate: Math.round(currentSLA * 100) / 100,
      openTickets: currentTickets.filter(
        (t) => ['open', 'assigned', 'in-progress'].includes(t.status)
      ).length,
    };

    // Previous period metrics
    const prevTickets = this.filterByPeriod(this.tickets, previousStart, previousEnd);
    const prevResolved = prevTickets.filter(
      (t) => t.status === 'resolved' || t.status === 'closed'
    );

    const prevResTimes = prevResolved.map(
      (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
    );
    const prevAvgRes =
      prevResTimes.length > 0
        ? prevResTimes.reduce((a, b) => a + b, 0) / prevResTimes.length
        : 0;

    const prevSLA = this.computeSLARate(prevTickets, slaMap);

    const prevMetrics: Record<string, number> = {
      ticketsCreated: prevTickets.length,
      ticketsResolved: prevResolved.length,
      avgResolutionHours: Math.round(prevAvgRes * 100) / 100,
      slaComplianceRate: Math.round(prevSLA * 100) / 100,
      openTickets: prevTickets.filter(
        (t) => ['open', 'assigned', 'in-progress'].includes(t.status)
      ).length,
    };

    // Compute changes
    const changes = Object.keys(currentMetrics).map((metric) => {
      const current = currentMetrics[metric];
      const previous = prevMetrics[metric];
      const changePercent =
        previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
      const direction: 'up' | 'down' | 'same' =
        changePercent > 1 ? 'up' : changePercent < -1 ? 'down' : 'same';

      return { metric, changePercent: Math.round(changePercent * 100) / 100, direction };
    });

    return {
      current: { period: `${currentStart.toISOString()} to ${currentEnd.toISOString()}`, metrics: currentMetrics },
      previous: { period: `${previousStart.toISOString()} to ${previousEnd.toISOString()}`, metrics: prevMetrics },
      changes,
    };
  }

  // ==================== BI Export ====================

  /**
   * Export data for external BI tools
   */
  exportBIData(options: {
    dataset: 'tickets' | 'sla' | 'dispatch' | 'efficiency';
    granularity?: TimeGranularity;
    periodStart?: Date;
    periodEnd?: Date;
  }): BIExportData {
    const start = options.periodStart || this.getDefaultStart();
    const end = options.periodEnd || new Date();
    const granularity = options.granularity || 'day';

    const { dataset } = options;
    let rows: Record<string, any>[] = [];
    let columns: { name: string; type: string; label: string }[] = [];

    switch (dataset) {
      case 'tickets': {
        const tickets = this.filterByPeriod(this.tickets, start, end);
        columns = [
          { name: 'id', type: 'string', label: 'Ticket ID' },
          { name: 'title', type: 'string', label: 'Title' },
          { name: 'category', type: 'string', label: 'Category' },
          { name: 'priority', type: 'string', label: 'Priority' },
          { name: 'status', type: 'string', label: 'Status' },
          { name: 'assignee', type: 'string', label: 'Assignee' },
          { name: 'source', type: 'string', label: 'Source' },
          { name: 'createdAt', type: 'datetime', label: 'Created At' },
          { name: 'updatedAt', type: 'datetime', label: 'Updated At' },
          { name: 'resolutionHours', type: 'number', label: 'Resolution Hours' },
        ];

        rows = tickets.map((t) => ({
          id: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          status: t.status,
          assignee: t.assignee || null,
          source: t.source,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          resolutionHours:
            t.status === 'resolved' || t.status === 'closed'
              ? Math.round(((t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)) * 100) / 100
              : null,
        }));
        break;
      }

      case 'sla': {
        const slaRecords = this.slaRecords.filter((s) => {
          const ticket = this.tickets.find((t) => t.id === s.ticketId);
          return ticket && ticket.createdAt >= start && ticket.createdAt <= end;
        });

        columns = [
          { name: 'ticketId', type: 'string', label: 'Ticket ID' },
          { name: 'breached', type: 'boolean', label: 'SLA Breached' },
          { name: 'targetResolutionHours', type: 'number', label: 'Target Resolution Hours' },
          { name: 'actualResolutionHours', type: 'number', label: 'Actual Resolution Hours' },
          { name: 'firstResponseAt', type: 'datetime', label: 'First Response' },
        ];

        rows = slaRecords.map((s) => ({
          ticketId: s.ticketId,
          breached: s.breached,
          targetResolutionHours: Math.round((s.targetResolutionTimeMs / (1000 * 60 * 60)) * 100) / 100,
          actualResolutionHours: s.actualResolutionTimeMs
            ? Math.round((s.actualResolutionTimeMs / (1000 * 60 * 60)) * 100) / 100
            : null,
          firstResponseAt: s.firstResponseAt?.toISOString() || null,
        }));
        break;
      }

      case 'dispatch': {
        const dispatches = this.dispatchResults.filter(
          (d) => d.dispatchedAt >= start && d.dispatchedAt <= end
        );

        columns = [
          { name: 'ticketId', type: 'string', label: 'Ticket ID' },
          { name: 'assignee', type: 'string', label: 'Assignee' },
          { name: 'score', type: 'number', label: 'Dispatch Score' },
          { name: 'dispatchType', type: 'string', label: 'Dispatch Type' },
          { name: 'accepted', type: 'boolean', label: 'Accepted' },
          { name: 'dispatchedAt', type: 'datetime', label: 'Dispatched At' },
          { name: 'timeToAcceptanceMs', type: 'number', label: 'Time to Acceptance (ms)' },
        ];

        rows = dispatches.map((d) => ({
          ticketId: d.ticketId,
          assignee: d.assignee,
          score: d.score,
          dispatchType: d.dispatchType,
          accepted: d.accepted,
          dispatchedAt: d.dispatchedAt.toISOString(),
          timeToAcceptanceMs: d.timeToAcceptanceMs ?? null,
        }));
        break;
      }

      case 'efficiency': {
        // Per-engineer efficiency at granularity level
        const buckets = this.createBuckets(start, end, granularity);
        const engineerIds = new Set(
          this.tickets.map((t) => t.assignee).filter(Boolean) as string[]
        );

        columns = [
          { name: 'engineerId', type: 'string', label: 'Engineer ID' },
          { name: 'engineerName', type: 'string', label: 'Engineer Name' },
          { name: 'period', type: 'string', label: 'Period' },
          { name: 'assigned', type: 'number', label: 'Assigned' },
          { name: 'resolved', type: 'number', label: 'Resolved' },
          { name: 'avgResolutionHours', type: 'number', label: 'Avg Resolution Hours' },
          { name: 'slaComplianceRate', type: 'number', label: 'SLA Compliance Rate' },
          { name: 'compositeScore', type: 'number', label: 'Composite Score' },
        ];

        const slaMap = new Map(this.slaRecords.map((s) => [s.ticketId, s]));

        for (const eid of engineerIds) {
          for (const bucket of buckets) {
            const engTickets = this.tickets.filter(
              (t) =>
                t.assignee === eid &&
                t.createdAt >= bucket.start &&
                t.createdAt <= bucket.end
            );
            const engResolved = engTickets.filter(
              (t) => t.status === 'resolved' || t.status === 'closed'
            );

            let slaC = 0;
            let slaT = 0;
            for (const t of engResolved) {
              const sla = slaMap.get(t.id);
              if (sla) { slaT++; if (!sla.breached) slaC++; }
              else { slaT++; slaC++; }
            }

            const resTimes = engResolved.map(
              (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
            );
            const avgH = resTimes.length > 0 ? resTimes.reduce((a, b) => a + b, 0) / resTimes.length : 0;

            const profile = this.engineerProfiles.get(eid);

            rows.push({
              engineerId: eid,
              engineerName: profile?.name || eid,
              period: bucket.label,
              assigned: engTickets.length,
              resolved: engResolved.length,
              avgResolutionHours: Math.round(avgH * 100) / 100,
              slaComplianceRate: slaT > 0 ? Math.round((slaC / slaT) * 10000) / 100 : 100,
              compositeScore: 0, // Would need per-bucket score computation
            });
          }
        }
        break;
      }
    }

    return {
      dataset,
      granularity,
      periodStart: start,
      periodEnd: end,
      rows,
      columns,
      generatedAt: new Date(),
    };
  }

  // ==================== Time Trend ====================

  /**
   * Get time series trend data
   */
  getTimeTrend(options?: {
    metric?: 'volume' | 'resolution' | 'sla' | 'load';
    start?: Date;
    end?: Date;
    granularity?: TimeGranularity;
  }): { period: string; value: number; details?: Record<string, number> }[] {
    const start = options?.start || this.getDefaultStart();
    const end = options?.end || new Date();
    const granularity = options?.granularity || 'day';
    const metric = options?.metric || 'volume';

    const buckets = this.createBuckets(start, end, granularity);
    const slaMap = new Map(this.slaRecords.map((s) => [s.ticketId, s]));

    return buckets.map((bucket) => {
      switch (metric) {
        case 'volume': {
          const created = this.tickets.filter(
            (t) => t.createdAt >= bucket.start && t.createdAt <= bucket.end
          ).length;
          const resolved = this.tickets.filter(
            (t) =>
              (t.status === 'resolved' || t.status === 'closed') &&
              t.updatedAt >= bucket.start &&
              t.updatedAt <= bucket.end
          ).length;
          return {
            period: bucket.label,
            value: created,
            details: { created: created as number, resolved: resolved as number } as Record<string, number>,
          };
        }
        case 'resolution': {
          const bucketResolved = this.tickets.filter(
            (t) =>
              (t.status === 'resolved' || t.status === 'closed') &&
              t.updatedAt >= bucket.start &&
              t.updatedAt <= bucket.end
          );
          const hours = bucketResolved.map(
            (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
          );
          const avg = hours.length > 0 ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
          const count = bucketResolved.length as number;
          return {
            period: bucket.label,
            value: Math.round(avg * 100) / 100,
            details: { count } as Record<string, number>,
          };
        }
        case 'sla': {
          const bucketTickets = this.getTicketsInBucket(bucket.start, bucket.end);
          let compliant = 0;
          let total = 0;
          for (const t of bucketTickets) {
            const sla = slaMap.get(t.id);
            if (sla) { total++; if (!sla.breached) compliant++; }
            else if (t.status === 'resolved' || t.status === 'closed') { total++; compliant++; }
          }
          return {
            period: bucket.label,
            value: total > 0 ? Math.round((compliant / total) * 10000) / 100 : 100,
          };
        }
        case 'load': {
          const active = this.tickets.filter(
            (t) => ['open', 'assigned', 'in-progress'].includes(t.status) && t.createdAt <= bucket.end
          ).length;
          return { period: bucket.label, value: active };
        }
        default:
          return { period: bucket.label, value: 0 };
      }
    });
  }

  // ==================== Internal Helper Methods ====================

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.max(0, Math.min(Math.ceil(p * sorted.length) - 1, sorted.length - 1));
    return sorted[index];
  }

  /**
   * Format a date as a period label
   */
  private formatPeriod(date: Date, granularity: TimeGranularity): string {
    switch (granularity) {
      case 'hour':
        return date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      case 'day':
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
      case 'week': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().slice(0, 10);
      }
      case 'month':
        return date.toISOString().slice(0, 7); // YYYY-MM
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

  /**
   * Create time buckets between start and end
   */
  private createBuckets(
    start: Date,
    end: Date,
    granularity: TimeGranularity
  ): { start: Date; end: Date; label: string }[] {
    const buckets: { start: Date; end: Date; label: string }[] = [];
    const current = new Date(start);

    while (current <= end) {
      const bucketEnd = this.getNextBucketEnd(current, granularity);
      const label = this.formatPeriod(current, granularity);

      buckets.push({
        start: new Date(current),
        end: bucketEnd > end.getTime() ? new Date(end) : new Date(bucketEnd),
        label,
      });

      this.advanceDate(current, granularity);
    }

    return buckets;
  }

  /**
   * Get the end timestamp of the next bucket
   */
  private getNextBucketEnd(current: Date, granularity: TimeGranularity): number {
    const next = new Date(current);
    this.advanceDate(next, granularity);
    return next.getTime();
  }

  /**
   * Advance a date by one granularity unit
   */
  private advanceDate(date: Date, granularity: TimeGranularity): void {
    switch (granularity) {
      case 'hour':
        date.setHours(date.getHours() + 1);
        break;
      case 'day':
        date.setDate(date.getDate() + 1);
        break;
      case 'week':
        date.setDate(date.getDate() + 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarter':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
  }

  /**
   * Filter tickets by time period
   */
  private filterByPeriod(tickets: Ticket[], start: Date, end: Date): Ticket[] {
    return tickets.filter(
      (t) => t.createdAt >= start && t.createdAt <= end
    );
  }

  /**
   * Get tickets created within a time range
   */
  private getTicketsInBucket(start: Date, end: Date): Ticket[] {
    return this.tickets.filter(
      (t) => t.createdAt >= start && t.createdAt <= end
    );
  }

  /**
   * Check if a ticket falls within a period
   */
  private isTicketInPeriod(ticketId: string, start: Date, end: Date): boolean {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) return false;
    return ticket.createdAt >= start && ticket.createdAt <= end;
  }

  /**
   * Get default start date (30 days ago)
   */
  private getDefaultStart(): Date {
    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  /**
   * Get all engineer efficiency metrics
   */
  private getAllEngineerMetrics(
    start: Date,
    end: Date
  ): EngineerEfficiencyMetrics[] {
    const engineerIds = new Set<string>();

    // From tickets
    for (const t of this.tickets) {
      if (t.assignee) engineerIds.add(t.assignee);
    }
    // From dispatch results
    for (const d of this.dispatchResults) {
      engineerIds.add(d.assignee);
    }
    // From profiles
    for (const id of this.engineerProfiles.keys()) {
      engineerIds.add(id);
    }

    return Array.from(engineerIds).map((id) =>
      this.getEngineerEfficiency(id, 'day', start, end)
    );
  }

  /**
   * Compute heatmap data
   */
  private computeHeatmap(
    tickets: Ticket[]
  ): { dayOfWeek: number; hourOfDay: number; ticketCount: number }[] {
    const heatmapMap = new Map<string, number>();

    for (const t of tickets) {
      const day = t.createdAt.getDay(); // 0=Sun, 6=Sat
      const hour = t.createdAt.getHours();
      const key = `${day}-${hour}`;
      heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1);
    }

    return Array.from(heatmapMap.entries()).map(([key, count]) => {
      const [day, hour] = key.split('-').map(Number);
      return { dayOfWeek: day, hourOfDay: hour, ticketCount: count };
    });
  }

  /**
   * Count active days for an engineer
   */
  private countActiveDays(
    engineerId: string,
    start: Date,
    end: Date
  ): number {
    const days = new Set<string>();

    // Count days when engineer had ticket activity
    for (const t of this.tickets) {
      if (t.assignee === engineerId && t.createdAt >= start && t.createdAt <= end) {
        days.add(t.createdAt.toISOString().slice(0, 10));
      }
    }

    return days.size;
  }

  /**
   * Compute peak concurrent tickets for an engineer
   */
  private computePeakConcurrent(
    engineerId: string,
    start: Date,
    end: Date
  ): number {
    const engineerTickets = this.tickets.filter(
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

  /**
   * Compute first-time resolve rate
   */
  private computeFirstTimeResolveRate(
    resolved: Ticket[],
    start: Date,
    end: Date
  ): number {
    if (resolved.length === 0) return 100;

    const transferredTicketIds = new Set(
      this.transferRecords
        .filter((tr) => tr.transferredAt >= start && tr.transferredAt <= end)
        .map((tr) => tr.ticketId)
    );

    const firstTime = resolved.filter((t) => !transferredTicketIds.has(t.id)).length;
    return (firstTime / resolved.length) * 100;
  }

  /**
   * Compute SLA compliance rate
   */
  private computeSLARate(
    tickets: Ticket[],
    slaMap: Map<string, TicketSLA>
  ): number {
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

    return total > 0 ? (compliant / total) * 100 : 100;
  }

  /**
   * Compute proficiency score for a category
   */
  private computeProficiencyScore(
    resolvedCount: number,
    avgHours: number,
    slaRate: number
  ): number {
    // Volume score (0-33): more is better, cap at 50 tickets
    const volumeScore = Math.min((resolvedCount / 50) * 33, 33);

    // Speed score (0-33): faster is better, cap at 24 hours
    const speedScore = avgHours > 0 ? Math.max(0, Math.min(33, (24 - avgHours) / 24 * 33)) : 33;

    // SLA score (0-34)
    const slaScore = (slaRate / 100) * 34;

    return volumeScore + speedScore + slaScore;
  }

  /**
   * Generate weakness suggestion
   */
  private generateWeaknessSuggestion(
    category: string,
    avgHours: number,
    slaRate: number
  ): string {
    if (avgHours > 48) {
      return `Resolution time in ${category} is very high. Consider training or pairing with a senior engineer.`;
    }
    if (slaRate < 70) {
      return `SLA compliance in ${category} is low. Review SLA targets and prioritize tickets in this category.`;
    }
    if (avgHours > 12) {
      return `Consider improving efficiency in ${category}. Review common patterns and create runbooks.`;
    }
    return `Performance in ${category} can be improved. Consider additional training or documentation review.`;
  }

  /**
   * Compute performance grade from score
   */
  private computePerformanceGrade(score: number): 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  /**
   * Compute trend direction by comparing first half vs second half
   */
  private computeTrend(
    resolved: Ticket[],
    start: Date,
    end: Date
  ): 'improving' | 'stable' | 'declining' {
    if (resolved.length < 2) return 'stable';

    const midTime = start.getTime() + (end.getTime() - start.getTime()) / 2;

    const firstHalf = resolved.filter((t) => t.updatedAt.getTime() < midTime);
    const secondHalf = resolved.filter((t) => t.updatedAt.getTime() >= midTime);

    const firstHalfRate = firstHalf.length;
    const secondHalfRate = secondHalf.length;

    if (secondHalfRate > firstHalfRate * 1.2) return 'improving';
    if (secondHalfRate < firstHalfRate * 0.8) return 'declining';

    // Also check resolution time trend
    const firstHalfTimes = firstHalf.map(
      (t) => t.updatedAt.getTime() - t.createdAt.getTime()
    );
    const secondHalfTimes = secondHalf.map(
      (t) => t.updatedAt.getTime() - t.createdAt.getTime()
    );

    const firstAvg = firstHalfTimes.length > 0 ? firstHalfTimes.reduce((a, b) => a + b, 0) / firstHalfTimes.length : 0;
    const secondAvg = secondHalfTimes.length > 0 ? secondHalfTimes.reduce((a, b) => a + b, 0) / secondHalfTimes.length : 0;

    if (firstAvg > 0 && secondAvg < firstAvg * 0.8) return 'improving';
    if (firstAvg > 0 && secondAvg > firstAvg * 1.2) return 'declining';

    return 'stable';
  }

  /**
   * Get reason for attention needed for bottom performers
   */
  private getNeedsAttentionReason(metrics: EngineerEfficiencyMetrics): string {
    const reasons: string[] = [];

    if (metrics.quality.slaComplianceRate < 80) {
      reasons.push(`SLA compliance at ${metrics.quality.slaComplianceRate.toFixed(1)}%`);
    }
    if (metrics.efficiency.avgResolutionTimeMs > 48 * 60 * 60 * 1000) {
      reasons.push('High average resolution time');
    }
    if (metrics.quality.reopenRate > 10) {
      reasons.push(`High reopen rate at ${metrics.quality.reopenRate.toFixed(1)}%`);
    }
    if (metrics.quality.escalationRate > 20) {
      reasons.push(`High escalation rate at ${metrics.quality.escalationRate.toFixed(1)}%`);
    }
    if (metrics.workload.totalResolved < 3) {
      reasons.push('Low resolution throughput');
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Below threshold performance';
  }

  // ==================== Clear ====================

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.tickets = [];
    this.slaRecords = [];
    this.dispatchResults = [];
    this.transferRecords = [];
    this.commentRecords = [];
    this.engineerProfiles.clear();
  }
}
