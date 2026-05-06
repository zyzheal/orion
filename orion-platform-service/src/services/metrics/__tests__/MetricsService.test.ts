/**
 * MetricsService Tests
 */

import { MetricsService, MetricsServiceError } from '../MetricsService';
import { MetricsRepository, Metric } from '../MetricsRepository';

describe('MetricsService', () => {
  let mockRepository: jest.Mocked<MetricsRepository>;
  let service: MetricsService;

  beforeEach(() => {
    mockRepository = {
      record: jest.fn(),
      query: jest.fn(),
      aggregate: jest.fn(),
    } as unknown as jest.Mocked<MetricsRepository>;

    service = new MetricsService(mockRepository);
  });

  describe('record', () => {
    it('should record a metric', async () => {
      const mockMetric: Metric = {
        id: 'm1',
        tenant_id: 't1',
        name: 'cpu_usage',
        value: 75.5,
        unit: 'percent',
        timestamp: new Date(),
      };
      mockRepository.record.mockResolvedValue(mockMetric);

      const result = await service.record('t1', 'cpu_usage', 75.5, 'percent');

      expect(result).toEqual(mockMetric);
      expect(mockRepository.record).toHaveBeenCalledWith('t1', 'cpu_usage', 75.5, 'percent');
    });
  });

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
      expect(mockRepository.query).toHaveBeenCalledWith('t1', 'cpu_usage', startTime, endTime);
    });

    it('should return empty array when no metrics', async () => {
      mockRepository.query.mockResolvedValue([]);

      const result = await service.query('t1', 'cpu_usage', new Date(), new Date());

      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return aggregate statistics', async () => {
      const startTime = new Date('2026-05-01');
      const endTime = new Date('2026-05-06');
      const mockStats = { avg: 77.5, min: 70, max: 85, count: 100 };
      mockRepository.aggregate.mockResolvedValue(mockStats);

      const result = await service.getStats('t1', 'cpu_usage', startTime, endTime);

      expect(result).toEqual(mockStats);
      expect(mockRepository.aggregate).toHaveBeenCalledWith('t1', 'cpu_usage', startTime, endTime);
    });
  });
});

describe('MetricsRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: MetricsRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new MetricsRepository(mockDb as any);
  });

  describe('record', () => {
    it('should insert a metric with current timestamp', async () => {
      const mockRow = { id: 'm1', tenant_id: 't1', name: 'cpu', value: 50, unit: 'percent', timestamp: new Date() };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.record('t1', 'cpu', 50, 'percent');

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO metrics');
      expect(sql).toContain('NOW()');
    });
  });

  describe('query', () => {
    it('should query metrics by name and time range', async () => {
      const startTime = new Date('2026-05-01');
      const endTime = new Date('2026-05-06');
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.query('t1', 'cpu', startTime, endTime);

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('timestamp >= $3');
      expect(sql).toContain('timestamp <= $4');
      expect(sql).toContain('ORDER BY timestamp DESC');
    });
  });

  describe('aggregate', () => {
    it('should return aggregated statistics', async () => {
      const startTime = new Date('2026-05-01');
      const endTime = new Date('2026-05-06');
      const mockResult = { avg: 77.5, min: 70, max: 85, count: '100' };
      mockDb.query.mockResolvedValue({ rows: [mockResult] });

      const result = await repository.aggregate('t1', 'cpu', startTime, endTime);

      expect(result.avg).toBe(77.5);
      expect(result.min).toBe(70);
      expect(result.max).toBe(85);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('AVG(value)');
      expect(sql).toContain('MIN(value)');
      expect(sql).toContain('MAX(value)');
      expect(sql).toContain('COUNT(*)');
    });
  });
});
