/**
 * Pipeline Budget API
 * Phase 1 - Budget configuration and monitoring
 */

import apiClient from './client';

export interface BudgetConfig {
  time_budget?: {
    maxDurationMs: number;
    warningPercent: number;
    policy: 'warn' | 'block' | 'rollback';
  };
  resource_budget?: {
    maxCpuCoreHours: number;
    maxMemoryGBHours: number;
    warningPercent: number;
    policy: 'warn' | 'block' | 'rollback';
  };
  cost_budget?: {
    maxCostCents: number;
    warningPercent: number;
    policy: 'warn' | 'block' | 'rollback';
  };
}

export interface BudgetUsage {
  time_used: number;
  time_percent: number;
  cpu_used: number;
  cpu_percent: number;
  memory_used: number;
  memory_percent: number;
  cost_used: number;
  cost_percent: number;
  alerts: BudgetAlert[];
}

export interface BudgetAlert {
  type: 'time' | 'cpu' | 'memory' | 'cost';
  level: 'warning' | 'critical';
  message: string;
  triggered_at: string;
}

export interface BudgetEstimate {
  estimatedTimeMs: number;
  estimatedCpuCores: number;
  estimatedMemoryGB: number;
  estimatedCost: number;
  confidence: number;
}

export const pipelineBudgetApi = {
  get: async (pipelineId: string) => {
    const response = await apiClient.get(`/api/v1/pipelines/${pipelineId}/budget`);
    return response.data as BudgetConfig;
  },

  set: async (pipelineId: string, config: BudgetConfig) => {
    const response = await apiClient.put(`/api/v1/pipelines/${pipelineId}/budget`, config);
    return response.data;
  },

  estimate: async (pipelineId: string, triggerType?: string) => {
    const response = await apiClient.get(`/api/v1/pipelines/${pipelineId}/budget/estimate`, {
      params: { triggerType },
    });
    return response.data as BudgetEstimate;
  },

  getUsage: async (pipelineId: string, runId: string) => {
    const response = await apiClient.get(`/api/v1/pipelines/${pipelineId}/runs/${runId}/budget-usage`);
    return response.data as BudgetUsage;
  },
};

export default pipelineBudgetApi;