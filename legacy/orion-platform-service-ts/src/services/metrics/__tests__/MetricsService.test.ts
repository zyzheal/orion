/**
 * MetricsService & MetricsRepository 单元测试
 *
 * 覆盖：MetricsService（record/query/getStats）、MetricsRepository（record/query/aggregate）、
 * MetricsServiceError、边界条件、错误传播、SQL 参数验证
 */

import { MetricsService, MetricsServiceError } from '../MetricsService';
import { MetricsRepository, Metric } from '../MetricsRepository';

// ==================== MetricsService ====================

describe('MetricsService', () => {
  let mockRepository: jest.Mocked<MetricsRepository>;
  let service: MetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = {
      record: jest.fn(),
      query: jest.fn(),
      aggregate: jest.fn(),
    } as unknown as jest.Mocked<MetricsRepository>;
    service = new MetricsService(mockRepository);
  });

  // ==================== record ====================

  describe('record', () => {
    it('should record a metric and return the saved metric', async () => {
      const mockMetric: Metric = {
        id: 'm1',
        tenant_id: 't1',
        name: 'cpu_usage',
        value: 75.5,
        unit: 'percent',
        timestamp: new Date('2026-06-01T10:00:00Z'),
      };
      mockRepository.record.mockResolvedValue(mockMetric);

      const result = await service.record('t1', 'cpu_usage', 75.5, 'percent');

      expect(result).toEqual(mockMetric);
      expect(mockRepository.record).toHaveBeenCalledWith('t1', 'cpu_usage', 75.5, 'percent');
      expect(mockRepository.record).toHaveBeenCalledTimes(1);
    });

    it('should record metric with zero value', async () => {
      const mockMetric: Metric = {
        id: 'm2',
        tenant_id: 't1',
        name: 'idle_time',
        value: 0,
        unit: 'seconds',
        timestamp: new Date(),
      };
      mockRepository.record.mockResolvedValue(mockMetric);

      const result = await service.record('t1', 'idle_time', 0, 'seconds');

      expect(result.value).toBe(0);
      expect(mockRepository.record).toHaveBeenCalledWith('t1', 'idle_time', 0, 'seconds');
    });

    it('should record metric with negative value', async () => {
      const mockMetric: Metric = {
        id: 'm3',
        tenant_id: 't1',
        name: 'temperature',
        value: -10.5,
        unit: 'celsius',
        timestamp: new Date(),
      };
      mockRepository.record.mockResolvedValue(mockMetric);

      const result = await service.record('t1', 'temperature', -10.5, 'celsius');

      expect(result.value).toBe(-10.5);
    });

    it('should record metric with very large value', async () => {
      const largeValue = 999999999.99;
      const mockMetric: Metric = {
        id: 'm4',
        tenant_id: 't1',
        name: 'total_bytes',
        value: largeValue,
        unit: 'bytes',
        timestamp: new Date(),
      };
      mockRepository.record.mockResolvedValue(mockMetric);

      const result = await service.record('t1', 'total_bytes', largeValue, 'bytes');

      expect(result.value).toBe(largeValue);
    });

    it('should handle different tenant IDs independently', async () => {
      const metric1: Metric = { id: 'm1', tenant_id: 'tenant-a', name: 'cpu', value: 50, unit: '%', timestamp: new Date() };
      const metric2: Metric = { id: 'm2', tenant_id: 'tenant-b', name: 'cpu', value: 60, unit: '%', timestamp: new Date() };

      mockRepository.record.mockResolvedValueOnce(metric1).mockResolvedValueOnce(metric2);

      const result1 = await service.record('tenant-a', 'cpu', 50, '%');
      const result2 = await service.record('tenant-b', 'cpu', 60, '%');

      expect(result1.tenant_id).toBe('tenant-a');
      expect(result2.tenant_id).toBe('tenant-b');
      expect(mockRepository.record).toHaveBeenCalledTimes(2);
    });

    it('should propagate repository errors', async () => {
      mockRepository.record.mockRejectedValue(new Error('DB connection failed'));

      await expect(service.record('t1', 'cpu', 50, '%')).rejects.toThrow('DB connection failed');
    });

    it('should record multiple metrics sequentially', async () => {
      const metrics = ['cpu', 'memory', 'disk'].map((name, i) => ({
        id: `m${i}`,
        tenant_id: 't1',
        name,
        value: 50 + i * 10,
        unit: 'percent',
        timestamp: new Date(),
      }));

      metrics.forEach((m) => mockRepository.record.mockResolvedValueOnce(m));

      const results = [];
      for (const m of ['cpu', 'memory', 'disk']) {
        results.push(await service.record('t1', m, 50, 'percent'));
      }

      expect(results).toHaveLength(3);
      expect(mockRepository.record).toHaveBeenCalledTimes(3);
    });
  });

  // ==================== query ====================

  describe('query', () => {
    it('should query metrics within time range', async () => {
      const startTime = new Date('2026-05-01');
      const endTime = new Date('2026-05-06');
      const mockMetrics: Metric[] = [
        { id: 'm1', tenant_id: 't1', name: 'cpu_usage', value: 75, unit: 'percent', timestamp: startTime },
        { id: 'm2', tenant_id: 't1', name: 'cpu_usage', value: 80, unit: 'percent', timestamp: endTime },
      ];
      mockRepository.query.mockResolvedValue(mockMetrics);

      const result = await service.query('t1', 'cpu_usage', startTime, endTime);

      expect(result).toEqual(mockMetrics);
      expect(result).toHaveLength(2);
      expect(mockRepository.query).toHaveBeenCalledWith('t1', 'cpu_usage', startTime, endTime);
    });

    it('should return empty array when no metrics found', async () => {
      mockRepository.query.mockResolvedValue([]);

      const result = await service.query('t1', 'nonexistent', new Date(), new Date());

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should propagate repository errors on query', async () => {
      mockRepository.query.mockRejectedValue(new Error('Query timeout'));

      await expect(service.query('t1', 'cpu', new Date(), new Date())).rejects.toThrow('Query timeout');
    });

    it('should handle single result', async () => {
      const singleMetric: Metric = {
        id: 'm1',
        tenant_id: 't1',
        name: 'cpu',
        value: 42,
        unit: 'percent',
        timestamp: new Date(),
      };
      mockRepository.query.mockResolvedValue([singleMetric]);

      const result = await service.query('t1', 'cpu', new Date(), new Date());

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(singleMetric);
    });

    it('should pass exact time range parameters to repository', async () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const end = new Date('2026-12-31T23:59:59Z');
      mockRepository.query.mockResolvedValue([]);

      await service.query('t2', 'memory', start, end);

      expect(mockRepository.query).toHaveBeenCalledWith('t2', 'memory', start, end);
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return aggregated statistics', async () => {
      const startTime = new Date('2026-05-01');
      const endTime = new Date('2026-05-06');
      const mockStats = { avg: 77.5, min: 70, max: 85, count: 100 };
      mockRepository.aggregate.mockResolvedValue(mockStats);

      const result = await service.getStats('t1', 'cpu_usage', startTime, endTime);

      expect(result).toEqual(mockStats);
      expect(result.avg).toBe(77.5);
      expect(result.min).toBe(70);
      expect(result.max).toBe(85);
      expect(result.count).toBe(100);
      expect(mockRepository.aggregate).toHaveBeenCalledWith('t1', 'cpu_usage', startTime, endTime);
    });

    it('should propagate repository errors on aggregate', async () => {
      mockRepository.aggregate.mockRejectedValue(new Error('Aggregation failed'));

      await expect(service.getStats('t1', 'cpu', new Date(), new Date())).rejects.toThrow('Aggregation failed');
    });

    it('should handle stats with zero count', async () => {
      mockRepository.aggregate.mockResolvedValue({ avg: 0, min: 0, max: 0, count: 0 });

      const result = await service.getStats('t1', 'cpu', new Date(), new Date());

      expect(result.count).toBe(0);
      expect(result.avg).toBe(0);
    });

    it('should handle stats with fractional values', async () => {
      mockRepository.aggregate.mockResolvedValue({ avg: 33.333, min: 10.1, max: 99.9, count: 3 });

      const result = await service.getStats('t1', 'latency', new Date(), new Date());

      expect(result.avg).toBeCloseTo(33.333);
      expect(result.min).toBeCloseTo(10.1);
      expect(result.max).toBeCloseTo(99.9);
    });
  });
});

// ==================== MetricsServiceError ====================

describe('MetricsServiceError', () => {
  it('should create error with message and code', () => {
    const error = new MetricsServiceError('Something failed', 'ERR_METRIC');

    expect(error.message).toBe('Something failed');
    expect(error.code).toBe('ERR_METRIC');
  });

  it('should have name set to MetricsServiceError', () => {
    const error = new MetricsServiceError('test', 'TEST_CODE');

    expect(error.name).toBe('MetricsServiceError');
  });

  it('should be an instance of Error', () => {
    const error = new MetricsServiceError('test', 'TEST_CODE');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MetricsServiceError);
  });

  it('should preserve stack trace', () => {
    const error = new MetricsServiceError('test', 'TEST_CODE');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('MetricsServiceError');
  });
});

// ==================== MetricsRepository ====================

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
      const mockRow = { id: 'm1', tenant_id: 't1', name: 'cpu', value: 50, unit: 'percent', timestamp: now };
      mockPool.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.record('t1', 'cpu', 50, 'percent');

      expect(result).toEqual(mockRow);
    });

    it('should use INSERT INTO metrics SQL with NOW()', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'm1', tenant_id: 't1', name: 'cpu', value: 50, unit: '%', timestamp: new Date() }] });

      await repository.record('t1', 'cpu', 50, '%');

      const sql = mockPool.query.mock.calls[0][0];
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

    it('should handle DB query errors', async () => {
      mockPool.query.mockRejectedValue(new Error('connection refused'));

      await expect(repository.record('t1', 'cpu', 50, '%')).rejects.toThrow('connection refused');
    });

    it('should handle empty rows response gracefully', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.record('t1', 'cpu', 50, '%');

      expect(result).toBeUndefined();
    });
  });

  // ==================== query ====================

  describe('query', () => {
    it('should query metrics by tenant, name, and time range', async () => {
      const start = new Date('2026-05-01');
      const end = new Date('2026-05-06');
      const mockRows = [
        { id: 'm1', tenant_id: 't1', name: 'cpu', value: 70, unit: '%', timestamp: start },
        { id: 'm2', tenant_id: 't1', name: 'cpu', value: 80, unit: '%', timestamp: end },
      ];
      mockPool.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.query('t1', 'cpu', start, end);

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should use correct SQL with WHERE, ORDER BY', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.query('t1', 'cpu', new Date(), new Date());

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('SELECT');
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

    it('should handle DB errors on query', async () => {
      mockPool.query.mockRejectedValue(new Error('table does not exist'));

      await expect(repository.query('t1', 'cpu', new Date(), new Date())).rejects.toThrow('table does not exist');
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

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('AVG(value)');
      expect(sql).toContain('MIN(value)');
      expect(sql).toContain('MAX(value)');
      expect(sql).toContain('COUNT(*)');
    });

    it('should use WHERE clause with correct parameters', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ avg: 0, min: 0, max: 0, count: 0 }] });
      const start = new Date('2026-03-01');
      const end = new Date('2026-03-31');

      await repository.aggregate('t2', 'latency', start, end);

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('WHERE');
      expect(sql).toContain('tenant_id = $1');
      expect(sql).toContain('name = $2');

      const params = mockPool.query.mock.calls[0][1];
      expect(params).toEqual(['t2', 'latency', start, end]);
    });

    it('should handle DB errors on aggregate', async () => {
      mockPool.query.mockRejectedValue(new Error('timeout'));

      await expect(repository.aggregate('t1', 'cpu', new Date(), new Date())).rejects.toThrow('timeout');
    });

    it('should handle count returned as string from DB', async () => {
      // PostgreSQL can return COUNT as a string
      mockPool.query.mockResolvedValue({
        rows: [{ avg: 50, min: 10, max: 90, count: '42' }],
      });

      const result = await repository.aggregate('t1', 'cpu', new Date(), new Date());

      // The raw value from DB is a string; verify it is returned as-is
      expect(result.count).toBe('42');
    });

    it('should handle zero results from aggregate', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ avg: null, min: null, max: null, count: '0' }],
      });

      const result = await repository.aggregate('t1', 'cpu', new Date(), new Date());

      expect(result.avg).toBeNull();
      expect(result.min).toBeNull();
      expect(result.max).toBeNull();
      expect(result.count).toBe('0');
    });
  });
});

// ==================== Constructor & Injection ====================

describe('MetricsService constructor', () => {
  it('should accept a MetricsRepository instance', () => {
    const mockRepo = { record: jest.fn(), query: jest.fn(), aggregate: jest.fn() } as any;
    const service = new MetricsService(mockRepo);

    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(MetricsService);
  });

  it('should use the injected repository for all methods', async () => {
    const mockRepo = {
      record: jest.fn().mockResolvedValue({ id: 'm1' }),
      query: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ avg: 0, min: 0, max: 0, count: 0 }),
    } as any;
    const service = new MetricsService(mockRepo);

    await service.record('t1', 'cpu', 50, '%');
    await service.query('t1', 'cpu', new Date(), new Date());
    await service.getStats('t1', 'cpu', new Date(), new Date());

    expect(mockRepo.record).toHaveBeenCalledTimes(1);
    expect(mockRepo.query).toHaveBeenCalledTimes(1);
    expect(mockRepo.aggregate).toHaveBeenCalledTimes(1);
  });
});
