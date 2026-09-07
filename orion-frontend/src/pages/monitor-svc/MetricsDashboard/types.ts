/**
 * MetricsDashboard types
 * 抽取自 index.tsx (P2-9 Phase 145)
 */
export interface MetricSummary {
  requestRate: number;
  errorRate: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  throughput: number;
}

export interface ServiceHealthRow {
  key: string;
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  requestRate: string;
  errorRate: string;
  latency: string;
}

export type TimeRange = '5m' | '15m' | '1h' | '6h' | '24h' | '7d';
