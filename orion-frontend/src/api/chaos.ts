/**
 * Chaos Engineering API
 * Phase 3 - Chaos experiments and resilience scoring
 */

import apiClient from './client';

export interface ChaosExperiment {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  scope: {
    tenant_id: string;
    service_id?: string;
    environment: 'staging' | 'production';
  };
  faults: ChaosFault[];
  auto_rollback: boolean;
  status: 'draft' | 'active' | 'completed' | 'archived';
  created_at: string;
}

export interface ChaosFault {
  type: 'network_latency' | 'service_down' | 'cpu_stress' | 'memory_stress' | 'disk_full';
  target: string;
  config: Record<string, unknown>;
  duration_ms: number;
  delay_ms: number;
}

export interface ChaosRun {
  id: string;
  experiment_id: string;
  status: 'running' | 'completed' | 'failed' | 'rolled_back';
  timeline: ChaosEvent[];
  metrics: {
    mttr_ms: number;
    affected_services: string[];
    error_count: number;
    recovered: boolean;
  };
  started_at: string;
  ended_at?: string;
}

export interface ChaosEvent {
  timestamp: string;
  type: 'inject' | 'detect' | 'recover' | 'rollback';
  service: string;
  details: string;
}

export interface ResilienceScore {
  score: number;
  mttr_ms: number;
  success_rate: number;
  error_budget: number;
  trend: 'improving' | 'stable' | 'degrading';
  calculated_at: string;
}

export const chaosApi = {
  listExperiments: async (params?: { status?: string }) => {
    const response = await apiClient.get('/api/v1/chaos/experiments', { params });
    return response.data;
  },

  getExperiment: async (experimentId: string) => {
    const response = await apiClient.get(`/api/v1/chaos/experiments/${experimentId}`);
    return response.data as ChaosExperiment;
  },

  createExperiment: async (data: { name: string; scope: Record<string, unknown>; faults: ChaosFault[] }) => {
    const response = await apiClient.post('/api/v1/chaos/experiments', data);
    return response.data as ChaosExperiment;
  },

  runExperiment: async (experimentId: string, dryRun?: boolean) => {
    const response = await apiClient.post(`/api/v1/chaos/experiments/${experimentId}/run`, { dry_run: dryRun });
    return response.data as ChaosRun;
  },

  getRun: async (runId: string) => {
    const response = await apiClient.get(`/api/v1/chaos/runs/${runId}`);
    return response.data as ChaosRun;
  },

  rollbackRun: async (runId: string, reason?: string) => {
    const response = await apiClient.post(`/api/v1/chaos/runs/${runId}/rollback`, { reason });
    return response.data;
  },
};

export const resilienceApi = {
  getScore: async (params?: { serviceId?: string }) => {
    const response = await apiClient.get('/api/v1/resilience-score', { params });
    return response.data as ResilienceScore;
  },

  getHistory: async (params?: { serviceId?: string; days?: number }) => {
    const response = await apiClient.get('/api/v1/resilience-score/history', { params });
    return response.data;
  },
};

export default { chaosApi, resilienceApi };