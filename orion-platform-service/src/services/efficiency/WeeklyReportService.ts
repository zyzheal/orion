/**
 * Auto Weekly Report Service
 *
 * Generates comprehensive weekly reports combining:
 * - DORA metrics (deployment frequency, lead time, failure rate, MTTR)
 * - Ticketing analysis (SLA compliance, resolution, backlog)
 * - System health summary
 *
 * Output: Markdown (human-readable) + JSON (machine-readable)
 */

import { v4 as uuidv4 } from 'uuid';
import { DoraMetricsService } from './DoraMetricsService';
import { PipelineCompletionRecord, DeploymentRecord, TimeWindow, DoraMetricsReport } from './types';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'LWeekly-LReport-LService' });

// Loose TicketService interface to avoid circular imports
// Supports both sync (in-memory fallback) and async (PostgreSQL-backed) implementations
interface TicketServiceLike {
  getSLACompliance(periodStart?: Date, periodEnd?: Date): { complianceRate: number; breachedTickets: number; totalTickets: number } | Promise<{ complianceRate: number; breachedTickets: number; totalTickets: number }>;
  getResolutionStats(): { meanResolutionTimeMs: number; medianResolutionTimeMs: number } | Promise<{ meanResolutionTimeMs: number; medianResolutionTimeMs: number }>;
  getBacklogAnalysis(): { openCount: number; overdueCount: number; averageAgeMs: number; oldestTicketAgeMs: number } | Promise<{ openCount: number; overdueCount: number; averageAgeMs: number; oldestTicketAgeMs: number }>;
  getTrendReport(options?: { days?: number; granularity?: string }): { dataPoints: Array<{ period: string; created: number; resolved: number; open: number }>; totalCreated: number; totalResolved: number; trend: string } | Promise<{ dataPoints: Array<{ period: string; created: number; resolved: number; open: number }>; totalCreated: number; totalResolved: number; trend: string }>;
  getStatistics(): { totalTickets: number; byStatus: Record<string, number>; byPriority: Record<string, number>; byCategory: Record<string, number>; averageResolutionTimeMs: number; slaComplianceRate: number } | Promise<{ totalTickets: number; byStatus: Record<string, number>; byPriority: Record<string, number>; byCategory: Record<string, number>; averageResolutionTimeMs: number; slaComplianceRate: number }>;
}

// Data source for DORA raw records
interface DoraDataSource {
  getPipelineRecords(filter?: { since?: Date }): Promise<PipelineCompletionRecord[]>;
  getDeploymentRecords(filter?: { since?: Date }): Promise<DeploymentRecord[]>;
}

export interface WeeklyReport {
  reportId: string;
  teamId: string;
  weekStart: Date;
  weekEnd: Date;
  generatedAt: Date;
  healthScore: 'green' | 'yellow' | 'red';
  markdown: string;
  json: Record<string, unknown>;
}

export interface WeeklyReportOptions {
  weekStart?: Date;
  teamId?: string;
}

export interface WeeklyReportConfig {
  doraService: DoraMetricsService;
  ticketService: TicketServiceLike;
  dataSource: DoraDataSource;
  db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
}

export class WeeklyReportService {
  private doraService: DoraMetricsService;
  private ticketService: TicketServiceLike;
  private dataSource: DoraDataSource;
  private db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(config: WeeklyReportConfig) {
    this.doraService = config.doraService;
    this.ticketService = config.ticketService;
    this.dataSource = config.dataSource;
    this.db = config.db;
  }

  /**
   * Generate a weekly report
   */
  async generateReport(options: WeeklyReportOptions = {}): Promise<WeeklyReport> {
    const { start: weekStart, end: weekEnd } = options.weekStart
      ? this.getWeekBoundaries(options.weekStart)
      : this.getWeekBoundaries(new Date());

    const teamId = options.teamId || 'default';

    // Collect data from all sources
    const [pipelineRecords, deploymentRecords] = await Promise.all([
      this.dataSource.getPipelineRecords({ since: weekStart }),
      this.dataSource.getDeploymentRecords({ since: weekStart }),
    ]);

    const windowConfig = this.doraService.buildTimeWindow('week', 1, weekEnd);
    const doraReport = this.doraService.generateReport(teamId, pipelineRecords, deploymentRecords, windowConfig);

    const [slaCompliance, resolutionStats, backlogAnalysis, trendReport, statistics] = await Promise.all([
      this.ticketService.getSLACompliance(weekStart, weekEnd),
      this.ticketService.getResolutionStats(),
      this.ticketService.getBacklogAnalysis(),
      this.ticketService.getTrendReport({ days: 7 }),
      this.ticketService.getStatistics(),
    ]);

    // Compute health score
    const healthScore = this.computeHealthScore(doraReport, {
      slaComplianceRate: slaCompliance.complianceRate,
      breachedTickets: slaCompliance.breachedTickets,
      overdue: backlogAnalysis.overdueCount,
    });

    // Build sections
    const executiveSummary = this.buildExecutiveSummary(doraReport, {
      slaComplianceRate: slaCompliance.complianceRate,
      breachedTickets: slaCompliance.breachedTickets,
      totalCreated: trendReport.totalCreated,
      overdue: backlogAnalysis.overdueCount,
      totalBacklog: backlogAnalysis.openCount,
    });
    const doraSection = this.buildDoraSection(doraReport);
    const ticketingSection = this.buildTicketingSection({
      slaCompliance,
      resolutionStats,
      backlogAnalysis,
      trendReport,
      statistics,
    });

    // Assemble Markdown
    const markdown = [
      '# Weekly Report',
      '',
      `**Team:** ${teamId}`,
      `**Period:** ${this.formatDate(weekStart)} — ${this.formatDate(weekEnd)}`,
      `**Generated:** ${new Date().toISOString()}`,
      `**Health:** ${this.healthBadge(healthScore)}`,
      '',
      '## Executive Summary',
      '',
      executiveSummary,
      '',
      '## DORA Metrics',
      '',
      doraSection,
      '',
      '## Ticketing Analysis',
      '',
      ticketingSection,
      '',
    ].join('\n');

    // Assemble JSON
    const json = {
      teamId,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      healthScore,
      dora: {
        overallLevel: doraReport.overallLevel,
        deploymentFrequency: {
          total: doraReport.deploymentFrequency.totalDeployments,
          successful: doraReport.deploymentFrequency.successfulDeployments,
          failed: doraReport.deploymentFrequency.failedDeployments,
          perDay: doraReport.deploymentFrequency.deploymentsPerDay,
          level: doraReport.deploymentFrequency.frequencyLevel,
        },
        leadTime: {
          medianMs: doraReport.leadTimeForChanges.medianLeadTimeMs,
          p90Ms: doraReport.leadTimeForChanges.p90LeadTimeMs,
          p99Ms: doraReport.leadTimeForChanges.p99LeadTimeMs,
          level: doraReport.leadTimeForChanges.leadTimeLevel,
        },
        failureRate: {
          percentage: doraReport.changeFailureRate.failureRate,
          level: doraReport.changeFailureRate.failureRateLevel,
        },
        mttr: {
          medianMs: doraReport.meanTimeToRecovery.medianRecoveryTimeMs,
          p90Ms: doraReport.meanTimeToRecovery.p90RecoveryTimeMs,
          level: doraReport.meanTimeToRecovery.recoveryTimeLevel,
        },
      },
      ticketing: {
        slaComplianceRate: slaCompliance.complianceRate,
        slaBreached: slaCompliance.breachedTickets,
        totalTickets: slaCompliance.totalTickets,
        averageResolutionTimeMs: resolutionStats.meanResolutionTimeMs,
        backlog: {
          total: backlogAnalysis.openCount,
          overdue: backlogAnalysis.overdueCount,
        },
        byStatus: statistics.byStatus,
        byPriority: statistics.byPriority,
      },
      markdown,
    };

    const report: WeeklyReport = {
      reportId: `WR-${uuidv4()}`,
      teamId,
      weekStart,
      weekEnd,
      generatedAt: new Date(),
      healthScore,
      markdown,
      json,
    };

    // Persist if DB available
    if (this.db) {
      await this.persistReport(report);
    }

    return report;
  }

  /**
   * Get week start (Monday) and end (Sunday) for a given date
   */
  getWeekBoundaries(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday = 1
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * List past reports from DB
   */
  async listHistory(options: { teamId?: string; limit?: number } = {}): Promise<Array<{ id: string; teamId: string; weekStart: string; weekEnd: string; healthScore: string }>> {
    if (this.db) {
      const limit = options.limit || 12;
      let query = 'SELECT id, team_id, week_start, week_end, report_data FROM weekly_reports';
      const params: unknown[] = [];
      if (options.teamId) {
        query += ' WHERE team_id = $1';
        params.push(options.teamId);
      }
      query += ` ORDER BY week_start DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await this.db.query(query, params);
      return result.rows.map(row => ({
        id: row.id,
        teamId: row.team_id,
        weekStart: row.week_start,
        weekEnd: row.week_end,
        healthScore: row.report_data?.healthScore || 'unknown',
      }));
    }
    return [];
  }

  /**
   * Get a specific report by ID
   */
  async getReport(id: string): Promise<WeeklyReport | null> {
    if (this.db) {
      const result = await this.db.query(
        'SELECT * FROM weekly_reports WHERE id = $1',
        [id],
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          reportId: row.id,
          teamId: row.team_id,
          weekStart: new Date(row.week_start),
          weekEnd: new Date(row.week_end),
          generatedAt: new Date(row.created_at),
          healthScore: row.report_data?.healthScore || 'yellow',
          markdown: row.report_data?.markdown || '',
          json: row.report_data,
        };
      }
    }
    return null;
  }

  // ==================== Internal Methods ====================

  private buildExecutiveSummary(dora: DoraMetricsReport, tickets: { slaComplianceRate: number; breachedTickets: number; totalCreated: number; overdue: number; totalBacklog: number }): string {
    const lines = [
      `- **Deployments:** ${dora.deploymentFrequency.totalDeployments} (${dora.deploymentFrequency.deploymentsPerDay.toFixed(1)}/day) — DORA: ${this.levelLabel(dora.deploymentFrequency.frequencyLevel)}`,
      `- **Change Failure Rate:** ${dora.changeFailureRate.failureRate.toFixed(1)}% — DORA: ${this.levelLabel(dora.changeFailureRate.failureRateLevel)}`,
      `- **Lead Time (median):** ${this.formatDuration(dora.leadTimeForChanges.medianLeadTimeMs)}`,
      `- **MTTR (median):** ${this.formatDuration(dora.meanTimeToRecovery.medianRecoveryTimeMs)}`,
      '',
      `- **Tickets Created:** ${tickets.totalCreated}`,
      `- **SLA Compliance:** ${tickets.slaComplianceRate.toFixed(1)}% (${tickets.breachedTickets} breached)`,
      `- **Backlog:** ${tickets.totalBacklog} (${tickets.overdue} overdue)`,
    ];

    return lines.join('\n');
  }

  private buildDoraSection(dora: DoraMetricsReport): string {
    return [
      '| Metric | Value | DORA Level |',
      '|--------|-------|------------|',
      `| Deployment Frequency | ${dora.deploymentFrequency.totalDeployments} (${dora.deploymentFrequency.deploymentsPerDay.toFixed(1)}/day) | ${dora.deploymentFrequency.frequencyLevel} |`,
      `| Lead Time (median) | ${this.formatDuration(dora.leadTimeForChanges.medianLeadTimeMs)} | ${dora.leadTimeForChanges.leadTimeLevel} |`,
      `| Change Failure Rate | ${dora.changeFailureRate.failureRate.toFixed(1)}% | ${dora.changeFailureRate.failureRateLevel} |`,
      `| MTTR (median) | ${this.formatDuration(dora.meanTimeToRecovery.medianRecoveryTimeMs)} | ${dora.meanTimeToRecovery.recoveryTimeLevel} |`,
      '',
      `**Overall Level:** ${dora.overallLevel}`,
    ].join('\n');
  }

  private buildTicketingSection(data: {
    slaCompliance: { complianceRate: number; breachedTickets: number; totalTickets: number };
    resolutionStats: { meanResolutionTimeMs: number; medianResolutionTimeMs: number };
    backlogAnalysis: { openCount: number; overdueCount: number; averageAgeMs: number; oldestTicketAgeMs: number };
    trendReport: { dataPoints: Array<{ period: string; created: number; resolved: number; open: number }>; totalCreated: number; totalResolved: number };
    statistics: { byStatus: Record<string, number>; byPriority: Record<string, number> };
  }): string {
    const { slaCompliance, resolutionStats, backlogAnalysis, trendReport, statistics } = data;

    const lines = [
      '### SLA Compliance',
      '',
      `- **Compliance Rate:** ${slaCompliance.complianceRate.toFixed(1)}%`,
      `- **Breached:** ${slaCompliance.breachedTickets} / ${slaCompliance.totalTickets}`,
      '',
      '### Resolution Time',
      '',
      `- **Mean:** ${this.formatDuration(resolutionStats.meanResolutionTimeMs)}`,
      `- **Median:** ${this.formatDuration(resolutionStats.medianResolutionTimeMs)}`,
      '',
      '### Tickets by Status',
      '',
    ];

    for (const [status, count] of Object.entries(statistics.byStatus)) {
      if (count > 0) {
        lines.push(`- **${status}:** ${count}`);
      }
    }

    lines.push('', '### Backlog', '');
    lines.push(`- **Total:** ${backlogAnalysis.openCount}`);
    lines.push(`- **Overdue:** ${backlogAnalysis.overdueCount}`);

    // Average age info
    if (backlogAnalysis.averageAgeMs) {
      lines.push(`- **Avg Age:** ${this.formatDuration(backlogAnalysis.averageAgeMs)}`);
    }

    // Trend chart (text-based)
    if (trendReport.dataPoints.length > 0) {
      lines.push(
        '',
        '### Weekly Trend',
        '',
      );
      const maxVal = Math.max(...trendReport.dataPoints.map(dp => dp.created), 1);
      for (const dp of trendReport.dataPoints) {
        const bar = '█'.repeat(Math.round(dp.created / maxVal * 10));
        lines.push(`${dp.period}: ${bar} (${dp.created} created, ${dp.resolved} resolved)`);
      }
    }

    return lines.join('\n');
  }

  private computeHealthScore(dora: DoraMetricsReport, tickets: { slaComplianceRate: number; breachedTickets: number; overdue: number }): 'green' | 'yellow' | 'red' {
    let score = 0;

    // DORA failure rate
    if (dora.changeFailureRate.failureRate > 20) score += 3;
    else if (dora.changeFailureRate.failureRate > 10) score += 2;
    else if (dora.changeFailureRate.failureRate > 5) score += 1;

    // SLA compliance
    if (tickets.slaComplianceRate < 60) score += 3;
    else if (tickets.slaComplianceRate < 80) score += 2;
    else if (tickets.slaComplianceRate < 95) score += 1;

    // Overdue tickets
    if (tickets.overdue > 5) score += 2;
    else if (tickets.overdue > 0) score += 1;

    if (score >= 5) return 'red';
    if (score >= 2) return 'yellow';
    return 'green';
  }

  private async persistReport(report: WeeklyReport): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.query(
        `INSERT INTO weekly_reports (id, team_id, week_start, week_end, report_data)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [
          report.reportId,
          report.teamId,
          report.weekStart,
          report.weekEnd,
          { ...report.json, markdown: report.markdown },
        ],
      );
    } catch (err) {
      logger.error(`[WeeklyReportService] Failed to persist report ${report.reportId} (team=${report.teamId}, week=${this.formatDate(report.weekStart)}):`, err);
      // Report generation still succeeds; only persistence fails
      // Emit error event for monitoring systems
      this.emitPersistenceError(report, err);
    }
  }

  private emitPersistenceError(report: WeeklyReport, error: unknown): void {
    // Log structured error for monitoring/alerting
    const errorDetails = {
      event: 'weekly_report.persistence_failed',
      reportId: report.reportId,
      teamId: report.teamId,
      weekStart: report.weekStart.toISOString(),
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
    logger.error('[WeeklyReportService]', JSON.stringify(errorDetails));
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  private formatDuration(ms: number): string {
    if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(0)}m`;
    if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`;
    return `${(ms / 86400000).toFixed(1)}d`;
  }

  private levelLabel(level: string): string {
    return level.charAt(0).toUpperCase() + level.slice(1);
  }

  private healthBadge(score: 'green' | 'yellow' | 'red'): string {
    const badges = { green: 'Healthy', yellow: 'Warning', red: 'Critical' };
    return badges[score];
  }
}
