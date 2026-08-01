/**
 * Performance Engineering API
 * Phase 4 - Performance baselines, evaluation, bottleneck detection
 */
import apiClient from './client';

export interface PerformanceBaseline {
  id: string;
  serviceName: string;
  environment: string;
  metrics: {
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number;
    errorRate: number;
  };
  createdAt: string;
  createdBy: string;
}

export interface EvaluationResult {
  id: string;
  serviceName: string;
  baselineId: string;
  status: 'pass' | 'warn' | 'fail';
  currentMetrics: Record<string, number>;
  deviations: { metric: string; baseline: number; current: number; deviation: number }[];
  evaluatedAt: string;
}

export interface ServiceProfile {
  serviceName: string;
  avgLatency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  resourceUsage: { cpu: number; memory: number; network: number };
}

export interface Bottleneck {
  id: string;
  serviceName: string;
  type: 'cpu' | 'memory' | 'network' | 'database' | 'lock';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metricValue: number;
  threshold: number;
  detectedAt: string;
}

export interface PerformanceSuggestion {
  id: string;
  serviceName: string;
  category: 'scaling' | 'caching' | 'optimization' | 'architecture';
  description: string;
  expectedImprovement: string;
  effort: 'low' | 'medium' | 'high';
}

export const performanceApi = {
  createBaseline: async (data: {
    serviceName: string;
    environment: string;
    metrics: Record<string, number>;
  }) => {
    const response = await apiClient.post('/api/performance/baselines', data);
    return response.data as PerformanceBaseline;
  },

  listBaselines: async (params?: { serviceName?: string; environment?: string }) => {
    const response = await apiClient.get('/api/performance/baselines', { params });
    return response.data as PerformanceBaseline[];
  },

  evaluatePerformance: async (data: {
    serviceName: string;
    baselineId: string;
    metrics: Record<string, number>;
  }) => {
    const response = await apiClient.post('/api/performance/evaluate', data);
    return response.data as EvaluationResult;
  },

  profileService: async (serviceName: string) => {
    const response = await apiClient.get(`/api/performance/profile/${serviceName}`);
    return response.data as ServiceProfile;
  },

  getBottlenecks: async (params?: { serviceName?: string; severity?: string }) => {
    const response = await apiClient.get('/api/performance/bottlenecks', { params });
    return response.data as Bottleneck[];
  },

  getSuggestions: async (params?: { serviceName?: string }) => {
    const response = await apiClient.get('/api/performance/suggestions', { params });
    return response.data as PerformanceSuggestion[];
  },
};

export default performanceApi;
