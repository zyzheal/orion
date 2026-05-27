/**
 * APM (Application Performance Monitoring) API
 *
 * Distributed tracing and database profiling API client.
 */

import apiClient from './client';

export interface TraceSummary {
  traceId: string;
  root_service: string;
  root_operation: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  span_count: number;
  status: 'ok' | 'error';
  tenant_id?: string;
}

export interface Span {
  id: string;
  trace_id: string;
  parent_span_id?: string;
  span_id: string;
  name: string;
  operation: string;
  kind: string;
  service_name: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, any>;
  tenant_id?: string;
}

export interface TraceDetail {
  traceId: string;
  spans: Span[];
}

export interface SlowQuery {
  id: string;
  query_hash: string;
  normalized_query: string;
  original_query: string;
  duration_ms: number;
  params_count: number;
  tenant_id?: string;
  error?: string;
  created_at: string;
}

export interface QueryPatternStats {
  query_hash: string;
  normalized_query: string;
  execution_count: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  max_duration_ms: number;
  error_count: number;
  last_executed: string;
}

export interface ServiceInfo {
  service_name: string;
  trace_count: number;
  max_duration_ms: number;
}

export interface ServiceDependency {
  source_service: string;
  target_service: string;
  call_count: number;
  avg_latency_ms: number;
  error_rate: number;
}

export const apmApi = {
  // Distributed Tracing
  listTraces: async (params?: {
    serviceName?: string;
    status?: 'ok' | 'error';
    tenantId?: string;
    limit?: number;
    since?: string;
  }) => {
    const response = await apiClient.get('/v1/apm/traces', { params });
    return response.data as TraceSummary[];
  },

  getTrace: async (traceId: string) => {
    const response = await apiClient.get(`/v1/apm/traces/${traceId}`);
    return response.data as TraceDetail;
  },

  getTraceSummary: async (traceId: string) => {
    const response = await apiClient.get(`/v1/apm/traces/${traceId}/summary`);
    return response.data as TraceSummary;
  },

  getSlowTraces: async (thresholdMs?: number, limit?: number) => {
    const response = await apiClient.get('/v1/apm/traces/slow', {
      params: { thresholdMs, limit },
    });
    return response.data as TraceSummary[];
  },

  listServices: async () => {
    const response = await apiClient.get('/v1/apm/services');
    return response.data as ServiceInfo[];
  },

  // Database Profiling
  getSlowQueries: async (params?: {
    limit?: number;
    since?: string;
    tenantId?: string;
  }) => {
    const response = await apiClient.get('/v1/apm/slow-queries', { params });
    return response.data as SlowQuery[];
  },

  getQueryPatternStats: async (since?: string) => {
    const response = await apiClient.get('/v1/apm/slow-queries/patterns', {
      params: { since },
    });
    return response.data as QueryPatternStats[];
  },

  // Service Topology
  getServiceTopology: async () => {
    const response = await apiClient.get('/v1/apm/services/topology');
    return response.data as { data?: ServiceDependency[] };
  },
};

export default apmApi;
