/**
 * MetricsRepository 独立单元测试
 *
 * 覆盖：record、query、aggregate 三个公共方法
 * 包含：正常路径、SQL 验证、参数验证、边界条件、错误处理
 */

import { MetricsRepository, Metric } from '../MetricsRepository';

describe('MetricsRepository', () => {
  let mockPool: { query: jest.Mock };
  let repository: MetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = { query: jest.fn() };
    repository = new MetricsRepository(mockPool as any);
  });

  // ==================== record ====================

  describe('record', () => {
    it('should insert a metric and return the saved row', async () => {
      const now = new Date();
      const mockRow: Metric = {
        id: 'm1',
        tenant_id: 't1',
        name: 'cpu_usage',
        value: 75.5,
        unit: 'percent',
        timestamp: now,
      };
      mockPool.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.record('t1', 'cpu_usage', 75.5, 'percent');

      expect(result).toEqual(mockRow);
      expect(result.id).toBe('m1');
      expect(result.tenant_id).toBe('t1');
      expect(result.name).toBe('cpu_usage');
      expect(result.value).toBe(75.5);
      expect(result.unit).toBe('percent');
    });

    it('should use INSERT INTO metrics SQL with NOW() and RETURNING', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'm1' }] });

      await repository.record('t1', 'cpu', 50, '%');

      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('INSERT INTO metrics');
      expect(sql).toContain('NOW()');
      expect(sql).toContain('RETURNING');
    });

    it('should pass correct parameters in correct order', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'm1' }] });

      await repository.record('tenant-x', 'disk_io', 123.45, 'mb/s');

      const params = mockPool.query.mock.calls[0][1];
      expect(params).toEqual(['tenant-x', 'disk_io', 123.45, 'mb/s']);
    });

    it('should record metric with zero value', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'm_LIST', tenant_id: 't1', name: 'idle', value: 0, unit: 's', timestamp: new Date() }],
      });

      const result = await repository.record('t1', 'idle', 0, 's');

      expect(result.value).toBe(0);
      const params = mockPool.query.mock.calls[0][1];
      expect(params[2]).toBe(0);
    });

    it('should record metric with negative value', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'm1', tenant_id: 't1', name: 'temp', value: -10.5, unit: 'celsius', timestamp: new Date() }],
      });

      const result = await repository.record('t1', 'temp', -10.5, 'celsius');

      expect(result.value).toBe(-10.5);
    });

    it('should record metric with very large value', async () => {
      const largeValue = 999999999.99;
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'm1', tenant_id: 't1', name: 'bytes', value: largeValue, unit: 'bytes', timestamp: new Date() }],
      });

      const result = await repository.record('t1', 'bytes', largeValue, 'bytes');

      expect(result.value).toBe(largeValue);
    });

    it('should handle empty rows response gracefully', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.record('t1', 'cpu', 50, '%');

      expect(result).toBeUndefined();
    });

    it('should handle DB query errors', async () => {
      mockPool.query.mockRejectedValue(new Error('connection refused'));

      await expect(repository.record('t1', 'cpu', 50, '%')).rejects.toThrow('connection refused');
    });

    it('should handle unique constraint violation', async () => {
      const dbError = new Error('duplicate key value violates unique constraint');
      (dbError as any).code = '23505';
      mockPool.query.mockRejectedValue(dbError);

      await expect(repository.record('t1', 'cpu', 50, '%')).rejects.toThrow('duplicate key');
    });

    it('should call pool.query exactly once per record', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'm1' }] });

      await repository.record('t1', 'cpu', 50, '%');

      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== query ====================

  describe('query', () => {
    it('should query metrics by tenant, name, and time range', async () => {
      const start = new Date('2026-05-01');
      const end = new Date('2026-05-06');
      const mockRows: Metric[] = [
        { id: 'm1', tenant_id: 't1', name: 'cpu', value: 70, unit: '%', timestamp: start },
        { id: 'm2', tenant_id: 't1', name: 'cpu', value: 80, unit: '%', timestamp: end },
      ];
      mockPool.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.query('t1', 'cpu', start, end);

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should use correct SQL with SELECT, WHERE, ORDER BY', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.query('t1', 'cpu', new Date(), new Date());

      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('SELECT');
      expect(sql).toContain('FROM metrics');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('tenant_id = $1');
      expect(sql).toContain('name = $2');
      expect(sql).toContain('timestamp >= $3');
      expect(sql).toContain('timestamp <= $4');
      expect(sql).toContain('ORDER BY timestamp DESC');
    });

    it('should pass correct query parameters', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const start = new Date('2026-01-01');
      const end = new Date('2026-06-30');

      await repository.query('tenant-abc', 'memory', start, end);

      const params = mockPool.query.mock.calls[0][1];
      expect(params).toEqual(['tenant-abc', 'memory', start, end]);
    });

    it('should return empty array when no rows match', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.query('t1', 'nonexistent', new Date(), new Date());

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should return single result correctly', async () => {
      const singleMetric: Metric = {
        id: 'm1',
        tenant_id: 't1',
        name: 'cpu',
        value: 42,
        unit: 'percent',
        timestamp: new Date(),
      };
      mockPool.query.mockResolvedValue({ rows: [singleMetric] });

      const result = await repository.query('t1', 'cpu', new Date(), new Date());

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(singleMetric);
    });

    it('should return results ordered by timestamp descending', async () => {
      const earlier = new Date('2026-01-01');
      const later = new Date('2026-06-01');
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'm2', tenant_id: 't1', name: 'cpu', value: 80, unit: '%', timestamp: later },
          { id: 'm1', tenant_id: 't1', name: 'cpu', value: 70, unit: '%', timestamp: earlier },
        ],
      });

      const result = await repository.query('t1', 'cpu', earlier, later);

      expect(result[0].timestamp).toEqual(later);
      expect(result[1].timestamp).toEqual(earlier);
    });

    it('should handle DB errors on query', async () => {
      mockPool.query.mockRejectedValue(new Error('table does not exist'));

      await expect(repository.query('t1', 'cpu', new Date(), new Date())).rejects.toThrow('table does not exist');
    });

    it('should handle connection timeout errors', async () => {
      mockPool.query.mockRejectedValue(new Error('connection timeout'));

      await expect(repository.query('t1', 'cpu', new Date(), new Date())).rejects.toThrow('connection timeout');
    });

    it('should call pool.query exactly once', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.query('t1', 'cpu', new Date(), new Date());

      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should query large result sets', async () => {
      const largeRows = Array.from({ length: 1000 }, (_, i) => ({
        id: `m${i}`,
        tenant_id: 't1',
        name: 'cpu',
        value: 50 + (i % 50),
        unit: '%',
        timestamp: new Date(Date.now() - i * 60000),
      }));
      mockPool.query.mockResolvedValue({ rows: largeRows });

      const result = await repository.query('t1', 'cpu', new Date('2026-01-01'), new Date());

      expect(result).toHaveLength(1000);
    });
  });

  // ==================== aggregate ====================

  describe('aggregate', () => {
    it('should return aggregated statistics with numeric values', async () => {
      const start = new Date('2026-05-01');
      const end = new Date('2026-05-06');
      mockPool.query.mockResolvedValue({
        rows: [{ avg: 77.5, min: 70, max: 85, count: 100 }],
      });

      const result = await repository.aggregate('t1', 'cpu', start, end);

      expect(result.avg).toBe(77.5);
      expect(result.min).toBe(70);
      expect(result.max).toBe(85);
      expect(result.count).toBe(100);
    });

    it('should use AVG, MIN, MAX, COUNT in SQL', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ avg: 0, min: 0, max: 0, count: 0 }] });

      await repository.aggregate('t1', 'cpu', new Date(), new Date());

      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('AVG(value)');
      expect(sql).toContain('MIN(value)');
      expect(sql).toContain('MAX(value)');
      expect(sql).toContain('COUNT(*)');
    });

    it('should use FROM metrics with WHERE clause', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ avg: 0, min: 0, max: 0, count: 0 }] });

      await repository.aggregate('t1', 'cpu', new Date(), new Date());

      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('FROM metrics');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('tenant_id = $1');
      expect(sql).toContain('name = $2');
      expect(sql).toContain('timestamp >= $3');
      expect(sql).toContain('timestamp <= $4');
    });

    it('should pass correct parameters', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ avg: 0, min: 0, max: 0, count: 0 }] });
      const start = new Date('2026-03-01');
      const end = new Date('2026-03-31');

      await repository.aggregate('tenant-z', 'latency', start, end);

      const params = mockPool.query.mock.calls[0][1];
      expect(params).toEqual(['tenant-z', 'latency', start, end]);
    });

    it('should handle DB errors on aggregate', async () => {
      mockPool.query.mockRejectedValue(new Error('timeout'));

      await expect(repository.aggregate('t1', 'cpu', new Date(), new Date())).rejects.toThrow('timeout');
    });

    it('should handle count returned as string from PostgreSQL', async () => {
      // PostgreSQL driver can return COUNT as a string
      mockPool.query.mockResolvedValue({
        rows: [{ avg: 50, min: 10, max: 90, count: '42' }],
      });

      const result = await repository.aggregate('t1', 'cpu', new Date(), new Date());

      expect(result.count).toBe('42');
    });

    it('should handle zero results with null aggregates', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ avg: null, min: null, max: null, count: '0' }],
      });

      const result = await repository.aggregate('t1', 'cpu', new Date(), new Date());

      expect(result.avg).toBeNull();
      expect(result.min).toBeNull();
      expect(result.max).toBeNull();
      expect(result.count).toBe('0');
    });

    it('should handle fractional values correctly', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ avg: 33.333, min: 10.1, max: 99.9, count: 3 }],
      });

      const result = await repository.aggregate('t1', 'latency', new Date(), new Date());

      expect(result.avg).toBeCloseTo(33.333);
      expect(result.min).toBeCloseTo(10.1);
      expect(result.max).toBeCloseTo(99.9);
    });

    it('should call pool.query exactly once', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ avg: 0, min: 0, max: 0, count: 0 }] });

      await repository.aggregate('t1', 'cpu', new Date(), new Date());

      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should handle identical min and max values', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ avg: 50, min: 50, max: 50, count: 10 }],
      });

      const result = await repository.aggregate('t1', 'cpu', new Date(), new Date());

      expect(result.min).toBe(result.max);
      expect(result.avg).toBe(result.min);
    });
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should accept a DatabasePool instance', () => {
      const pool = { query: jest.fn() };
      const repo = new MetricsRepository(pool as any);

      expect(repo).toBeDefined();
      expect(repo).toBeInstanceOf(MetricsRepository);
    });

    it('should use the injected pool for all methods', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: 'm1' }] }),
      };
      const repo = new MetricsRepository(pool as any);

      await repo.record('t1', 'cpu', 50, '%');

      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });
});
