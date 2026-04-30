/**
 * Metrics API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryMetrics, queryRangeMetrics, getDashboardData } from '../metrics';
import { api } from '../client';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Metrics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query metrics', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { result: [] } } } as any);
    await queryMetrics('cpu_usage');
    expect(api.get).toHaveBeenCalledWith('/v1/metrics/query?query=cpu_usage');
  });

  it('should query range metrics', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { result: [] } } } as any);
    await queryRangeMetrics('cpu_usage', 1000, 2000, 60);
    expect(api.get).toHaveBeenCalledWith(
      '/v1/metrics/query/range?query=cpu_usage&start=1000&end=2000&step=60'
    );
  });

  it('should get dashboard data', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { data: { cpu: 50, memory: 60, requests: 1000, errors: 5, latency: 200 } } },
    } as any);
    const result = await getDashboardData();
    expect(api.get).toHaveBeenCalledWith('/v1/metrics/dashboard');
    expect(result.data.data.data.cpu).toBe(50);
  });
});
