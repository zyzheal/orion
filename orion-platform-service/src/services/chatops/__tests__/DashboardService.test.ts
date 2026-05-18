import { DashboardService, type TimeRangeParams } from '../DashboardService';

const createMockRepo = () => ({
  getStatsByTimeRange: jest.fn(),
  getDailyTrends: jest.fn(),
  getTopCommands: jest.fn(),
  getPlatformDistribution: jest.fn(),
  getRecentExecutions: jest.fn(),
});

type MockRepo = ReturnType<typeof createMockRepo>;

describe('DashboardService', () => {
  let service: DashboardService;
  let mockRepo: MockRepo;

  beforeEach(() => {
    mockRepo = createMockRepo();
    service = new DashboardService(mockRepo as any);
  });

  describe('parseTimeRange', () => {
    it('should parse 7d range correctly', () => {
      const params: TimeRangeParams = { range: '7d' };
      const result = (service as any).parseTimeRange(params);
      const daysDiff =
        (result.end.getTime() - result.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(7, 0);
    });

    it('should parse 30d range correctly', () => {
      const params: TimeRangeParams = { range: '30d' };
      const result = (service as any).parseTimeRange(params);
      const daysDiff =
        (result.end.getTime() - result.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(30, 0);
    });

    it('should parse month range correctly', () => {
      const params: TimeRangeParams = { range: 'month' };
      const result = (service as any).parseTimeRange(params);
      expect(result.start.getDate()).toBe(1);
    });

    it('should throw for custom range without dates', () => {
      const params: TimeRangeParams = { range: 'custom' };
      expect(() => (service as any).parseTimeRange(params)).toThrow(
        'custom range requires startDate and endDate',
      );
    });

    it('should throw for custom range exceeding 90 days', () => {
      const params: TimeRangeParams = {
        range: 'custom',
        startDate: '2026-01-01',
        endDate: '2026-06-01',
      };
      expect(() => (service as any).parseTimeRange(params)).toThrow(
        'custom range cannot exceed 90 days',
      );
    });
  });

  describe('calcComparison', () => {
    it('should calculate comparison correctly', () => {
      const current = {
        totalExecutions: 128,
        successRate: 94,
        failedCount: 8,
        avgResponseTime: 4.2,
      };
      const previous = {
        totalExecutions: 100,
        successRate: 90,
        failedCount: 10,
        avgResponseTime: 5.0,
      };
      const result = (service as any).calcComparison(current, previous);
      expect(result.totalExecutions).toBe(28);
      expect(result.successRate).toBe(4);
      expect(result.failedCount).toBe(-20);
      expect(result.avgResponseTime).toBe(-0.8);
    });

    it('should handle zero previous values', () => {
      const current = {
        totalExecutions: 10,
        successRate: 100,
        failedCount: 0,
        avgResponseTime: 1.0,
      };
      const previous = {
        totalExecutions: 0,
        successRate: 0,
        failedCount: 0,
        avgResponseTime: 0,
      };
      const result = (service as any).calcComparison(current, previous);
      expect(result.totalExecutions).toBe(0);
      expect(result.successRate).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return dashboard stats', async () => {
      mockRepo.getStatsByTimeRange.mockResolvedValue({
        total: 128,
        completed: 120,
        failed: 8,
        avgResponseTime: 4.2,
      });
      mockRepo.getDailyTrends.mockResolvedValue([]);
      mockRepo.getTopCommands.mockResolvedValue([]);
      mockRepo.getPlatformDistribution.mockResolvedValue([]);
      mockRepo.getRecentExecutions.mockResolvedValue([]);

      const result = await service.getStats({ range: '7d' });

      expect(result.metrics.totalExecutions).toBe(128);
      expect(result.metrics.successRate).toBe(94);
      expect(result.metrics.failedCount).toBe(8);
      expect(result.metrics.avgResponseTime).toBe(4.2);
      expect(result.trends).toEqual([]);
      expect(result.topCommands).toEqual([]);
      expect(result.platformDistribution).toEqual([]);
      expect(result.recentExecutions).toEqual([]);
      expect(result.comparison).toBeDefined();
    });

    it('should calculate success rate as 0 when total is 0', async () => {
      mockRepo.getStatsByTimeRange.mockResolvedValue({
        total: 0,
        completed: 0,
        failed: 0,
        avgResponseTime: 0,
      });
      mockRepo.getDailyTrends.mockResolvedValue([]);
      mockRepo.getTopCommands.mockResolvedValue([]);
      mockRepo.getPlatformDistribution.mockResolvedValue([]);
      mockRepo.getRecentExecutions.mockResolvedValue([]);

      const result = await service.getStats({ range: '7d' });

      expect(result.metrics.successRate).toBe(0);
    });
  });
});
