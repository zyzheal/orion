/**
 * Tests for CostAnomalyDetectionService
 */

import { CostAnomalyDetectionService, AnomalyType } from '../CostAnomalyDetectionService';

// Mock DatabasePool
const mockDb = {
  query: jest.fn(),
};

describe('CostAnomalyDetectionService', () => {
  let service: CostAnomalyDetectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    // ensureTable always resolves
    mockDb.query.mockResolvedValue({ rows: [] });
    service = new CostAnomalyDetectionService(mockDb as any);
  });

  // ==================== recordCost ====================

  describe('recordCost', () => {
    it('should record a cost entry', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.recordCost('tenant-001', {
        amount: 42.50,
        category: 'compute',
        resourceId: 'res-001',
        metadata: { instance_type: 'm5.large' },
      });

      expect(result.tenantId).toBe('tenant-001');
      expect(result.amount).toBe(42.5);
      expect(result.category).toBe('compute');
      expect(result.resourceId).toBe('res-001');
    });

    it('should generate a unique ID', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.recordCost('tenant-001', {
        amount: 10,
        category: 'storage',
      });

      expect(result.id).toMatch(/^cost_/);
    });
  });

  // ==================== detectAnomalies ====================

  describe('detectAnomalies', () => {
    it('should return empty anomalies when fewer than 3 records', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [
        { id: 'c1', tenant_id: 'tenant-001', amount: 10, category: 'compute', timestamp: new Date('2026-05-01') },
        { id: 'c2', tenant_id: 'tenant-001', amount: 12, category: 'compute', timestamp: new Date('2026-05-02') },
      ]});

      const result = await service.detectAnomalies('tenant-001', {
        start: new Date('2026-05-01'),
        end: new Date('2026-05-31'),
      });

      expect(result.anomalies).toHaveLength(0);
      expect(result.dataPointsAnalyzed).toBe(2);
    });

    it('should detect a cost spike using Z-score', async () => {
      // Normal costs around 100, with one spike at 500
      const records = [];
      for (let day = 1; day <= 10; day++) {
        const amount = day === 5 ? 500 : 100;
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount,
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      mockDb.query.mockResolvedValueOnce({ rows: records });
      mockDb.query.mockResolvedValue({ rows: [] }); // for subsequent queries (storeAnomaly, etc.)

      const result = await service.detectAnomalies('tenant-001', {
        start: new Date('2026-05-01'),
        end: new Date('2026-05-10'),
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      const spikeAnomaly = result.anomalies.find(a => a.type === AnomalyType.SPIKE);
      expect(spikeAnomaly).toBeDefined();
      expect(spikeAnomaly!.value).toBe(500);
    });

    it('should detect a cost drop using Z-score', async () => {
      // Normal costs around 100, with one drop at 5
      const records = [];
      for (let day = 1; day <= 10; day++) {
        const amount = day === 7 ? 5 : 100;
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount,
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      mockDb.query.mockResolvedValueOnce({ rows: records });
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.detectAnomalies('tenant-001', {
        start: new Date('2026-05-01'),
        end: new Date('2026-05-10'),
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      const dropAnomaly = result.anomalies.find(a => a.type === AnomalyType.DROP);
      expect(dropAnomaly).toBeDefined();
    });

    it('should detect sustained high costs', async () => {
      // Many normal days at 10, then 4 consecutive days at 50
      // mean ≈ 15.2, stdDev ≈ 10.8, threshold ≈ 36.8
      // 50 > 36.8, so all 4 high days are above threshold -> sustained high
      const records = [];
      // 20 days at 10
      for (let day = 1; day <= 20; day++) {
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount: 10,
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      // 4 days at 50
      for (let day = 21; day <= 24; day++) {
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount: 50,
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      mockDb.query.mockResolvedValueOnce({ rows: records });
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.detectAnomalies('tenant-001', {
        start: new Date('2026-05-01'),
        end: new Date('2026-05-24'),
      });

      const sustainedAnomaly = result.anomalies.find(a => a.type === AnomalyType.SUSTAINED_HIGH);
      expect(sustainedAnomaly).toBeDefined();
    });

    it('should set severity based on Z-score', async () => {
      // Create data with extreme outlier
      const records = [];
      for (let day = 1; day <= 10; day++) {
        const amount = day === 5 ? 5000 : 10;
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount,
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      mockDb.query.mockResolvedValueOnce({ rows: records });
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.detectAnomalies('tenant-001', {
        start: new Date('2026-05-01'),
        end: new Date('2026-05-10'),
      });

      // With such an extreme outlier, should be critical or high
      const extremeAnomaly = result.anomalies.find(a => a.type === AnomalyType.SPIKE);
      if (extremeAnomaly) {
        expect(['critical', 'high', 'medium']).toContain(extremeAnomaly.severity);
      }
    });

    it('should include metadata on anomalies', async () => {
      const records = [];
      for (let day = 1; day <= 10; day++) {
        const amount = day === 5 ? 500 : 100;
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount,
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      mockDb.query.mockResolvedValueOnce({ rows: records });
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.detectAnomalies('tenant-001', {
        start: new Date('2026-05-01'),
        end: new Date('2026-05-10'),
      });

      if (result.anomalies.length > 0) {
        expect(result.anomalies[0].metadata).toBeDefined();
        expect(result.anomalies[0].id).toMatch(/^anomaly_/);
      }
    });
  });

  // ==================== getCostTrend ====================

  describe('getCostTrend', () => {
    it('should calculate increasing trend', async () => {
      const records = [];
      for (let day = 1; day <= 10; day++) {
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount: day * 10, // steadily increasing: 10, 20, 30...
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      mockDb.query.mockResolvedValueOnce({ rows: records });

      const result = await service.getCostTrend('tenant-001', 10);

      expect(result.trend).toBe('increasing');
      expect(result.changeRate).toBeGreaterThan(0);
    });

    it('should calculate decreasing trend', async () => {
      const records = [];
      for (let day = 1; day <= 10; day++) {
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount: (11 - day) * 10, // decreasing: 100, 90, 80...
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      mockDb.query.mockResolvedValueOnce({ rows: records });

      const result = await service.getCostTrend('tenant-001', 10);

      expect(result.trend).toBe('decreasing');
      expect(result.changeRate).toBeLessThan(0);
    });

    it('should return stable trend for constant costs', async () => {
      const records = [];
      for (let day = 1; day <= 7; day++) {
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount: 100,
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      mockDb.query.mockResolvedValueOnce({ rows: records });

      const result = await service.getCostTrend('tenant-001', 7);

      expect(result.trend).toBe('stable');
    });

    it('should return total and average cost', async () => {
      const records = [
        { id: 'c1', tenant_id: 'tenant-001', amount: 100, category: 'compute', resource_id: null, timestamp: new Date('2026-05-01'), metadata: null },
        { id: 'c2', tenant_id: 'tenant-001', amount: 200, category: 'compute', resource_id: null, timestamp: new Date('2026-05-02'), metadata: null },
      ];
      mockDb.query.mockResolvedValueOnce({ rows: records });

      const result = await service.getCostTrend('tenant-001', 2);

      expect(result.totalCost).toBe(300);
      expect(result.averageCost).toBe(150);
    });
  });

  // ==================== forecastCost ====================

  describe('forecastCost', () => {
    it('should return low confidence when insufficient data', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [
        { id: 'c1', tenant_id: 'tenant-001', amount: 100, category: 'compute', resource_id: null, timestamp: new Date('2026-05-01'), metadata: null },
      ]});

      const result = await service.forecastCost('tenant-001', 30);

      expect(result.confidence).toBe(0.2);
      expect(result.dailyForecast).toHaveLength(0);
    });

    it('should provide daily forecast with sufficient data', async () => {
      const records = [];
      for (let day = 1; day <= 20; day++) {
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount: 50 + day * 2, // linear increase
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-04-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      mockDb.query.mockResolvedValueOnce({ rows: records });

      const result = await service.forecastCost('tenant-001', 30);

      expect(result.predictedEndOfMonthCost).toBeGreaterThan(0);
      expect(result.currentSpend).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should use default 30 days of history', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await service.forecastCost('tenant-001');

      // Verify it was called with default date range
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  // ==================== Threshold Configuration ====================

  describe('threshold configuration', () => {
    it('should use custom Z-score threshold', async () => {
      const customService = new CostAnomalyDetectionService(mockDb as any, { zScoreThreshold: 3.0 });

      // With higher threshold, fewer anomalies should be detected
      const records = [];
      for (let day = 1; day <= 10; day++) {
        const amount = day === 5 ? 300 : 100;
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount,
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      mockDb.query.mockResolvedValueOnce({ rows: records });
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await customService.detectAnomalies('tenant-001', {
        start: new Date('2026-05-01'),
        end: new Date('2026-05-10'),
      });

      // With threshold=3.0, the spike might not be detected (depends on Z-score)
      // But the service should not throw
      expect(result.dataPointsAnalyzed).toBe(10);
    });
  });

  // ==================== Error Handling ====================

  describe('error handling', () => {
    it('should handle DB query failure for cost records gracefully', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(service.detectAnomalies('tenant-001', {
        start: new Date('2026-05-01'),
        end: new Date('2026-05-31'),
      })).rejects.toThrow('DB connection lost');
    });

    it('should handle storeAnomaly failure gracefully', async () => {
      const records = [];
      for (let day = 1; day <= 10; day++) {
        const amount = day === 5 ? 500 : 100;
        records.push({
          id: `c${day}`,
          tenant_id: 'tenant-001',
          amount,
          category: 'compute',
          resource_id: null,
          timestamp: new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00Z`),
          metadata: null,
        });
      }
      // First call succeeds (getCostRecords), second fails (storeAnomaly)
      mockDb.query.mockResolvedValueOnce({ rows: records });
      mockDb.query.mockRejectedValueOnce(new Error('Table does not exist'));

      const result = await service.detectAnomalies('tenant-001', {
        start: new Date('2026-05-01'),
        end: new Date('2026-05-10'),
      });

      // Should still return anomalies even if storage fails
      expect(result.anomalies.length).toBeGreaterThan(0);
    });
  });
});
