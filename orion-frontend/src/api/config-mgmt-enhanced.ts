/**
 * ConfigMgmtEnhanced API Service
 * Auto-generated from backend config-mgmt-enhanced-routes.ts
 * Prefix: /v1/config-mgmt
 */
import { api } from './client';

export interface ConfigMgmtEnhanced {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createConfigMgmtEnhancedV1ConfigMgmtChangeRequests = async (data?: Partial<ConfigMgmtEnhanced>): Promise<ConfigMgmtEnhanced> => {
  const response = await api.post<ConfigMgmtEnhanced>('/v1/config-mgmt/v1/config-mgmt/change-requests', data);
  return response.data;
};

export const listConfigMgmtEnhanced = async (params?: Record<string, unknown>): Promise<{ data: ConfigMgmtEnhanced[]; total: number }> => {
  const response = await api.get<{ data: ConfigMgmtEnhanced[]; total: number }>('/v1/config-mgmt/v1/config-mgmt/change-requests', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getConfigMgmtEnhancedV1ConfigMgmtChangeRequests = async (id: string): Promise<ConfigMgmtEnhanced> => {
  const response = await api.get<ConfigMgmtEnhanced>('/v1/config-mgmt/v1/config-mgmt/change-requests/' + id);
  return response.data;
};

export const createConfigMgmtEnhancedV1ConfigMgmtChangeRequestsApprove = async (id: string, data?: Partial<ConfigMgmtEnhanced>): Promise<ConfigMgmtEnhanced> => {
  const response = await api.post<ConfigMgmtEnhanced>('/v1/config-mgmt/v1/config-mgmt/change-requests/' + id + '/approve', data);
  return response.data;
};

export const createConfigMgmtEnhancedV1ConfigMgmtChangeRequestsExecute = async (id: string, data?: Partial<ConfigMgmtEnhanced>): Promise<ConfigMgmtEnhanced> => {
  const response = await api.post<ConfigMgmtEnhanced>('/v1/config-mgmt/v1/config-mgmt/change-requests/' + id + '/execute', data);
  return response.data;
};

export const createConfigMgmtEnhancedV1ConfigMgmtChangeRequestsRollback = async (id: string, data?: Partial<ConfigMgmtEnhanced>): Promise<ConfigMgmtEnhanced> => {
  const response = await api.post<ConfigMgmtEnhanced>('/v1/config-mgmt/v1/config-mgmt/change-requests/' + id + '/rollback', data);
  return response.data;
};

export const getConfigMgmtEnhancedV1ConfigMgmtChangeRequestsHistory = async (id: string): Promise<ConfigMgmtEnhanced> => {
  const response = await api.get<ConfigMgmtEnhanced>('/v1/config-mgmt/v1/config-mgmt/change-requests/' + id + '/history');
  return response.data;
};

export const createConfigMgmtEnhancedV1ConfigMgmtDriftDetect = async (data?: Partial<ConfigMgmtEnhanced>): Promise<ConfigMgmtEnhanced> => {
  const response = await api.post<ConfigMgmtEnhanced>('/v1/config-mgmt/v1/config-mgmt/drift-detect', data);
  return response.data;
};

export const createConfigMgmtEnhancedV1ConfigMgmtDriftRemediate = async (id: string, data?: Partial<ConfigMgmtEnhanced>): Promise<ConfigMgmtEnhanced> => {
  const response = await api.post<ConfigMgmtEnhanced>('/v1/config-mgmt/v1/config-mgmt/drift/' + id + '/remediate', data);
  return response.data;
};
