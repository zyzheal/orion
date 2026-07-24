/**
 * PrometheusClient 单元测试
 */

import { PrometheusClient, createPrometheusClient, CanaryPromQL } from '../PrometheusClient';
import { safeFetch } from '../../../utils/safeFetch';

jest.mock('../../../utils/safeFetch', () => ({
  safeFetch: jest.fn(),
}));

const mockSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;

describe('PrometheusClient', () => {
  let client: PrometheusClient;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    client = new PrometheusClient({ baseUrl: 'http://prometheus:9090' });
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => jest.restoreAllMocks());

  describe('queryRange', () => {
    it('should return query results', async () => {
      mockSafeFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [{ metric: { __name__: 'http_latency' }, values: [[1000, '0.5']] }],
          },
        })),
      });
      const results = await client.queryRange('http_latency', new Date('2024-01-01'), new Date('2024-01-02'), '1m');
      expect(results).toHaveLength(1);
      expect(results[0].metric.__name__).toBe('http_latency');
    });

    it('should return empty array on failure', async () => {
      mockSafeFetch.mockRejectedValue(new Error('network error'));
      const results = await client.queryRange('test', new Date(), new Date(), '1m');
      expect(results).toEqual([]);
    });

    it('should return empty array on HTTP error', async () => {
      mockSafeFetch.mockResolvedValue({ ok: false, status: 500 });
      const results = await client.queryRange('test', new Date(), new Date(), '1m');
      expect(results).toEqual([]);
    });

    it('should return empty array on empty result', async () => {
      mockSafeFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          status: 'success',
          data: { resultType: 'matrix', result: [] },
        })),
      });
      const results = await client.queryRange('test', new Date(), new Date(), '1m');
      expect(results).toEqual([]);
    });
  });

  describe('query', () => {
    it('should return instant query results', async () => {
      mockSafeFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: {}, values: [] }],
          },
        })),
      });
      const results = await client.query('up');
      expect(results).toHaveLength(1);
    });

    it('should return empty array on failure', async () => {
      mockSafeFetch.mockRejectedValue(new Error('network error'));
      const results = await client.query('up');
      expect(results).toEqual([]);
    });
  });
});

describe('createPrometheusClient', () => {
  it('should return null when no URL configured', () => {
    const client = createPrometheusClient({});
    expect(client).toBeNull();
  });

  it('should return client when URL is provided', () => {
    const client = createPrometheusClient({ baseUrl: 'http://localhost:9090' });
    expect(client).toBeInstanceOf(PrometheusClient);
  });
});

describe('CanaryPromQL', () => {
  it('should define standard queries', () => {
    expect(CanaryPromQL.latency).toContain('histogram_quantile');
    expect(CanaryPromQL.errorRate).toContain('http_requests_errors_total');
    expect(CanaryPromQL.throughput).toContain('http_requests_total');
    expect(CanaryPromQL.cpu).toContain('process_cpu_seconds_total');
  });
});
