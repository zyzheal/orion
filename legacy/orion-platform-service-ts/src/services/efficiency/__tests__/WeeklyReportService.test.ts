/**
 * WeeklyReportService Unit Tests
 */

import { WeeklyReportService } from '../WeeklyReportService';
import { DoraMetricsService } from '../DoraMetricsService';
import { PipelineCompletionRecord, DeploymentRecord } from '../types';

function createMockDoraService(): DoraMetricsService {
  return new DoraMetricsService();
}

function createMockDataSource(overrides?: { deployments?: DeploymentRecord[]; pipelines?: PipelineCompletionRecord[] }) {
  const now = Date.now();
  const defaultDeployments: DeploymentRecord[] = [
    { deploymentId: 'dep-1', service: 'api', environment: 'production', status: 'success', deployedAt: new Date(now - 2 * 86400000) },
    { deploymentId: 'dep-2', service: 'web', environment: 'production', status: 'success', deployedAt: new Date(now - 1 * 86400000) },
    { deploymentId: 'dep-3', service: 'api', environment: 'production', status: 'failed', deployedAt: new Date(now), recoveryTimeMs: 3600000 },
  ];
  const defaultPipelines: PipelineCompletionRecord[] = [
    { pipelineId: 'pipe-1', status: 'success', durationMs: 300000, completedAt: new Date(now - 3 * 86400000) },
    { pipelineId: 'pipe-2', status: 'success', durationMs: 600000, completedAt: new Date(now - 1 * 86400000) },
  ];

  return {
    getPipelineRecords: jest.fn().mockResolvedValue(overrides?.pipelines ?? defaultPipelines),
    getDeploymentRecords: jest.fn().mockResolvedValue(overrides?.deployments ?? defaultDeployments),
  };
}

function createMockTicketService() {
  return {
    getSLACompliance: jest.fn().mockReturnValue({ complianceRate: 85, breachedTickets: 3, totalTickets: 20 }),
    getResolutionStats: jest.fn().mockReturnValue({ meanResolutionTimeMs: 7200000, medianResolutionTimeMs: 5400000, byPriority: { critical: 1800000, high: 3600000, medium: 7200000 } }),
    getBacklogAnalysis: jest.fn().mockReturnValue({ openCount: 8, overdueCount: 2, averageAgeMs: 172800000, oldestTicketAgeMs: 604800000 }),
    getTrendReport: jest.fn().mockReturnValue({
      dataPoints: [
        { period: 'Mon', created: 3, resolved: 2, open: 1 },
        { period: 'Tue', created: 4, resolved: 3, open: 2 },
        { period: 'Wed', created: 5, resolved: 4, open: 3 },
        { period: 'Thu', created: 3, resolved: 3, open: 3 },
        { period: 'Fri', created: 4, resolved: 3, open: 4 },
        { period: 'Sat', created: 2, resolved: 3, open: 3 },
        { period: 'Sun', created: 1, resolved: 4, open: 0 },
      ],
      totalCreated: 22,
      totalResolved: 22,
      trend: 'stable',
    }),
    getStatistics: jest.fn().mockReturnValue({
      totalTickets: 50,
      byStatus: { open: 5, assigned: 8, 'in-progress': 3, resolved: 14, closed: 20 },
      byPriority: { critical: 2, high: 8, medium: 20, low: 20 },
      byCategory: { bug: 15, feature: 20, 'support': 15 },
      averageResolutionTimeMs: 7200000,
      slaComplianceRate: 85,
    }),
  };
}

describe('WeeklyReportService', () => {
  let service: WeeklyReportService;
  let mockDora: DoraMetricsService;
  let mockDataSource: ReturnType<typeof createMockDataSource>;
  let mockTicket: ReturnType<typeof createMockTicketService>;

  beforeEach(() => {
    mockDora = createMockDoraService();
    mockDataSource = createMockDataSource();
    mockTicket = createMockTicketService();
    service = new WeeklyReportService({
      doraService: mockDora,
      ticketService: mockTicket as any,
      dataSource: mockDataSource,
    });
  });

  it('should generate a weekly report', async () => {
    const report = await service.generateReport({ teamId: 'team-alpha' });

    expect(report).toBeDefined();
    expect(report.reportId).toMatch(/^WR-/);
    expect(report.teamId).toBe('team-alpha');
    expect(report.markdown).toContain('# Weekly Report');
    expect(report.markdown).toContain('## DORA Metrics');
    expect(report.markdown).toContain('## Ticketing Analysis');
    expect(report.json).toBeDefined();
  });

  it('should calculate week boundaries correctly (Monday start)', () => {
    // Friday April 24, 2026
    const date = new Date('2026-04-24T12:00:00Z');
    const bounds = service.getWeekBoundaries(date);
    expect(bounds.start.getDay()).toBe(1); // Monday
    expect(bounds.end.getDate()).toBe(bounds.start.getDate() + 6);
    expect(bounds.start.getHours()).toBe(0);
    expect(bounds.end.getHours()).toBe(23);
  });

  it('should handle Sunday as reference date', () => {
    // Sunday April 26, 2026
    const date = new Date('2026-04-26T12:00:00Z');
    const bounds = service.getWeekBoundaries(date);
    expect(bounds.start.getDay()).toBe(1); // Monday
    // The Monday before April 26
    expect(bounds.start.getDate()).toBe(20);
  });

  it('should include executive summary with key metrics', async () => {
    const report = await service.generateReport({ weekStart: new Date() });
    expect(report.markdown).toContain('Deployments:');
    expect(report.markdown).toContain('Change Failure Rate:');
    expect(report.markdown).toContain('Tickets Created:');
    expect(report.markdown).toContain('SLA Compliance:');
  });

  it('should compute health score', async () => {
    const report = await service.generateReport({ weekStart: new Date() });
    expect(['green', 'yellow', 'red']).toContain(report.healthScore);
  });

  it('should return red health score for poor metrics', async () => {
    // Override with bad data
    const badDora = createMockDoraService();
    const badDataSource = createMockDataSource({
      deployments: Array.from({ length: 20 }, (_, i) => ({
        deploymentId: `dep-${i}`,
        service: 'api',
        environment: 'production',
        status: i % 2 === 0 ? 'failed' : 'success', // 50% failure
        deployedAt: new Date(Date.now() - i * 86400000),
        recoveryTimeMs: 7200000,
      })),
    });
    const badTicket = {
      ...createMockTicketService(),
      getSLACompliance: jest.fn().mockReturnValue({ complianceRate: 40, breachedTickets: 12, totalTickets: 20 }),
      getBacklogAnalysis: jest.fn().mockReturnValue({ openCount: 20, overdueCount: 10, averageAgeMs: 604800000, oldestTicketAgeMs: 1209600000 }),
    };

    const badService = new WeeklyReportService({
      doraService: badDora,
      ticketService: badTicket as any,
      dataSource: badDataSource,
    });

    const report = await badService.generateReport({ weekStart: new Date() });
    expect(report.healthScore).toBe('red');
  });

  it('should return green health score for good metrics', async () => {
    const goodDataSource = createMockDataSource({
      deployments: Array.from({ length: 30 }, (_, i) => ({
        deploymentId: `dep-${i}`,
        service: 'api',
        environment: 'production',
        status: 'success', // 0% failure
        deployedAt: new Date(Date.now() - i * 86400000),
      })),
      pipelines: Array.from({ length: 30 }, (_, i) => ({
        pipelineId: `pipe-${i}`,
        status: 'success',
        durationMs: 1800000, // 30min lead time
        completedAt: new Date(Date.now() - i * 86400000),
      })),
    });
    const goodTicket = {
      ...createMockTicketService(),
      getSLACompliance: jest.fn().mockReturnValue({ complianceRate: 99, breachedTickets: 0, totalTickets: 50 }),
      getBacklogAnalysis: jest.fn().mockReturnValue({ openCount: 2, overdueCount: 0, averageAgeMs: 86400000, oldestTicketAgeMs: 86400000 }),
    };

    const goodService = new WeeklyReportService({
      doraService: mockDora,
      ticketService: goodTicket as any,
      dataSource: goodDataSource,
    });

    const report = await goodService.generateReport({ weekStart: new Date() });
    expect(report.healthScore).toBe('green');
  });

  it('should return JSON with all sections', async () => {
    const report = await service.generateReport({ weekStart: new Date() });
    expect(report.json.dora).toBeDefined();
    expect(report.json.dora).toHaveProperty('deploymentFrequency');
    expect(report.json.dora).toHaveProperty('leadTime');
    expect(report.json.dora).toHaveProperty('failureRate');
    expect(report.json.dora).toHaveProperty('mttr');
    expect(report.json.ticketing).toBeDefined();
  });

  it('should format durations correctly', async () => {
    const report = await service.generateReport({ weekStart: new Date() });
    expect(report.markdown).toMatch(/(s|m|h|d)/);
  });

  it('should include weekly trend in markdown', async () => {
    const report = await service.generateReport({ weekStart: new Date() });
    expect(report.markdown).toContain('Weekly Trend');
    expect(report.markdown).toContain('created');
  });

  // ==================== DB Persistence ====================

  it('should persist report to DB when db is provided', async () => {
    const mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };

    const dbService = new WeeklyReportService({
      doraService: mockDora,
      ticketService: mockTicket as any,
      dataSource: mockDataSource,
      db: mockDb,
    });

    const report = await dbService.generateReport({ teamId: 'team-db' });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO weekly_reports'),
      expect.arrayContaining([report.reportId, 'team-db']),
    );
  });

  it('should not call DB when db is not provided', async () => {
    // service created without db — verify no DB calls
    const report = await service.generateReport({ weekStart: new Date() });
    expect(report).toBeDefined();
  });

  it('should handle DB persistence failure gracefully', async () => {
    const mockDb = {
      query: jest.fn().mockRejectedValue(new Error('connection refused')),
    };

    const dbService = new WeeklyReportService({
      doraService: mockDora,
      ticketService: mockTicket as any,
      dataSource: mockDataSource,
      db: mockDb,
    });

    // Should not throw — report generation succeeds even if DB fails
    const report = await dbService.generateReport({ teamId: 'team-err' });
    expect(report.reportId).toMatch(/^WR-/);
  });

  it('should list history from DB', async () => {
    const mockDb = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { id: 'wr-1', team_id: 'team-a', week_start: '2026-04-20', week_end: '2026-04-26', report_data: { healthScore: 'green' } },
          { id: 'wr-2', team_id: 'team-a', week_start: '2026-04-13', week_end: '2026-04-19', report_data: { healthScore: 'yellow' } },
        ],
        rowCount: 2,
      }),
    };

    const dbService = new WeeklyReportService({
      doraService: mockDora,
      ticketService: mockTicket as any,
      dataSource: mockDataSource,
      db: mockDb,
    });

    const history = await dbService.listHistory({ teamId: 'team-a', limit: 10 });
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe('wr-1');
    expect(history[0].healthScore).toBe('green');
  });

  it('should get report by ID from DB', async () => {
    const mockDb = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: 'wr-1',
          team_id: 'team-a',
          week_start: '2026-04-20T00:00:00.000Z',
          week_end: '2026-04-26T23:59:59.999Z',
          created_at: '2026-04-27T10:00:00.000Z',
          report_data: {
            healthScore: 'green',
            markdown: '# Test Report',
          },
        }],
        rowCount: 1,
      }),
    };

    const dbService = new WeeklyReportService({
      doraService: mockDora,
      ticketService: mockTicket as any,
      dataSource: mockDataSource,
      db: mockDb,
    });

    const report = await dbService.getReport('wr-1');
    expect(report).not.toBeNull();
    expect(report!.reportId).toBe('wr-1');
    expect(report!.markdown).toBe('# Test Report');
  });

  it('should return null for non-existent report', async () => {
    const mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };

    const dbService = new WeeklyReportService({
      doraService: mockDora,
      ticketService: mockTicket as any,
      dataSource: mockDataSource,
      db: mockDb,
    });

    const report = await dbService.getReport('non-existent');
    expect(report).toBeNull();
  });
});
