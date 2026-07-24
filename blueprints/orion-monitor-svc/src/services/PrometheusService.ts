/**
 * Prometheus Service - Integration with Prometheus HTTP API
 *
 * Provides methods to query Prometheus for metrics, alerts, and targets.
 */

export interface PrometheusResponse {
  status: 'success' | 'error';
  data: unknown;
  errorType?: string;
  error?: string;
}

export interface PrometheusMetric {
  metric: Record<string, string>;
  value: [number, string];
}

export interface PrometheusAlert {
  name: string;
  state: 'firing' | 'pending' | 'inactive';
  health: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  activeAt?: string;
}

export interface PrometheusTarget {
  discoveredLabels: Record<string, string>;
  labels: Record<string, string>;
  scrapeUrl: string;
  lastError: string;
  lastScrape: string;
  health: 'up' | 'down' | 'unknown' | 'errored';
  scrapeInterval: string;
  scrapeTimeout: string;
}

export class PrometheusService {
  private prometheusUrl: string;

  constructor(prometheusUrl?: string) {
    this.prometheusUrl = prometheusUrl || process.env.PROMETHEUS_URL || 'http://localhost:9090';
  }

  /**
   * Query Prometheus instant query
   * GET /api/v1/query
   */
  async query(promql: string, time?: number): Promise<PrometheusResponse> {
    try {
      const params = new URLSearchParams({ query: promql });
      if (time) {
        params.append('time', time.toString());
      }

      const response = await fetch(`${this.prometheusUrl}/api/v1/query?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'error',
          data: null,
          errorType: 'http_error',
          error: `Prometheus query failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      return await response.json() as PrometheusResponse;
    } catch (error) {
      return {
        status: 'error',
        data: null,
        errorType: 'network_error',
        error: `Failed to connect to Prometheus: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Query Prometheus range query
   * GET /api/v1/query_range
   */
  async queryRange(
    promql: string,
    start: number,
    end: number,
    step: string
  ): Promise<PrometheusResponse> {
    try {
      const params = new URLSearchParams({
        query: promql,
        start: start.toString(),
        end: end.toString(),
        step,
      });

      const response = await fetch(`${this.prometheusUrl}/api/v1/query_range?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'error',
          data: null,
          errorType: 'http_error',
          error: `Prometheus query_range failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      return await response.json() as PrometheusResponse;
    } catch (error) {
      return {
        status: 'error',
        data: null,
        errorType: 'network_error',
        error: `Failed to connect to Prometheus: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get active alerts from Prometheus
   * GET /api/v1/alerts
   */
  async getAlerts(): Promise<PrometheusResponse> {
    try {
      const response = await fetch(`${this.prometheusUrl}/api/v1/alerts`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'error',
          data: null,
          errorType: 'http_error',
          error: `Prometheus alerts failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      return await response.json() as PrometheusResponse;
    } catch (error) {
      return {
        status: 'error',
        data: null,
        errorType: 'network_error',
        error: `Failed to connect to Prometheus: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get scrape targets from Prometheus
   * GET /api/v1/targets
   */
  async getTargets(): Promise<PrometheusResponse> {
    try {
      const response = await fetch(`${this.prometheusUrl}/api/v1/targets`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'error',
          data: null,
          errorType: 'http_error',
          error: `Prometheus targets failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      return await response.json() as PrometheusResponse;
    } catch (error) {
      return {
        status: 'error',
        data: null,
        errorType: 'network_error',
        error: `Failed to connect to Prometheus: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get target metadata from Prometheus
   * GET /api/v1/targets/metadata
   */
  async getTargetsMetadata(matchTargets?: string): Promise<PrometheusResponse> {
    try {
      const params = matchTargets ? new URLSearchParams({ match_targets: matchTargets }) : new URLSearchParams();

      const response = await fetch(`${this.prometheusUrl}/api/v1/targets/metadata?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'error',
          data: null,
          errorType: 'http_error',
          error: `Prometheus targets metadata failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      return await response.json() as PrometheusResponse;
    } catch (error) {
      return {
        status: 'error',
        data: null,
        errorType: 'network_error',
        error: `Failed to connect to Prometheus: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get label values
   * GET /api/v1/label/:name/values
   */
  async getLabelValues(labelName: string): Promise<PrometheusResponse> {
    try {
      const response = await fetch(`${this.prometheusUrl}/api/v1/label/${labelName}/values`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'error',
          data: null,
          errorType: 'http_error',
          error: `Prometheus label values failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      return await response.json() as PrometheusResponse;
    } catch (error) {
      return {
        status: 'error',
        data: null,
        errorType: 'network_error',
        error: `Failed to connect to Prometheus: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get series matching label matchers
   * POST /api/v1/series
   */
  async getSeries(match: string[]): Promise<PrometheusResponse> {
    try {
      const response = await fetch(`${this.prometheusUrl}/api/v1/series`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(match.map(m => ['match', m])),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'error',
          data: null,
          errorType: 'http_error',
          error: `Prometheus series failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      return await response.json() as PrometheusResponse;
    } catch (error) {
      return {
        status: 'error',
        data: null,
        errorType: 'network_error',
        error: `Failed to connect to Prometheus: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check Prometheus server health
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const response = await fetch(`${this.prometheusUrl}/-/healthy`, {
        method: 'GET',
      });

      if (response.ok) {
        return { healthy: true, message: 'Prometheus is healthy' };
      }

      return { healthy: false, message: `Prometheus returned status ${response.status}` };
    } catch (error) {
      return {
        healthy: false,
        message: `Failed to connect to Prometheus: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}