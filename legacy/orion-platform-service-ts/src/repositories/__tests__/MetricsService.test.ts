/**
 * MetricsService 单元测试
 */

import { MetricsService } from '../../services/metrics/MetricsService';
import { MetricsRepository, Metric } from '../../services/metrics/MetricsRepository';

describe('MetricsService', () => {
  let service: MetricsService;
  let mockRepo: MetricsRepository;

  beforeEach(() => {
    mockRepo = {
      record: jest.fn(),
      query: jest.fn(),
      aggregate: jest.fn(),
    } as unknown as MetricsRepository;
    service = new MetricsService(mockRepo);
  });

  test('should record a metric via service', async () => {
    const mockMetric: Metric = {
      id: 'metric-1',
      tenant_id: 'tenant-1',
      name: 'cpu_usage',
      value: 75.5,
      unit: 'percent',
      timestamp: new Date(),
    };
    (mockRepo.record as jest.Mock).mockResolvedValue(mockMetric);

    const result = await service.record('tenant-1', 'cpu_usage', 75.5, 'percent');
    expect(result).toEqual(mockMetric);
    expect(mockRepo.record).toHaveBeenCalledWith('tenant-1', 'cpu_usage', 75.5, 'percent');
  });

  test('should query metrics via service', async () => {
    const startTime = new Date('2026-04-25T00:00:00Z');
    const endTime = new Date('2026-04-25T23:59:59Z');
    const mockMetrics: Metric[] = [
      { id: 'metric-1', tenant_id: 'tenant-1', name: 'cpu_usage', value: 75.5, unit: 'percent', timestamp: startTime },
      { id: 'metric-2', tenant_id: 'tenant-1', name: 'cpu_usage', value: 80.2, unit: 'percent', timestamp: endTime },
    ];
    (mockRepo.query as jest.Mock).mockResolvedValue(mockMetrics);

    const result = await service.query('tenant-1', 'cpu_usage', startTime, endTime);
    expect(result).toHaveLength(2);
    expect(mockRepo.query).toHaveBeenCalledWith('tenant-1', 'cpu_usage', startTime, endTime);
  });

  test('should get stats via service', async () => {
    const startTime = new Date('2026-04-25T00:00:00Z');
    const endTime = new Date('2026-04-25T23:59:59Z');
    const mockStats = { avg: 77.85, min: 75.5, max: 80.2, count: 2 };
    (mockRepo.aggregate as jest.Mock).mockResolvedValue(mockStats);

    const result = await service.getStats('tenant-1', 'cpu_usage', startTime, endTime);
    expect(result).toEqual(mockStats);
    expect(mockRepo.aggregate).toHaveBeenCalledWith('tenant-1', 'cpu_usage', startTime, endTime);
  });
});
