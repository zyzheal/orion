/**
 * ChaosEnhanced API Service
 * Auto-generated from backend chaos-enhanced-routes.ts
 * Prefix: /api/v1/chaos
 */
import { api } from './client';

export interface ChaosEnhanced {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createChaosEnhancedExperiments = async (data?: Partial<ChaosEnhanced>): Promise<ChaosEnhanced> => {
  const response = await api.post<ChaosEnhanced>('/api/v1/chaos/experiments', data);
  return response.data;
};

export const listChaosEnhanced = async (params?: Record<string, unknown>): Promise<{ data: ChaosEnhanced[]; total: number }> => {
  const response = await api.get<{ data: ChaosEnhanced[]; total: number }>('/api/v1/chaos/experiments', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getChaosEnhanced = async (id: string): Promise<ChaosEnhanced> => {
  const response = await api.get<ChaosEnhanced>('/api/v1/chaos/experiments/' + id);
  return response.data;
};

export const createChaosEnhancedExperimentsRun = async (id: string, data?: Partial<ChaosEnhanced>): Promise<ChaosEnhanced> => {
  const response = await api.post<ChaosEnhanced>('/api/v1/chaos/experiments/' + id + '/run', data);
  return response.data;
};

export const createChaosEnhancedExperimentsInject = async (id: string, data?: Partial<ChaosEnhanced>): Promise<ChaosEnhanced> => {
  const response = await api.post<ChaosEnhanced>('/api/v1/chaos/experiments/' + id + '/inject', data);
  return response.data;
};

export const createChaosEnhancedExperimentsStop = async (id: string, data?: Partial<ChaosEnhanced>): Promise<ChaosEnhanced> => {
  const response = await api.post<ChaosEnhanced>('/api/v1/chaos/experiments/' + id + '/stop', data);
  return response.data;
};

export const createChaosEnhancedFaultsConfigTemplate = async (type: string, data?: Partial<ChaosEnhanced>): Promise<ChaosEnhanced> => {
  const response = await api.post<ChaosEnhanced>('/api/v1/chaos/faults/' + type + '/config-template', data);
  return response.data;
};
