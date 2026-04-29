/**
 * TicketAnalyticsService - PostgreSQL-backed ticket analytics for WeeklyReportService
 *
 * Queries tickets and ticket_sla tables directly to provide:
 * - SLA compliance reports
 * - Resolution time statistics
 * - Backlog analysis
 * - Trend reports
 * - Overall statistics
 */

import { DatabasePool } from '../database';

export interface SLAComplianceReport {
  complianceRate: number;
  breachedTickets: number;
  totalTickets: number;
}

export interface ResolutionStats {
  meanResolutionTimeMs: number;
  medianResolutionTimeMs: number;
}

export interface BacklogAnalysis {
  openCount: number;
  overdueCount: number;
  averageAgeMs: number;
  oldestTicketAgeMs: number;
}

export interface TrendDataPoint {
  period: string;
  created: number;
  resolved: number;
  open: number;
}

export interface TrendReport {
  dataPoints: TrendDataPoint[];
  totalCreated: number;
  totalResolved: number;
  trend: string;
}

export interface TicketStatistics {
  totalTickets: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  averageResolutionTimeMs: number;
  slaComplianceRate: number;
}

export class TicketAnalyticsService {
  private db: DatabasePool;

  constructor(db: DatabasePool) {
    this.db = db;
  }

  /**
   * Get SLA compliance for a given period
   */
  async getSLACompliance(periodStart?: Date, periodEnd?: Date): Promise<SLAComplianceReport> {
    let whereClause = '';
    const params: unknown[] = [];

    if (periodStart) {
      params.push(periodStart);
      whereClause += ` AND ts.created_at >= $${params.length}`;
    }
    if (periodEnd) {
      params.push(periodEnd);
      whereClause += ` AND ts.created_at <= $${params.length}`;
    }

    const query = `
      SELECT
        COUNT(ts.id) AS total,
        COUNT(ts.id) FILTER (WHERE ts.resolution_breached OR ts.response_breached) AS breached
      FROM ticket_sla ts
      WHERE 1=1 ${whereClause}
    `;

    const result = await this.db.query(query, params);
    const total = parseInt(result.rows[0]?.total || '0', 10);
    const breached = parseInt(result.rows[0]?.breached || '0', 10);

    return {
      complianceRate: total > 0 ? ((total - breached) / total) * 100 : 100,
      breachedTickets: breached,
      totalTickets: total,
    };
  }

  /**
   * Get resolution time statistics
   */
  async getResolutionStats(): Promise<ResolutionStats> {
    const query = `
      SELECT
        AVG(EXTRACT(EPOCH FROM (ts.resolved_at - t.created_at)) * 1000) AS mean_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (ts.resolved_at - t.created_at)) * 1000) AS median_ms
      FROM ticket_sla ts
      JOIN tickets t ON t.id = ts.ticket_id
      WHERE ts.resolved_at IS NOT NULL
    `;

    const result = await this.db.query(query);
    return {
      meanResolutionTimeMs: parseFloat(result.rows[0]?.mean_ms || '0'),
      medianResolutionTimeMs: parseFloat(result.rows[0]?.median_ms || '0'),
    };
  }

  /**
   * Get backlog analysis
   */
  async getBacklogAnalysis(): Promise<BacklogAnalysis> {
    const query = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE ts.resolution_breached) AS overdue,
        AVG(EXTRACT(EPOCH FROM (NOW() - t.created_at)) * 1000) AS avg_age_ms,
        MAX(EXTRACT(EPOCH FROM (NOW() - t.created_at)) * 1000) AS oldest_age_ms
      FROM tickets t
      LEFT JOIN ticket_sla ts ON ts.ticket_id = t.id
      WHERE t.status IN ('open', 'assigned', 'in-progress')
    `;

    const result = await this.db.query(query);
    return {
      openCount: parseInt(result.rows[0]?.total || '0', 10),
      overdueCount: parseInt(result.rows[0]?.overdue || '0', 10),
      averageAgeMs: parseFloat(result.rows[0]?.avg_age_ms || '0'),
      oldestTicketAgeMs: parseFloat(result.rows[0]?.oldest_age_ms || '0'),
    };
  }

  /**
   * Get trend report for the last N days
   */
  async getTrendReport(options: { days?: number } = {}): Promise<TrendReport> {
    const days = options.days || 7;
    const query = `
      SELECT
        TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS period,
        COUNT(*) AS created,
        COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) AS resolved,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed')) AS open
      FROM tickets
      WHERE created_at >= NOW() - INTERVAL '1 day' * $1
      GROUP BY 1
      ORDER BY 1
    `;

    const result = await this.db.query(query, [days]);
    const dataPoints: TrendDataPoint[] = result.rows.map((row) => ({
      period: row.period,
      created: parseInt(row.created, 10),
      resolved: parseInt(row.resolved, 10),
      open: parseInt(row.open, 10),
    }));

    const totalCreated = dataPoints.reduce((sum, dp) => sum + dp.created, 0);
    const totalResolved = dataPoints.reduce((sum, dp) => sum + dp.resolved, 0);

    // Determine trend
    let trend = 'stable';
    if (dataPoints.length >= 2) {
      const recent = dataPoints.slice(-3).reduce((s, dp) => s + dp.created, 0) / 3;
      const earlier = dataPoints.slice(0, -3).reduce((s, dp) => s + dp.created, 0) / Math.max(dataPoints.length - 3, 1);
      if (recent > earlier * 1.1) trend = 'increasing';
      else if (recent < earlier * 0.9) trend = 'decreasing';
    }

    return { dataPoints, totalCreated, totalResolved, trend };
  }

  /**
   * Get overall ticket statistics
   */
  async getStatistics(): Promise<TicketStatistics> {
    const [statusResult, priorityResult, categoryResult, totalResult, slaResult, resolutionResult] = await Promise.all([
      this.db.query(`SELECT status, COUNT(*) as count FROM tickets GROUP BY status`),
      this.db.query(`SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority`),
      this.db.query(`SELECT type AS category, COUNT(*) as count FROM tickets GROUP BY type`),
      this.db.query(`SELECT COUNT(*) as count FROM tickets`),
      this.db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE NOT (resolution_breached OR response_breached)) AS compliant FROM ticket_sla`),
      this.db.query(`SELECT AVG(EXTRACT(EPOCH FROM (ts.resolved_at - t.created_at)) * 1000) AS avg_ms FROM ticket_sla ts JOIN tickets t ON t.id = ts.ticket_id WHERE ts.resolved_at IS NOT NULL`),
    ]);

    const stats: TicketStatistics = {
      totalTickets: parseInt(totalResult.rows[0]?.count || '0', 10),
      byStatus: {},
      byPriority: {},
      byCategory: {},
      averageResolutionTimeMs: parseFloat(resolutionResult.rows[0]?.avg_ms || '0'),
      slaComplianceRate: 100,
    };

    for (const row of statusResult.rows) {
      stats.byStatus[row.status] = parseInt(row.count, 10);
    }
    for (const row of priorityResult.rows) {
      stats.byPriority[row.priority] = parseInt(row.count, 10);
    }
    for (const row of categoryResult.rows) {
      stats.byCategory[row.category] = parseInt(row.count, 10);
    }

    const slaTotal = parseInt(slaResult.rows[0]?.total || '0', 10);
    const slaCompliant = parseInt(slaResult.rows[0]?.compliant || '0', 10);
    stats.slaComplianceRate = slaTotal > 0 ? (slaCompliant / slaTotal) * 100 : 100;

    return stats;
  }
}
