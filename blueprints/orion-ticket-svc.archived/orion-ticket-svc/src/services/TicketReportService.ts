/**
 * TicketReportService - generates reports and statistics.
 */
import {
  Ticket,
  SLAComplianceReport,
  ResolutionStats,
  BacklogAnalysis,
  TrendReport,
} from '../types/ticketing';

interface SLARecord {
  ticketId: string;
  responseTimeMs: number;
  resolutionTimeMs: number;
  breached: boolean;
  targetResponseMs: number;
  targetResolutionMs: number;
}

function getSLATargets(priority: string): { responseMs: number; resolutionMs: number } {
  switch (priority) {
    case 'critical': return { responseMs: 15 * 60_000, resolutionMs: 4 * 3600_000 };
    case 'high': return { responseMs: 30 * 60_000, resolutionMs: 8 * 3600_000 };
    case 'medium': return { responseMs: 60 * 60_000, resolutionMs: 24 * 3600_000 };
    default: return { responseMs: 120 * 60_000, resolutionMs: 72 * 3600_000 };
  }
}

export class TicketReportService {
  getSLACompliance(
    tickets: Ticket[],
    slaRecords: SLARecord[],
    periodStart?: Date,
    periodEnd?: Date
  ): SLAComplianceReport {
    let filtered = tickets;
    if (periodStart) filtered = filtered.filter(t => t.createdAt >= periodStart);
    if (periodEnd) filtered = filtered.filter(t => t.createdAt <= periodEnd);

    const total = filtered.length;
    const breached = slaRecords.filter(r => r.breached).length;
    const compliant = total - breached;

    const byPriority: Record<string, { total: number; compliant: number; rate: number }> = {};
    for (const t of filtered) {
      const sla = slaRecords.find(s => s.ticketId === t.id);
      if (!byPriority[t.priority]) {
        byPriority[t.priority] = { total: 0, compliant: 0, rate: 0 };
      }
      byPriority[t.priority].total++;
      if (!sla?.breached) byPriority[t.priority].compliant++;
    }
    for (const p of Object.values(byPriority)) {
      p.rate = p.total > 0 ? p.compliant / p.total : 0;
    }

    return {
      totalTickets: total,
      compliantTickets: compliant,
      breachedTickets: breached,
      complianceRate: total > 0 ? compliant / total : 0,
      byPriority,
      periodStart: periodStart || filtered[0]?.createdAt,
      periodEnd: periodEnd || new Date(),
    };
  }

  getResolutionStats(tickets: Ticket[]): ResolutionStats {
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    const resolutionTimes = resolved
      .filter(t => t.resolutionNote)
      .map(t => t.updatedAt.getTime() - t.createdAt.getTime());

    const avgResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;
    const sorted = [...resolutionTimes].sort((a, b) => a - b);
    const medianResolutionTime = sorted.length > 0
      ? sorted[Math.floor(sorted.length / 2)]
      : 0;

    const byCategory: Record<string, number> = {};
    for (const t of resolved) {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    }

    return {
      totalResolved: resolved.length,
      avgResolutionTimeMs: avgResolutionTime,
      medianResolutionTimeMs: medianResolutionTime,
      byCategory,
      firstContactResolutionRate: 0,
    };
  }

  getBacklogAnalysis(tickets: Ticket[]): BacklogAnalysis {
    const now = Date.now();
    const open = tickets.filter(t => !['resolved', 'closed'].includes(t.status));

    const byAge: Record<string, number> = { '<1d': 0, '1-3d': 0, '3-7d': 0, '7-30d': 0, '>30d': 0 };
    for (const t of open) {
      const ageDays = (now - t.createdAt.getTime()) / 86400_000;
      if (ageDays < 1) byAge['<1d']++;
      else if (ageDays < 3) byAge['1-3d']++;
      else if (ageDays < 7) byAge['3-7d']++;
      else if (ageDays < 30) byAge['7-30d']++;
      else byAge['>30d']++;
    }

    const byStatus: Record<string, number> = {};
    for (const t of open) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    }

    const byPriority: Record<string, number> = {};
    for (const t of open) {
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    }

    const overdue = open.filter(t => t.dueDate && t.dueDate < new Date()).length;

    return {
      totalBacklog: open.length,
      byAge,
      byStatus,
      byPriority,
      overdueCount: overdue,
      avgAgeMs: open.length > 0
        ? open.reduce((sum, t) => sum + (now - t.createdAt.getTime()), 0) / open.length
        : 0,
    };
  }

  getTrendReport(
    tickets: Ticket[],
    options?: { days?: number; granularity?: 'hour' | 'day' | 'week' | 'month' }
  ): TrendReport {
    const days = options?.days || 30;
    const granularity = options?.granularity || 'day';
    const now = Date.now();
    const cutoff = now - days * 86400_000;

    const filtered = tickets.filter(t => t.createdAt.getTime() >= cutoff);

    const buckets = new Map<string, { created: number; resolved: number }>();

    for (const t of filtered) {
      const d = new Date(t.createdAt);
      let key: string;
      switch (granularity) {
        case 'hour': key = d.toISOString().slice(0, 13); break;
        case 'week': {
          const weekNum = Math.floor(d.getDate() / 7);
          key = `${d.getFullYear()}-W${weekNum}`;
          break;
        }
        case 'month': key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; break;
        default: key = d.toISOString().slice(0, 10);
      }

      if (!buckets.has(key)) buckets.set(key, { created: 0, resolved: 0 });
      const bucket = buckets.get(key)!;
      bucket.created++;

      if (t.status === 'resolved' || t.status === 'closed') {
        const resolveDate = new Date(t.updatedAt);
        let rKey: string;
        switch (granularity) {
          case 'hour': rKey = resolveDate.toISOString().slice(0, 13); break;
          case 'week': {
            const weekNum = Math.floor(resolveDate.getDate() / 7);
            rKey = `${resolveDate.getFullYear()}-W${weekNum}`;
            break;
          }
          case 'month': rKey = `${resolveDate.getFullYear()}-${String(resolveDate.getMonth() + 1).padStart(2, '0')}`; break;
          default: rKey = resolveDate.toISOString().slice(0, 10);
        }
        if (!buckets.has(rKey)) buckets.set(rKey, { created: 0, resolved: 0 });
        buckets.get(rKey)!.resolved++;
      }
    }

    const timeline = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({ period, ...data }));

    const totalCreated = filtered.length;
    const totalResolved = filtered.filter(t => t.status === 'resolved' || t.status === 'closed').length;

    return {
      totalCreated,
      totalResolved,
      netChange: totalCreated - totalResolved,
      timeline,
      granularity,
      days,
    };
  }
}
