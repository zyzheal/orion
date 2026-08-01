/**
 * Canary Traffic Management API
 * Phase 3 - Traffic splitting, canary deployment promotion/rollback
 */
import apiClient from './client';

export interface CanaryDeployment {
  id: string;
  serviceName: string;
  environment: string;
  canaryVersion: string;
  baselineVersion: string;
  trafficSplit: { canary: number; baseline: number };
  status: 'active' | 'promoted' | 'rolled_back' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface TrafficSplitConfig {
  canaryWeight: number;
  baselineWeight: number;
  headers?: Record<string, string>;
}

export const canaryTrafficApi = {
  createCanaryDeployment: async (data: {
    serviceName: string;
    environment: string;
    canaryVersion: string;
    baselineVersion: string;
    initialTrafficSplit?: { canary: number; baseline: number };
  }) => {
    const response = await apiClient.post('/api/v1/canary/deployments', data);
    return response.data as CanaryDeployment;
  },

  listCanaryDeployments: async (params?: { serviceName?: string; status?: string }) => {
    const response = await apiClient.get('/api/v1/canary/deployments', { params });
    return response.data as CanaryDeployment[];
  },

  getCanaryDeployment: async (id: string) => {
    const response = await apiClient.get(`/api/v1/canary/deployments/${id}`);
    return response.data as CanaryDeployment;
  },

  configureTrafficSplit: async (id: string, data: TrafficSplitConfig) => {
    const response = await apiClient.put(`/api/v1/canary/deployments/${id}/traffic`, data);
    return response.data as CanaryDeployment;
  },

  promoteCanary: async (id: string, data?: { reason?: string }) => {
    const response = await apiClient.post(`/api/v1/canary/deployments/${id}/promote`, data);
    return response.data;
  },

  rollbackCanary: async (id: string, data?: { reason?: string }) => {
    const response = await apiClient.post(`/api/v1/canary/deployments/${id}/rollback`, data);
    return response.data;
  },
};

export default canaryTrafficApi;
