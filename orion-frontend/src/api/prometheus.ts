/**
 * Prometheus Query API Client
 *
 * Provides direct Prometheus query/range-query endpoints.
 * This is SEPARATE from api/monitoring.ts which wraps the internal
 * monitoring subsystem.
 *
 * Backend routes: orion-platform-service/src/api/metrics-routes.ts
 * (Prometheus proxy layer)
 */

import { api } from './client';

export interface MetricResult {
  metric: string;
  values: Array<[number, string]>;
}

export interface DashboardData {
  cpu: number;
  memory: number;
  requests: number;
  errors: number;
  latency: number;
}

export async function queryMetrics(query: string, time?: number) {
  const qs = `?query=${encodeURIComponent(query)}${time ? `&time=${time}` : ''}`;
  return api.get<{ result: MetricResult[] }>(`/v1/metrics/query${qs}`);
}

export async function queryRangeMetrics(query: string, start: number, end: number, step: number) {
  return api.get<{ result: MetricResult[] }>(
    `/v1/metrics/query/range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
  );
}

export async function getDashboardData() {
  return api.get<DashboardData>('/v1/metrics/dashboard');
}
