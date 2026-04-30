/**
 * Prometheus HTTP API Client for Canary Analysis
 *
 * Uses native fetch() to query Prometheus.
 * Falls back to empty results when Prometheus is unavailable.
 */

export interface PrometheusConfig {
  baseUrl: string;
  timeout?: number;
}

export interface PrometheusQueryResult {
  metric: Record<string, string>;
  values: [number, string][];
}

export interface PrometheusRangeQueryResponse {
  status: string;
  data: {
    resultType: string;
    result: PrometheusQueryResult[];
  };
}

/**
 * Prometheus HTTP API client
 */
export class PrometheusClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: PrometheusConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeout = config.timeout || 10_000;
  }

  /**
   * Execute range query
   */
  async queryRange(query: string, start: Date, end: Date, step: string): Promise<PrometheusQueryResult[]> {
    try {
      const params = new URLSearchParams({
        query,
        start: Math.floor(start.getTime() / 1000).toString(),
        end: Math.floor(end.getTime() / 1000).toString(),
        step,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/v1/query_range?${params}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return [];
      const text = await response.text();
      const data = JSON.parse(text) as PrometheusRangeQueryResponse;
      return data.data?.result || [];
    } catch {
      return [];
    }
  }

  /**
   * Execute instant query
   */
  async query(query: string): Promise<PrometheusQueryResult[]> {
    try {
      const params = new URLSearchParams({ query });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/v1/query?${params}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return [];
      const text = await response.text();
      const data = JSON.parse(text) as PrometheusRangeQueryResponse;
      return data.data?.result || [];
    } catch {
      return [];
    }
  }
}

/**
 * Create PrometheusClient from environment or config
 */
export function createPrometheusClient(config?: Partial<PrometheusConfig>): PrometheusClient | null {
  const baseUrl = config?.baseUrl || process.env.PROMETHEUS_URL;
  if (!baseUrl) return null;

  return new PrometheusClient({
    baseUrl,
    timeout: config?.timeout || parseInt(process.env.PROMETHEUS_TIMEOUT || '10000'),
  });
}

/**
 * Default PromQL queries for canary analysis
 */
export const CanaryPromQL = {
  latency: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
  errorRate: 'sum(rate(http_requests_errors_total[5m])) / sum(rate(http_requests_total[5m]))',
  throughput: 'sum(rate(http_requests_total[5m]))',
  cpu: 'rate(process_cpu_seconds_total[5m])',
  memory: 'process_resident_memory_bytes',
};
