/**
 * Multi-Cloud Management API
 * Phase 4 - Cloud account management, resource tracking, cross-cloud deployment
 */
import apiClient from './client';

export interface CloudAccount {
  id: string;
  provider: 'aws' | 'azure' | 'gcp' | 'aliyun' | 'tencent';
  name: string;
  region: string;
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
}

export interface CloudResource {
  id: string;
  accountId: string;
  provider: string;
  type: string;
  name: string;
  region: string;
  status: string;
  tags?: Record<string, string>;
}

export interface CloudProviderInfo {
  provider: string;
  availableRegions: string[];
  supportedServices: string[];
  pricing?: Record<string, number>;
}

export const multiCloudApi = {
  registerCloudAccount: async (data: { provider: string; name: string; region: string; credentials: Record<string, string> }) => {
    const response = await apiClient.post('/api/v1/multi-cloud/accounts', data);
    return response.data as CloudAccount;
  },

  listCloudAccounts: async (params?: { provider?: string; status?: string }) => {
    const response = await apiClient.get('/api/v1/multi-cloud/accounts', { params });
    return response.data as CloudAccount[];
  },

  listCloudResources: async (params?: { accountId?: string; type?: string; region?: string }) => {
    const response = await apiClient.get('/api/v1/multi-cloud/resources', { params });
    return response.data as CloudResource[];
  },

  getCloudProviderInfo: async (provider: string) => {
    const response = await apiClient.get(`/api/v1/multi-cloud/providers/${provider}`);
    return response.data as CloudProviderInfo;
  },

  deployToProvider: async (provider: string, data: { serviceName: string; config: Record<string, unknown> }) => {
    const response = await apiClient.post(`/api/v1/multi-cloud/providers/${provider}/deploy`, data);
    return response.data;
  },
};

export default multiCloudApi;
