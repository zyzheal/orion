/**
 * MetricStorageRepository Unit Tests
 */

import { PostgresMetricStorageRepository } from '../MetricStorageRepository';
import { getCurrentTenantId } from '../../../db/tenant-context-storage';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: jest.fn(() => 'test-tenant-001'),
}));

// Mock DatabasePool
const createMockPool = (rows: any[] = [], rowCount: number = 0) => ({
  query: jest.fn().mockResolvedValue({
    rows,
    rowCount,
  }),
});

describe('PostgresMetricStorageRepository', () => {
  let repo: PostgresMetricStorageRepository;
  let mockPool: any;

  beforeEach(() => {
    mockPool = createMockPool();
    repo = new PostgresMetricStorageRepository(mockPool as any);
  });

  describe('registerMetric', () => {
    it('should insert a new metric registry record', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'uuid-1',
          tenant_id: 'default-tenant',
          name: 'test.metric',
          unit: 'count',
          default_tags: {},
          description: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.registerMetric({
        name: 'test.metric',
        unit: 'count',
        description: 'Test metric',
      });

      expect(result.name).toBe('test.metric');
      expect(result.unit).toBe('count');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO metric_registry'),
        expect.any(Array)
      );
    });
  });

  describe('getAllRegisteredMetrics', () => {
    it('should return metric names', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ name: 'metric.a' }, { name: 'metric.b' }],
        rowCount: 2,
      });

      const result = await repo.getAllRegisteredMetrics();
      expect(result).toEqual(['metric.a', 'metric.b']);
    });
  });

  describe('unregisterMetric', () => {
    it('should return true when metric deleted', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });
      const result = await repo.unregisterMetric('test.metric');
      expect(result).toBe(true);
    });

    it('should return false when metric not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.unregisterMetric('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getMetricRegistry', () => {
    it('should return registry record when found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'uuid-1',
          tenant_id: 'tenant-1',
          name: 'cpu.usage',
          unit: 'percent',
          default_tags: {},
          description: 'CPU usage',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.getMetricRegistry('cpu.usage');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('cpu.usage');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.getMetricRegistry('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('insertDataPoint', () => {
    it('should insert a data point', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.insertDataPoint({
        metric_name: 'test.metric',
        value: 42,
        tags: { env: 'prod' },
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO metric_data_points'),
        expect.any(Array)
      );
    });

    it('should use current tenant ID from context when not provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.insertDataPoint({
        metric_name: 'test.metric',
        value: 100,
      });

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[0]).toBe('test-tenant-001');
    });
  });

  describe('getLatestValue', () => {
    it('should return the latest value', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ value: 99 }],
        rowCount: 1,
      });

      const result = await repo.getLatestValue('test.metric');
      expect(result).toBe(99);
    });

    it('should return null when no data', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.getLatestValue('nonexistent');
      expect(result).toBeNull();
    });

    it('should include tag filter when provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.getLatestValue('test.metric', { env: 'prod' });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('tags @>');
    });
  });

  describe('queryMetricSeries', () => {
    it('should return empty series when no data', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.queryMetricSeries({ name: 'unknown' });
      expect(result.dataPoints).toEqual([]);
      expect(result.aggregation.count).toBe(0);
      expect(result.name).toBe('unknown');
    });

    it('should return data points with aggregation', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { value: 10, timestamp: '2026-05-25T10:00:00Z' },
          { value: 20, timestamp: '2026-05-25T10:01:00Z' },
          { value: 30, timestamp: '2026-05-25T10:02:00Z' },
        ],
        rowCount: 3,
      });

      const result = await repo.queryMetricSeries({ name: 'cpu' });
      expect(result.dataPoints).toHaveLength(3);
      expect(result.aggregation.count).toBe(3);
      expect(result.aggregation.avg).toBe(20);
      expect(result.aggregation.min).toBe(10);
      expect(result.aggregation.max).toBe(30);
    });

    it('should apply max points sampling', async () => {
      mockPool.query.mockResolvedValue({
        rows: Array.from({ length: 100 }, (_, i) => ({
          value: i,
          timestamp: `2026-05-25T10:${String(i).padStart(2, '0')}:00Z`,
        })),
        rowCount: 100,
      });

      const result = await repo.queryMetricSeries({ name: 'cpu', maxPoints: 10 });
      expect(result.dataPoints.length).toBeLessThanOrEqual(10);
    });

    it('should include time window filters', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.queryMetricSeries({
        name: 'cpu',
        startTime: new Date('2026-05-25T10:00:00Z'),
        endTime: new Date('2026-05-25T11:00:00Z'),
      });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('timestamp >=');
      expect(sql).toContain('timestamp <=');
    });

    it('should include tag filter using JSONB containment', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.queryMetricSeries({
        name: 'cpu',
        tags: { host: 'server-1' },
      });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('tags @>');
    });
  });

  describe('pruneExpired', () => {
    it('should delete expired records and return count', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 5 });
      const result = await repo.pruneExpired(3600000);
      expect(result).toBe(5);
    });

    it('should include tenant filter when provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 3 });
      await repo.pruneExpired(3600000, 'tenant-123');

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('tenant_id =');
    });
  });

  describe('clearAll', () => {
    it('should truncate all tables when no tenant specified', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.clearAll();

      expect(mockPool.query).toHaveBeenCalledWith('TRUNCATE metric_data_points, metric_registry');
    });

    it('should delete by tenant when tenant specified', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.clearAll('tenant-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM metric_data_points WHERE tenant_id = $1',
        ['tenant-1']
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM metric_registry WHERE tenant_id = $1',
        ['tenant-1']
      );
    });
  });

  describe('computeAggregation (via queryMetricSeries)', () => {
    it('should compute correct p95 and p99', async () => {
      mockPool.query.mockResolvedValue({
        rows: Array.from({ length: 100 }, (_, i) => ({
          value: i + 1,
          timestamp: `2026-05-25T10:${String(i).padStart(2, '0')}:00Z`,
        })),
        rowCount: 100,
      });

      const result = await repo.queryMetricSeries({ name: 'p95test' });
      expect(result.aggregation.p95).toBeCloseTo(95, 0);
      expect(result.aggregation.p99).toBeCloseTo(99, 0);
    });
  });
});
