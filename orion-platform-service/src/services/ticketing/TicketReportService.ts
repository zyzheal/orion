/**
 * TASK-801: Ticket Report Service
 *
 * Generates reports and statistics for tickets:
 * - SLA compliance tracking
 * - Resolution time statistics
 * - Backlog analysis
 * - Trend analysis over time
 */

import {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketSLA,
  SLAComplianceReport,
  ResolutionStats,
  BacklogAnalysis,
  TrendReport,
  TrendDataPoint,
} from './types';

/**
 * Ticket Report Service
 *
 * Provides analytical reports for:
 * - SLA compliance monitoring
 * - Resolution time metrics
 * - Backlog health analysis
 * - Historical trend analysis
 */
export class TicketReportService {
  /**
   * Generate SLA compliance report
   */
  getSLACompliance(
    tickets: Ticket[],
    slaRecords: TicketSLA[],
    periodStart?: Date,
    periodEnd?: Date
  ): SLAComplianceReport {
    const start = periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = periodEnd || new Date();

    // Filter tickets in period
    const inPeriod = tickets.filter(t => {
      return t.createdAt >= start && t.createdAt <= end;
    });

    const slaMap = new Map(slaRecords.map(s => [s.ticketId, s]));

    let compliantTickets = 0;
    let breachedTickets = 0;

    const byPriority: Record<string, { total: number; compliant: number; rate: number }> = {};
    const byCategory: Record<string, { total: number; compliant: number; rate: number }> = {};

    const priorityOrder: TicketPriority[] = ['critical', 'high', 'medium', 'low'];
    for (const p of priorityOrder) {
      byPriority[p] = { total: 0, compliant: 0, rate: 0 };
    }

    for (const ticket of inPeriod) {
      const sla = slaMap.get(ticket.id);

      // Ensure category exists
      if (!byCategory[ticket.category]) {
        byCategory[ticket.category] = { total: 0, compliant: 0, rate: 0 };
      }

      byPriority[ticket.priority].total++;
      byCategory[ticket.category].total++;

      if (sla) {
        if (!sla.breached) {
          compliantTickets++;
          byPriority[ticket.priority].compliant++;
          byCategory[ticket.category].compliant++;
        } else {
          breachedTickets++;
        }
      } else {
        // No SLA - count as compliant if resolved in reasonable time
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          compliantTickets++;
          byPriority[ticket.priority].compliant++;
          byCategory[ticket.category].compliant++;
        } else {
          breachedTickets++;
        }
      }
    }

    // Calculate rates
    for (const p of priorityOrder) {
      const d = byPriority[p];
      d.rate = d.total > 0 ? (d.compliant / d.total) * 100 : 100;
    }
    for (const [cat, d] of Object.entries(byCategory)) {
      byCategory[cat].rate = d.total > 0 ? (d.compliant / d.total) * 100 : 100;
    }

    const total = compliantTickets + breachedTickets;

    return {
      complianceRate: total > 0 ? (compliantTickets / total) * 100 : 100,
      totalTickets: inPeriod.length,
      compliantTickets,
      breachedTickets,
      byPriority: byPriority as SLAComplianceReport['byPriority'],
      byCategory,
      periodStart: start,
      periodEnd: end,
    };
  }

  /**
   * Generate resolution time statistics
   */
  getResolutionStats(tickets: Ticket[]): ResolutionStats {
    const resolved = tickets.filter(t =>
      t.status === 'resolved' || t.status === 'closed'
    );

    const resolutionTimes = resolved
      .map(t => {
        // Calculate from creation to last update (or use metadata)
        const resolvedTime = t.updatedAt.getTime() - t.createdAt.getTime();
        return Math.max(resolvedTime, 0); // Allow 0 for instant resolutions
      });

    if (resolutionTimes.length === 0) {
      return {
        meanResolutionTimeMs: 0,
        medianResolutionTimeMs: 0,
        p95ResolutionTimeMs: 0,
        totalResolved: 0,
        byPriority: {
          critical: { mean: 0, count: 0 },
          high: { mean: 0, count: 0 },
          medium: { mean: 0, count: 0 },
          low: { mean: 0, count: 0 },
        },
        byCategory: {},
      };
    }

    resolutionTimes.sort((a, b) => a - b);

    const mean = resolutionTimes.reduce((sum, v) => sum + v, 0) / resolutionTimes.length;
    const median = resolutionTimes[Math.floor(resolutionTimes.length / 2)];
    const p95Index = Math.floor(resolutionTimes.length * 0.95);
    const p95 = resolutionTimes[Math.min(p95Index, resolutionTimes.length - 1)];

    // By priority
    const byPriority: Record<TicketPriority, { sum: number; count: number }> = {
      critical: { sum: 0, count: 0 },
      high: { sum: 0, count: 0 },
      medium: { sum: 0, count: 0 },
      low: { sum: 0, count: 0 },
    };

    for (const ticket of resolved) {
      const time = ticket.updatedAt.getTime() - ticket.createdAt.getTime();
      if (time > 0) {
        byPriority[ticket.priority].sum += time;
        byPriority[ticket.priority].count++;
      }
    }

    const byPriorityStats: Record<TicketPriority, { mean: number; count: number }> = {
      critical: {
        mean: byPriority.critical.count > 0 ? byPriority.critical.sum / byPriority.critical.count : 0,
        count: byPriority.critical.count,
      },
      high: {
        mean: byPriority.high.count > 0 ? byPriority.high.sum / byPriority.high.count : 0,
        count: byPriority.high.count,
      },
      medium: {
        mean: byPriority.medium.count > 0 ? byPriority.medium.sum / byPriority.medium.count : 0,
        count: byPriority.medium.count,
      },
      low: {
        mean: byPriority.low.count > 0 ? byPriority.low.sum / byPriority.low.count : 0,
        count: byPriority.low.count,
      },
    };

    // By category
    const categoryMap: Record<string, { sum: number; count: number }> = {};
    for (const ticket of resolved) {
      const time = ticket.updatedAt.getTime() - ticket.createdAt.getTime();
      if (time > 0) {
        if (!categoryMap[ticket.category]) {
          categoryMap[ticket.category] = { sum: 0, count: 0 };
        }
        categoryMap[ticket.category].sum += time;
        categoryMap[ticket.category].count++;
      }
    }

    const byCategory: Record<string, { mean: number; count: number }> = {};
    for (const [cat, data] of Object.entries(categoryMap)) {
      byCategory[cat] = {
        mean: data.count > 0 ? data.sum / data.count : 0,
        count: data.count,
      };
    }

    return {
      meanResolutionTimeMs: Math.round(mean),
      medianResolutionTimeMs: median,
      p95ResolutionTimeMs: p95,
      totalResolved: resolved.length,
      byPriority: byPriorityStats,
      byCategory,
    };
  }

  /**
   * Generate backlog analysis
   */
  getBacklogAnalysis(tickets: Ticket[]): BacklogAnalysis {
    const now = Date.now();

    const openTickets = tickets.filter(t =>
      ['open', 'assigned', 'in-progress'].includes(t.status)
    );

    const openCount = tickets.filter(t => t.status === 'open').length;
    const assignedCount = tickets.filter(t => t.status === 'assigned').length;
    const inProgressCount = tickets.filter(t => t.status === 'in-progress').length;

    // Overdue = created + target time has passed
    const overdueTickets = openTickets.filter(t => {
      if (t.dueDate) {
        return t.dueDate.getTime() < now;
      }
      // No due date, use 24h default
      return (now - t.createdAt.getTime()) > 24 * 60 * 60 * 1000;
    });

    // Calculate ages
    const ages = openTickets.map(t => now - t.createdAt.getTime());
    const averageAge = ages.length > 0
      ? ages.reduce((sum, v) => sum + v, 0) / ages.length
      : 0;
    const oldestAge = ages.length > 0 ? Math.max(...ages) : 0;

    // By priority
    const byPriority: Record<TicketPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const ticket of openTickets) {
      byPriority[ticket.priority]++;
    }

    // By category
    const byCategory: Record<string, number> = {};
    for (const ticket of openTickets) {
      byCategory[ticket.category] = (byCategory[ticket.category] || 0) + 1;
    }

    return {
      openCount,
      assignedCount,
      inProgressCount,
      overdueCount: overdueTickets.length,
      averageAgeMs: Math.round(averageAge),
      oldestTicketAgeMs: oldestAge,
      byPriority,
      byCategory,
    };
  }

  /**
   * Generate trend report over a time range
   */
  getTrendReport(
    tickets: Ticket[],
    options?: {
      days?: number;
      granularity?: 'hour' | 'day' | 'week' | 'month';
    }
  ): TrendReport {
    const days = options?.days ?? 30;
    const granularity = options?.granularity ?? 'day';
    const now = new Date();
    const startTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Group tickets by time buckets
    const buckets = this.createTimeBuckets(startTime, now, granularity);

    for (const ticket of tickets) {
      // Find the bucket for creation
      const createdBucket = this.findBucket(ticket.createdAt, buckets, granularity);
      if (createdBucket) {
        createdBucket.created++;
      }

      // Find the bucket for resolution
      if (ticket.status === 'resolved' || ticket.status === 'closed') {
        const resolvedBucket = this.findBucket(ticket.updatedAt, buckets, granularity);
        if (resolvedBucket) {
          resolvedBucket.resolved++;
        }
      }
    }

    // Calculate running open count
    let runningOpen = tickets.filter(t => t.createdAt < startTime && !['resolved', 'closed'].includes(t.status)).length;

    for (const bucket of buckets) {
      runningOpen += bucket.created - bucket.resolved;
      bucket.open = Math.max(0, runningOpen);
    }

    // Calculate average resolution time per bucket
    for (const bucket of buckets) {
      const bucketResolved = tickets.filter(t => {
        if (t.status !== 'resolved' && t.status !== 'closed') return false;
        const b = this.findBucket(t.updatedAt, buckets, granularity);
        return b && b.period === bucket.period;
      });

      if (bucketResolved.length > 0) {
        const avgTime = bucketResolved.reduce((sum, t) =>
          sum + (t.updatedAt.getTime() - t.createdAt.getTime()), 0
        ) / bucketResolved.length;
        bucket.avgResolutionTimeMs = Math.round(avgTime);
      }
    }

    // Determine overall trend
    const totalCreated = buckets.reduce((sum, b) => sum + b.created, 0);
    const totalResolved = buckets.reduce((sum, b) => sum + b.resolved, 0);
    const netChange = totalCreated - totalResolved;

    // Compare first half vs second half
    const halfIndex = Math.floor(buckets.length / 2);
    const firstHalfCreated = buckets.slice(0, halfIndex).reduce((sum, b) => sum + b.created, 0);
    const secondHalfCreated = buckets.slice(halfIndex).reduce((sum, b) => sum + b.created, 0);

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (secondHalfCreated > firstHalfCreated * 1.2) {
      trend = 'increasing';
    } else if (secondHalfCreated < firstHalfCreated * 0.8) {
      trend = 'decreasing';
    }

    return {
      dataPoints: buckets,
      totalCreated,
      totalResolved,
      netChange,
      trend,
      granularity,
    };
  }

  // ==================== Private Utility Methods ====================

  /**
   * Create time buckets for trend analysis
   */
  private createTimeBuckets(
    start: Date,
    end: Date,
    granularity: 'hour' | 'day' | 'week' | 'month'
  ): TrendDataPoint[] {
    const buckets: TrendDataPoint[] = [];
    const current = new Date(start);

    while (current <= end) {
      const periodLabel = this.formatPeriod(current, granularity);
      buckets.push({
        period: periodLabel,
        created: 0,
        resolved: 0,
        open: 0,
      });

      // Advance to next bucket
      switch (granularity) {
        case 'hour':
          current.setHours(current.getHours() + 1);
          break;
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return buckets;
  }

  /**
   * Find the bucket for a given date
   */
  private findBucket(date: Date, buckets: TrendDataPoint[], granularity: 'hour' | 'day' | 'week' | 'month'): TrendDataPoint | undefined {
    const periodLabel = this.formatPeriod(date, granularity);
    return buckets.find(b => b.period === periodLabel);
  }

  /**
   * Get granularity from existing buckets
   */
  private getGranularityFromBuckets(buckets: TrendDataPoint[]): 'hour' | 'day' | 'week' | 'month' {
    // Infer from the number of buckets relative to the time range
    if (buckets.length > 200) return 'hour';
    if (buckets.length > 60) return 'week';
    if (buckets.length > 12) return 'month';
    return 'day';
  }

  /**
   * Format a date as a period label
   */
  private formatPeriod(date: Date, granularity: 'hour' | 'day' | 'week' | 'month'): string {
    switch (granularity) {
      case 'hour':
        return date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().slice(0, 10); // YYYY-MM-DD
      case 'month':
        return date.toISOString().slice(0, 7); // YYYY-MM
      default:
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
    }
  }
}
