/**
 * Ticket Service - in-memory stub for orion-efficiency-svc
 *
 * Provides ticket management operations using in-memory Map storage.
 */

export interface TicketRecord {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  createdAt: Date;
  resolvedAt?: Date;
  slaDeadline?: Date;
}

export class TicketService {
  private tickets: Map<string, TicketRecord> = new Map();

  getSLACompliance(periodStart?: Date, periodEnd?: Date): {
    complianceRate: number;
    breachedTickets: number;
    totalTickets: number;
  } {
    let tickets = Array.from(this.tickets.values());
    if (periodStart && periodEnd) {
      tickets = tickets.filter((t) => t.createdAt >= periodStart && t.createdAt <= periodEnd);
    }

    const total = tickets.length;
    const breached = tickets.filter((t) => t.slaDeadline && t.createdAt > t.slaDeadline).length;

    return {
      complianceRate: total > 0 ? ((total - breached) / total) * 100 : 100,
      breachedTickets: breached,
      totalTickets: total,
    };
  }

  getResolutionStats(): {
    meanResolutionTimeMs: number;
    medianResolutionTimeMs: number;
  } {
    const resolved = Array.from(this.tickets.values())
      .filter((t) => t.resolvedAt && t.createdAt)
      .map((t) => t.resolvedAt!.getTime() - t.createdAt!.getTime())
      .sort((a, b) => a - b);

    if (resolved.length === 0) {
      return { meanResolutionTimeMs: 0, medianResolutionTimeMs: 0 };
    }

    const mean = resolved.reduce((sum, t) => sum + t, 0) / resolved.length;
    const median = resolved[Math.floor(resolved.length / 2)];

    return { meanResolutionTimeMs: mean, medianResolutionTimeMs: median };
  }

  getBacklogAnalysis(): {
    openCount: number;
    overdueCount: number;
    averageAgeMs: number;
    oldestTicketAgeMs: number;
  } {
    const now = Date.now();
    const open = Array.from(this.tickets.values()).filter((t) => t.status !== 'resolved' && t.status !== 'closed');
    const ages = open.map((t) => now - t.createdAt.getTime());

    return {
      openCount: open.length,
      overdueCount: open.filter((t) => t.slaDeadline && now > t.slaDeadline.getTime()).length,
      averageAgeMs: ages.length > 0 ? ages.reduce((sum, a) => sum + a, 0) / ages.length : 0,
      oldestTicketAgeMs: ages.length > 0 ? Math.max(...ages) : 0,
    };
  }

  getTrendReport(options?: { days?: number }): {
    dataPoints: Array<{ period: string; created: number; resolved: number; open: number }>;
    totalCreated: number;
    totalResolved: number;
    trend: string;
  } {
    const tickets = Array.from(this.tickets.values());
    const totalCreated = tickets.length;
    const totalResolved = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;

    return {
      dataPoints: [],
      totalCreated,
      totalResolved,
      trend: totalResolved >= totalCreated * 0.8 ? 'stable' : 'increasing',
    };
  }

  getStatistics(): {
    totalTickets: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    averageResolutionTimeMs: number;
    slaComplianceRate: number;
  } {
    const tickets = Array.from(this.tickets.values());
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    }

    const resolutionTimes = tickets
      .filter((t) => t.resolvedAt && t.createdAt)
      .map((t) => t.resolvedAt!.getTime() - t.createdAt!.getTime());

    return {
      totalTickets: tickets.length,
      byStatus,
      byPriority,
      byCategory,
      averageResolutionTimeMs: resolutionTimes.length > 0 ? resolutionTimes.reduce((s, t) => s + t, 0) / resolutionTimes.length : 0,
      slaComplianceRate: 100,
    };
  }

  addTicket(ticket: TicketRecord): void {
    this.tickets.set(ticket.id, ticket);
  }
}
