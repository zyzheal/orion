/**
 * Config Management Enhanced API
 * Phase 3 - Change requests, drift detection, remediation
 */
import apiClient from './client';

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  changes: ConfigChange[];
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'rolled_back';
  requestedBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigChange {
  path: string;
  operation: 'add' | 'update' | 'delete';
  oldValue?: unknown;
  newValue?: unknown;
}

export interface DriftDetectionResult {
  id: string;
  detectedAt: string;
  drifts: { path: string; expected: unknown; actual: unknown; severity: string }[];
  totalDrifts: number;
}

export interface DriftRemediation {
  id: string;
  driftId: string;
  status: 'pending' | 'remediating' | 'completed' | 'failed';
  remediatedAt?: string;
}

export const configMgmtApi = {
  createChangeRequest: async (data: {
    title: string;
    description: string;
    changes: ConfigChange[];
  }) => {
    const response = await apiClient.post('/api/v1/config-mgmt/change-requests', data);
    return response.data as ChangeRequest;
  },

  listChangeRequests: async (params?: { status?: string; requestedBy?: string }) => {
    const response = await apiClient.get('/api/v1/config-mgmt/change-requests', { params });
    return response.data as ChangeRequest[];
  },

  getChangeRequest: async (id: string) => {
    const response = await apiClient.get(`/api/v1/config-mgmt/change-requests/${id}`);
    return response.data as ChangeRequest;
  },

  approveChangeRequest: async (id: string, data: { decision: 'approved' | 'rejected'; comment?: string }) => {
    const response = await apiClient.post(`/api/v1/config-mgmt/change-requests/${id}/approve`, data);
    return response.data as ChangeRequest;
  },

  executeChangeRequest: async (id: string) => {
    const response = await apiClient.post(`/api/v1/config-mgmt/change-requests/${id}/execute`);
    return response.data as ChangeRequest;
  },

  rollbackChangeRequest: async (id: string) => {
    const response = await apiClient.post(`/api/v1/config-mgmt/change-requests/${id}/rollback`);
    return response.data as ChangeRequest;
  },

  getChangeHistory: async (id: string) => {
    const response = await apiClient.get(`/api/v1/config-mgmt/change-requests/${id}/history`);
    return response.data;
  },

  detectDrift: async (data?: { scope?: string }) => {
    const response = await apiClient.post('/api/v1/config-mgmt/drift-detect', data);
    return response.data as DriftDetectionResult;
  },

  remediateDrift: async (driftId: string) => {
    const response = await apiClient.post(`/api/v1/config-mgmt/drift/${driftId}/remediate`);
    return response.data as DriftRemediation;
  },

  getDriftReport: async () => {
    const response = await apiClient.get('/api/v1/config-mgmt/drift-report');
    return response.data;
  },
};

export default configMgmtApi;
