/**
 * MetricsRepository 单元测试
 */

import { MetricsRepository, Metric } from '../../services/metrics/MetricsRepository';

describe('MetricsRepository', () => {
  let repo: MetricsRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new MetricsRepository(mockDb);
  });

  test('should record a metric', async () => {
    const mockRow = {
      id: 'metric-1',
      tenant_id: 'tenant-1',
      name: 'cpu_usage',
      value: 75.5,
      unit: 'percent',
      timestamp: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.record('tenant-1', 'cpu_usage', 75.5, 'percent');
    expect(result.name).toBe('cpu_usage');
    expect(result.value).toBe(75.5);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO metrics'),
      ['tenant-1', 'cpu_usage', 75.5, 'percent']
    );
  });

  test('should query metrics by name and time range', async () => {
    const startTime = new Date('2026-04-25T00:00:00Z');
    const endTime = new Date('2026-04-25T23:59:59Z');
    const mockRows = [
      { id: 'metric-1', tenant_id: 'tenant-1', name: 'cpu_usage', value: 75.5, unit: 'percent', timestamp: startTime },
      { id: 'metric-2', tenant_id: 'tenant-1', name: 'cpu_usage', value: 80.2, unit: 'percent', timestamp: endTime },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });

    const result = await repo.query('tenant-1', 'cpu_usage', startTime, endTime);
    expect(result).toHaveLength(2);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tenant_id = $1 AND name = $2'),
      ['tenant-1', 'cpu_usage', startTime, endTime]
    );
  });

  test('should aggregate metrics (avg/min/max/count)', async () => {
    const startTime = new Date('2026-04-25T00:00:00Z');
    const endTime = new Date('2026-04-25T23:59:59Z');
    const mockAgg = { avg: 77.85, min: 75.5, max: 80.2, count: 2 };
    mockDb.query.mockResolvedValue({ rows: [mockAgg] });

    const result = await repo.aggregate('tenant-1', 'cpu_usage', startTime, endTime);
    expect(result.avg).toBe(77.85);
    expect(result.min).toBe(75.5);
    expect(result.max).toBe(80.2);
    expect(result.count).toBe(2);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT AVG(value) as avg'),
      ['tenant-1', 'cpu_usage', startTime, endTime]
    );
  });
});
