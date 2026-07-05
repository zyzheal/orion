/**
 * TicketAnalyticsService Unit Tests
 */

import { TicketAnalyticsService } from '../TicketAnalyticsService';

function createMockPool(rows: any[] = []) {
  return {
    query: jest.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  } as any;
}

describe('TicketAnalyticsService', () => {
  let service: TicketAnalyticsService;
  let pool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = createMockPool();
    service = new TicketAnalyticsService(pool);
  });

  // ==================== getSLACompliance ====================

  describe('getSLACompliance', () => {
    it('should return 100% compliance when total is 0', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ total: '0', breached: '0' }] });

      const result = await service.getSLACompliance();

      expect(result.complianceRate).toBe(100);
      expect(result.breachedTickets).toBe(0);
      expect(result.totalTickets).toBe(0);
    });

    it('should calculate compliance rate correctly', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ total: '10', breached: '2' }] });

      const result = await service.getSLACompliance();

      expect(result.complianceRate).toBe(80);
      expect(result.breachedTickets).toBe(2);
      expect(result.totalTickets).toBe(10);
    });

    it('should handle undefined row values', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{}] });

      const result = await service.getSLACompliance();

      expect(result.totalTickets).toBe(0);
      expect(result.breachedTickets).toBe(0);
      expect(result.complianceRate).toBe(100);
    });

    it('should accept periodStart parameter', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ total: '5', breached: '1' }] });
      const start = new Date('2025-01-01');

      await service.getSLACompliance(start);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= $1'),
        [start]
      );
    });

    it('should accept both periodStart and periodEnd parameters', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ total: '5', breached: '1' }] });
      const start = new Date('2025-01-01');
      const end = new Date('2025-12-31');

      await service.getSLACompliance(start, end);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('$2'),
        [start, end]
      );
    });

    it('should not add where clause for no period params', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ total: '0', breached: '0' }] });

      await service.getSLACompliance();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE 1=1'),
        []
      );
    });
  });

  // ==================== getResolutionStats ====================

  describe('getResolutionStats', () => {
    it('should return resolution stats', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ mean_ms: '3600000', median_ms: '1800000' }],
      });

      const result = await service.getResolutionStats();

      expect(result.meanResolutionTimeMs).toBe(3600000);
      expect(result.medianResolutionTimeMs).toBe(1800000);
    });

    it('should handle missing data', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{}] });

      const result = await service.getResolutionStats();

      expect(result.meanResolutionTimeMs).toBe(0);
      expect(result.medianResolutionTimeMs).toBe(0);
    });

    it('should handle empty rows', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getResolutionStats();

      expect(result.meanResolutionTimeMs).toBe(0);
    });
  });

  // ==================== getBacklogAnalysis ====================

  describe('getBacklogAnalysis', () => {
    it('should return backlog analysis', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ total: '5', overdue: '2', avg_age_ms: '86400000', oldest_age_ms: '604800000' }],
      });

      const result = await service.getBacklogAnalysis();

      expect(result.openCount).toBe(5);
      expect(result.overdueCount).toBe(2);
      expect(result.averageAgeMs).toBe(86400000);
      expect(result.oldestTicketAgeMs).toBe(604800000);
    });

    it('should handle empty backlog', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{}] });

      const result = await service.getBacklogAnalysis();

      expect(result.openCount).toBe(0);
      expect(result.overdueCount).toBe(0);
      expect(result.averageAgeMs).toBe(0);
      expect(result.oldestTicketAgeMs).toBe(0);
    });
  });

  // ==================== getTrendReport ====================

  describe('getTrendReport', () => {
    it('should return trend report with default 7 days', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { period: '2025-01-01', created: '3', resolved: '2', open: '1' },
          { period: '2025-01-02', created: '5', resolved: '4', open: '1' },
        ],
      });

      const result = await service.getTrendReport();

      expect(result.dataPoints).toHaveLength(2);
      expect(result.totalCreated).toBe(8);
      expect(result.totalResolved).toBe(6);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [7]);
    });

    it('should accept custom days parameter', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getTrendReport({ days: 30 });

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [30]);
    });

    it('should detect increasing trend', async () => {
      const rows = [];
      for (let i = 0; i < 10; i++) {
        rows.push({ period: `2025-01-${String(i + 1).padStart(2, '0')}`, created: String(i + 1), resolved: '1', open: '0' });
      }
      pool.query.mockResolvedValueOnce({ rows });

      const result = await service.getTrendReport({ days: 10 });

      expect(result.trend).toBe('increasing');
    });

    it('should detect decreasing trend', async () => {
      const rows = [];
      for (let i = 10; i > 0; i--) {
        rows.push({ period: `2025-01-${String(11 - i).padStart(2, '0')}`, created: String(i), resolved: '10', open: '0' });
      }
      pool.query.mockResolvedValueOnce({ rows });

      const result = await service.getTrendReport({ days: 10 });

      expect(result.trend).toBe('decreasing');
    });

    it('should return stable trend for small datasets', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ period: '2025-01-01', created: '5', resolved: '3', open: '2' }],
      });

      const result = await service.getTrendReport();

      expect(result.trend).toBe('stable');
    });

    it('should return stable trend when data is within threshold', async () => {
      const rows = [];
      for (let i = 0; i < 7; i++) {
        rows.push({ period: `2025-01-${String(i + 1).padStart(2, '0')}`, created: '5', resolved: '3', open: '2' });
      }
      pool.query.mockResolvedValueOnce({ rows });

      const result = await service.getTrendReport({ days: 7 });

      expect(result.trend).toBe('stable');
    });

    it('should handle empty data points', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getTrendReport();

      expect(result.dataPoints).toHaveLength(0);
      expect(result.totalCreated).toBe(0);
      expect(result.totalResolved).toBe(0);
      expect(result.trend).toBe('stable');
    });
  });

  // ==================== getStatistics ====================

  describe('getStatistics', () => {
    it('should return full statistics', async () => {
      const queries = [
        { rows: [{ status: 'open', count: '5' }, { status: 'closed', count: '3' }] }, // status
        { rows: [{ priority: 'high', count: '4' }, { priority: 'low', count: '4' }] }, // priority
        { rows: [{ category: 'bug', count: '3' }, { category: 'feature', count: '5' }] }, // category
        { rows: [{ count: '8' }] }, // total
        { rows: [{ total: '8', compliant: '6' }] }, // sla
        { rows: [{ avg_ms: '3600000' }] }, // resolution
      ];

      let callIndex = 0;
      pool.query.mockImplementation(() => Promise.resolve(queries[callIndex++]));

      const result = await service.getStatistics();

      expect(result.totalTickets).toBe(8);
      expect(result.byStatus).toEqual({ open: 5, closed: 3 });
      expect(result.byPriority).toEqual({ high: 4, low: 4 });
      expect(result.byCategory).toEqual({ bug: 3, feature: 5 });
      expect(result.averageResolutionTimeMs).toBe(3600000);
      expect(result.slaComplianceRate).toBe(75);
    });

    it('should return 100% SLA when no SLA data', async () => {
      const queries = [
        { rows: [] }, // status
        { rows: [] }, // priority
        { rows: [] }, // category
        { rows: [{ count: '0' }] }, // total
        { rows: [{ total: '0', compliant: '0' }] }, // sla
        { rows: [{}] }, // resolution
      ];

      let callIndex = 0;
      pool.query.mockImplementation(() => Promise.resolve(queries[callIndex++]));

      const result = await service.getStatistics();

      expect(result.totalTickets).toBe(0);
      expect(result.slaComplianceRate).toBe(100);
      expect(result.averageResolutionTimeMs).toBe(0);
    });

    it('should handle empty rows gracefully', async () => {
      const queries = [
        { rows: [] }, // status
        { rows: [] }, // priority
        { rows: [] }, // category
        { rows: [{}] }, // total
        { rows: [{}] }, // sla
        { rows: [{}] }, // resolution
      ];

      let callIndex = 0;
      pool.query.mockImplementation(() => Promise.resolve(queries[callIndex++]));

      const result = await service.getStatistics();

      expect(result.byStatus).toEqual({});
      expect(result.byPriority).toEqual({});
      expect(result.byCategory).toEqual({});
      expect(result.totalTickets).toBe(0);
    });
  });
});
