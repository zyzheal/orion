# Auto Weekly Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build comprehensive weekly report generator combining DORA metrics, ticketing analysis, and system health into Markdown + JSON.

**Architecture:** Single `WeeklyReportService` under `efficiency/`, calling existing `DoraMetricsService` and `TicketService` for data. Persisted to PostgreSQL. REST API for on-demand generation and history.

**Tech Stack:** TypeScript, PostgreSQL (pg), Fastify

---

### Task 1: Database Migration for weekly_reports table

**Files:**
- Create: `src/db/migrations/051_create_weekly_reports.sql`
- Create: `src/db/migrations/051_rollback_create_weekly_reports.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration 051: Create weekly_reports table
-- Stores auto-generated weekly reports for audit and history

CREATE TABLE IF NOT EXISTS weekly_reports (
  id VARCHAR(64) PRIMARY KEY,
  team_id VARCHAR(64) NOT NULL DEFAULT 'default',
  week_start TIMESTAMPTZ NOT NULL,
  week_end TIMESTAMPTZ NOT NULL,
  report_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports (week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_team ON weekly_reports (team_id);
```

- [ ] **Step 2: Create rollback file**

```sql
-- Rollback Migration 051: Remove weekly_reports table
DROP TABLE IF EXISTS weekly_reports;
```

- [ ] **Step 3: Commit**

```bash
git add src/db/migrations/051_create_weekly_reports.sql src/db/migrations/051_rollback_create_weekly_reports.sql
git commit -m "feat: add weekly_reports migration (051)"
```

### Task 2: WeeklyReportService Core Implementation

**Files:**
- Create: `src/services/efficiency/WeeklyReportService.ts`
- Create: `src/services/efficiency/__tests__/WeeklyReportService.test.ts`
- Read: `src/services/efficiency/DoraMetricsService.ts` (for method signatures)
- Read: `src/services/ticketing/TicketService.ts` (for report method signatures)

- [ ] **Step 1: Read existing service signatures**

Read `src/services/efficiency/DoraMetricsService.ts` lines 50-150 to understand method names for:
- `getDeploymentFrequency(window, teamId?)`
- `getLeadTimeForChanges(window, teamId?)`
- `getChangeFailureRate(window, teamId?)`
- `getMeanTimeToRecovery(window, teamId?)`

Read `src/services/ticketing/TicketService.ts` lines 1220-1280 for:
- `getSLACompliance(periodStart?, periodEnd?)`
- `getResolutionStats()`
- `getBacklogAnalysis()`
- `getTrendReport(options?)`
- `getCountsByStatus()`
- `getStatistics()`

Read `src/services/efficiency/types.ts` for `DeploymentFrequency`, `ChangeFailureRate`, `MeanTimeToRecovery`, `DoraMetricsReport` types.

- [ ] **Step 2: Write the test file first**

```typescript
/**
 * WeeklyReportService Unit Tests
 */

import { WeeklyReportService, WeeklyReportConfig } from '../WeeklyReportService';
import { DoraMetricsService } from '../DoraMetricsService';
import { EventEmitter } from 'events';

// Minimal mocks
function createMockDoraService() {
  return {
    getDeploymentFrequency: jest.fn().mockReturnValue({
      totalDeployments: 15,
      successfulDeployments: 13,
      failedDeployments: 2,
      deploymentsPerDay: 2.14,
      frequencyLevel: 'daily' as const,
    }),
    getLeadTimeForChanges: jest.fn().mockReturnValue({
      totalChanges: 12,
      averageLeadTimeMs: 7200000,
      medianLeadTimeMs: 5400000,
      p90LeadTimeMs: 14400000,
      leadTimeLevel: 'high' as const,
    }),
    getChangeFailureRate: jest.fn().mockReturnValue({
      totalDeployments: 15,
      failedDeployments: 2,
      failureRate: 13.33,
      failureRateLevel: 'medium' as const,
    }),
    getMeanTimeToRecovery: jest.fn().mockReturnValue({
      totalIncidents: 3,
      meanRecoveryTimeMs: 1800000,
      medianRecoveryTimeMs: 1500000,
      recoveryLevel: 'high' as const,
    }),
  };
}

function createMockTicketService() {
  return {
    getSLACompliance: jest.fn().mockReturnValue({
      totalTickets: 25,
      slaCompliant: 20,
      breached: 5,
      complianceRate: 80,
    }),
    getResolutionStats: jest.fn().mockReturnValue({
      averageResolutionTimeMs: 3600000,
      medianResolutionTimeMs: 2700000,
      byPriority: { critical: 1800000, high: 3600000, medium: 7200000 },
    }),
    getBacklogAnalysis: jest.fn().mockReturnValue({
      total: 10,
      overdue: 2,
      ageDistribution: { '<1d': 3, '1-3d': 4, '3-7d': 2, '>7d': 1 },
    }),
    getTrendReport: jest.fn().mockReturnValue({
      created: [3, 4, 5, 3, 4, 3, 3],
      resolved: [2, 3, 4, 3, 3, 4, 6],
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    }),
    getStatistics: jest.fn().mockReturnValue({
      total: 100,
      open: 10,
      assigned: 15,
      'in-progress': 5,
      resolved: 30,
      closed: 40,
    }),
    listTickets: jest.fn().mockReturnValue([]),
    workflow: {
      getCountsByStatus: jest.fn().mockReturnValue({
        open: 10, assigned: 15, 'in-progress': 5, resolved: 30, closed: 40,
      }),
    },
  };
}

describe('WeeklyReportService', () => {
  let service: WeeklyReportService;
  let mockDora: ReturnType<typeof createMockDoraService>;
  let mockTicket: ReturnType<typeof createMockTicketService>;

  beforeEach(() => {
    mockDora = createMockDoraService();
    mockTicket = createMockTicketService();
    service = new WeeklyReportService({
      doraService: mockDora as unknown as DoraMetricsService,
      ticketService: mockTicket as any,
    });
  });

  it('should generate a weekly report', async () => {
    const weekStart = new Date('2026-04-21');
    const report = await service.generateReport({ weekStart, teamId: 'default' });

    expect(report).toBeDefined();
    expect(report.markdown).toContain('# Weekly Report');
    expect(report.markdown).toContain('DORA');
    expect(report.markdown).toContain('Ticketing');
    expect(report.json).toBeDefined();
  });

  it('should calculate week boundaries correctly', () => {
    const date = new Date('2026-04-24');
    const bounds = service.getWeekBoundaries(date);
    expect(bounds.start.getDay()).toBe(1); // Monday
    expect(bounds.end.getDate()).toBe(bounds.start.getDate() + 6);
  });

  it('should include executive summary with key metrics', async () => {
    const report = await service.generateReport({ weekStart: new Date() });
    expect(report.markdown).toContain('deployments');
    expect(report.markdown).toContain('failure');
  });

  it('should compute health score', async () => {
    const report = await service.generateReport({ weekStart: new Date() });
    expect(report.healthScore).toBeDefined();
    expect(['green', 'yellow', 'red']).toContain(report.healthScore);
  });

  it('should return JSON with all sections', async () => {
    const report = await service.generateReport({ weekStart: new Date() });
    expect(report.json.executiveSummary).toBeDefined();
    expect(report.json.doraMetrics).toBeDefined();
    expect(report.json.ticketing).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/services/efficiency/__tests__/WeeklyReportService.test.ts -v`
Expected: FAIL with "WeeklyReportService not defined"

- [ ] **Step 4: Write WeeklyReportService implementation**

```typescript
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
import { TimeWindow } from './types';

// Import TicketService types (avoid circular by using interface)
interface TicketReport {
  slaCompliance: { complianceRate: number; breached: number; totalTickets: number };
  resolutionStats: { averageResolutionTimeMs: number; byPriority: Record<string, number> };
  backlogAnalysis: { total: number; overdue: number; ageDistribution: Record<string, number> };
  trendReport: { created: number[]; resolved: number[]; labels: string[] };
  statistics: Record<string, number>;
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
  ticketService: any; // TicketService — loose coupling to avoid circular import
  db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
}

export class WeeklyReportService {
  private doraService: DoraMetricsService;
  private ticketService: any;
  private db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(config: WeeklyReportConfig) {
    this.doraService = config.doraService;
    this.ticketService = config.ticketService;
    this.db = config.db;
  }

  /**
   * Generate a weekly report
   */
  async generateReport(options: WeeklyReportOptions = {}): Promise<WeeklyReport> {
    const weekStart = options.weekStart || this.getWeekBoundaries(new Date()).start;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const teamId = options.teamId || 'default';

    // Collect data from all sources
    const doraData = await this.collectDoraMetrics(weekStart, weekEnd);
    const ticketData = await this.collectTicketData(weekStart, weekEnd);

    // Compute health score
    const healthScore = this.computeHealthScore(doraData, ticketData);

    // Build sections
    const executiveSummary = this.buildExecutiveSummary(doraData, ticketData);
    const doraSection = this.buildDoraSection(doraData);
    const ticketingSection = this.buildTicketingSection(ticketData);

    // Assemble Markdown
    const markdown = [
      `# Weekly Report`,
      ``,
      `**Team:** ${teamId}`,
      `**Period:** ${this.formatDate(weekStart)} — ${this.formatDate(weekEnd)}`,
      `**Generated:** ${new Date().toISOString()}`,
      `**Health:** ${this.healthBadge(healthScore)}`,
      ``,
      `## Executive Summary`,
      ``,
      executiveSummary,
      ``,
      `## DORA Metrics`,
      ``,
      doraSection,
      ``,
      `## Ticketing Analysis`,
      ``,
      ticketingSection,
      ``,
    ].join('\n');

    // Assemble JSON
    const json = {
      teamId,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      healthScore,
      executiveSummary,
      doraMetrics: doraData,
      ticketing: ticketData,
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

  private async collectDoraMetrics(weekStart: Date, weekEnd: Date) {
    const window: TimeWindow = 'week';
    const freq = this.doraService.getDeploymentFrequency(window);
    const leadTime = this.doraService.getLeadTimeForChanges(window);
    const failureRate = this.doraService.getChangeFailureRate(window);
    const mttr = this.doraService.getMeanTimeToRecovery(window);

    return {
      deploymentFrequency: {
        total: freq?.totalDeployments || 0,
        successful: freq?.successfulDeployments || 0,
        perDay: freq?.deploymentsPerDay || 0,
        level: freq?.frequencyLevel || 'yearly',
      },
      leadTime: {
        medianMs: leadTime?.medianLeadTimeMs || 0,
        p90Ms: leadTime?.p90LeadTimeMs || 0,
        level: leadTime?.leadTimeLevel || 'low',
      },
      failureRate: {
        percentage: failureRate?.failureRate || 0,
        level: failureRate?.failureRateLevel || 'low',
      },
      mttr: {
        medianMs: mttr?.medianRecoveryTimeMs || 0,
        level: mttr?.recoveryLevel || 'low',
      },
    };
  }

  private async collectTicketData(weekStart: Date, weekEnd: Date): Promise<TicketReport> {
    const sla = this.ticketService.getSLACompliance(weekStart, weekEnd);
    const resolution = this.ticketService.getResolutionStats();
    const backlog = this.ticketService.getBacklogAnalysis();
    const trend = this.ticketService.getTrendReport({ days: 7 });
    const stats = this.ticketService.getStatistics();

    return {
      slaCompliance: {
        complianceRate: sla?.complianceRate || 0,
        breached: sla?.breached || 0,
        totalTickets: sla?.totalTickets || 0,
      },
      resolutionStats: {
        averageResolutionTimeMs: resolution?.averageResolutionTimeMs || 0,
        byPriority: resolution?.byPriority || {},
      },
      backlogAnalysis: {
        total: backlog?.total || 0,
        overdue: backlog?.overdue || 0,
        ageDistribution: backlog?.ageDistribution || {},
      },
      trendReport: {
        created: trend?.created || [],
        resolved: trend?.resolved || [],
        labels: trend?.labels || [],
      },
      statistics: stats || {},
    };
  }

  private buildExecutiveSummary(dora: any, tickets: TicketReport): string {
    const lines = [
      `- **Deployments:** ${dora.deploymentFrequency.total} (${dora.deploymentFrequency.perDay.toFixed(1)}/day) — DORA: ${this.levelBadge(dora.deploymentFrequency.level)}`,
      `- **Change Failure Rate:** ${dora.failureRate.percentage.toFixed(1)}% — DORA: ${this.levelBadge(dora.failureRate.level)}`,
      `- **Lead Time (median):** ${this.formatDuration(dora.leadTime.medianMs)}`,
      `- **MTTR (median):** ${this.formatDuration(dora.mttr.medianMs)}`,
      ``,
      `- **Tickets Created:** ${tickets.slaCompliance.totalTickets}`,
      `- **SLA Compliance:** ${tickets.slaCompliance.complianceRate.toFixed(1)}% (${tickets.slaCompliance.breached} breached)`,
      `- **Backlog:** ${tickets.backlogAnalysis.total} (${tickets.backlogAnalysis.overdue} overdue)`,
    ];

    return lines.join('\n');
  }

  private buildDoraSection(dora: any): string {
    return [
      `| Metric | Value | DORA Level |`,
      `|--------|-------|------------|`,
      `| Deployment Frequency | ${dora.deploymentFrequency.total} (${dora.deploymentFrequency.perDay.toFixed(1)}/day) | ${dora.deploymentFrequency.level} |`,
      `| Lead Time (median) | ${this.formatDuration(dora.leadTime.medianMs)} | ${dora.leadTime.level} |`,
      `| Change Failure Rate | ${dora.failureRate.percentage.toFixed(1)}% | ${dora.failureRate.level} |`,
      `| MTTR (median) | ${this.formatDuration(dora.mttr.medianMs)} | ${dora.mttr.level} |`,
    ].join('\n');
  }

  private buildTicketingSection(tickets: TicketReport): string {
    const lines = [
      `### SLA Compliance`,
      ``,
      `- **Compliance Rate:** ${tickets.slaCompliance.complianceRate.toFixed(1)}%`,
      `- **Breached:** ${tickets.slaCompliance.breached} / ${tickets.slaCompliance.totalTickets}`,
      ``,
      `### Backlog`,
      ``,
      `- **Total:** ${tickets.backlogAnalysis.total}`,
      `- **Overdue:** ${tickets.backlogAnalysis.overdue}`,
    ];

    // Age distribution table
    const ages = tickets.backlogAnalysis.ageDistribution;
    if (Object.keys(ages).length > 0) {
      lines.push(
        ``,
        `| Age | Count |`,
        `|-----|-------|`,
      );
      for (const [age, count] of Object.entries(ages)) {
        lines.push(`| ${age} | ${count} |`);
      }
    }

    // Trend chart (text-based)
    const trend = tickets.trendReport;
    if (trend.created.length > 0) {
      lines.push(
        ``,
        `### Weekly Trend`,
        ``,
        trend.labels.map((label, i) =>
          `${label}: ${'█'.repeat(trend.created[i] || 0)}${'░'.repeat(Math.max(0, 10 - (trend.created[i] || 0)))} (${trend.created[i] || 0} created, ${trend.resolved[i] || 0} resolved)`
        ).join('\n'),
      );
    }

    return lines.join('\n');
  }

  private computeHealthScore(dora: any, tickets: TicketReport): 'green' | 'yellow' | 'red' {
    let score = 0;
    // DORA failure rate
    if (dora.failureRate.percentage > 20) score += 3;
    else if (dora.failureRate.percentage > 10) score += 2;
    else if (dora.failureRate.percentage > 5) score += 1;

    // SLA compliance
    if (tickets.slaCompliance.complianceRate < 60) score += 3;
    else if (tickets.slaCompliance.complianceRate < 80) score += 2;
    else if (tickets.slaCompliance.complianceRate < 95) score += 1;

    // Overdue tickets
    if (tickets.backlogAnalysis.overdue > 5) score += 2;
    else if (tickets.backlogAnalysis.overdue > 0) score += 1;

    if (score >= 5) return 'red';
    if (score >= 2) return 'yellow';
    return 'green';
  }

  private persistReport(report: WeeklyReport): Promise<void> {
    if (!this.db) return Promise.resolve();
    return this.db.query(
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

  private levelBadge(level: string): string {
    const badges: Record<string, string> = {
      elite: '🟢 Elite',
      high: '🟡 High',
      medium: '🟠 Medium',
      low: '🔴 Low',
      on_demand: '🟢 On-Demand',
      daily: '🟢 Daily',
      weekly: '🟡 Weekly',
      monthly: '🟠 Monthly',
      yearly: '🔴 Yearly',
    };
    return badges[level] || level;
  }

  private healthBadge(score: 'green' | 'yellow' | 'red'): string {
    const badges = { green: '🟢 Healthy', yellow: '🟡 Warning', red: '🔴 Critical' };
    return badges[score];
  }
}

export const weeklyReportService = new WeeklyReportService({
  doraService: new (DoraMetricsService as any)(),
  ticketService: null,
});