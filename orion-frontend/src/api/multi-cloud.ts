/**
 * Multi-Cloud Management API
 * Phase 4 P1 - Cloud account management, resource tracking, cross-cloud deployment
 */
import apiClient from './client';

export interface CloudAccount {
  id: string;
  tenant_id?: string;
  provider_id?: string;
  account_name: string;
  account_id: string;
  credential_type: string;
  credential_ref: string;
  region: string;
  status: 'active' | 'inactive' | 'error' | 'suspended' | 'expired';
  monthly_budget?: number;
  current_spend?: number;
  tags?: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CloudResource {
  id: string;
  tenant_id?: string;
  account_id: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string;
  region: string;
  state: string;
  spec?: Record<string, any>;
  monthly_cost?: number;
  tags?: Record<string, string>;
  discovered_at?: string;
  updated_at?: string;
}

export interface CloudProviderInfo {
  provider: string;
  availableRegions: string[];
  supportedServices: string[];
  pricing?: Record<string, number>;
}

export interface CostComparison {
  provider: string;
  region: string;
  estimatedMonthlyCost: number;
  breakdown: {
    compute: number;
    storage: number;
    bandwidth: number;
  };
}

export interface OptimizationRecommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  estimatedSavings: number;
  currency: string;
  confidence: number;
}

export interface ResourceHealth {
  totalResources: number;
  byAccount: Record<string, number>;
  byType: Record<string, number>;
  byRegion: Record<string, number>;
  totalCost: number;
  healthStatus: string;
  checkedAt: string;
}

export const multiCloudApi = {
  /**
   * 云账号管理
   */

  /**
   * 获取云账号列表
   */
  listCloudAccounts: async (params?: { provider?: string; status?: string }) => {
    const response = await apiClient.get('/v1/multi-cloud/providers', { params });
    return response.data as { success: boolean; data: CloudAccount[] };
  },

  /**
   * 获取云账号详情
   */
  getCloudAccount: async (id: string) => {
    const response = await apiClient.get(`/v1/multi-cloud/providers/${id}`);
    return response.data as { success: boolean; data: CloudAccount };
  },

  /**
   * 添加云账号
   */
  registerCloudAccount: async (data: {
    name: string;
    provider: string;
    region: string;
    credentials_ref: string;
    metadata?: Record<string, any>;
  }) => {
    const response = await apiClient.post('/v1/multi-cloud/providers', data);
    return response.data as { success: boolean; data: CloudAccount };
  },

  /**
   * 更新云账号
   */
  updateCloudAccount: async (id: string, data: Partial<{
    name: string;
    region: string;
    monthly_budget: number;
    tags: Record<string, any>;
  }>) => {
    const response = await apiClient.put(`/v1/multi-cloud/providers/${id}`, data);
    return response.data as { success: boolean; message: string; id: string };
  },

  /**
   * 删除云账号
   */
  deleteCloudAccount: async (id: string) => {
    const response = await apiClient.delete(`/v1/multi-cloud/providers/${id}`);
    return response.data as { success: boolean; message: string };
  },

  /**
   * 资源管理
   */

  /**
   * 获取资源列表
   */
  listCloudResources: async (params?: { accountId?: string; type?: string; region?: string }) => {
    const response = await apiClient.get('/v1/multi-cloud/resources', { params });
    return response.data as { success: boolean; data: CloudResource[] };
  },

  /**
   * 获取资源详情
   */
  getCloudResource: async (provider: string, id: string) => {
    const response = await apiClient.get(`/v1/multi-cloud/resources/${provider}/${id}`);
    return response.data as { success: boolean; data: CloudResource };
  },

  /**
   * 同步资源
   */
  syncResources: async (data?: { accountId?: string; provider?: string }) => {
    const response = await apiClient.post('/v1/multi-cloud/resources/sync', data);
    return response.data as { success: boolean; message: string; syncId: string };
  },

  /**
   * 成本管理
   */

  /**
   * 获取成本统计
   */
  getCostStats: async () => {
    const response = await apiClient.get('/v1/multi-cloud/costs');
    return response.data as { success: boolean; data: any };
  },

  /**
   * 获取单云成本
   */
  getCostByProvider: async (provider: string) => {
    const response = await apiClient.get(`/v1/multi-cloud/costs/${provider}`);
    return response.data as { success: boolean; data: any };
  },

  /**
   * 跨云成本对比
   */
  compareCloudCosts: async (data?: {
    vm_count?: number;
    vm_type?: string;
    storage_gb?: number;
    bandwidth_gb_month?: number;
  }) => {
    const response = await apiClient.post('/v1/multi-cloud/costs/compare', data);
    return response.data as { success: boolean; data: CostComparison[] };
  },

  /**
   * 优化建议
   */
  getRecommendations: async () => {
    const response = await apiClient.get('/v1/multi-cloud/recommendations');
    return response.data as { success: boolean; data: OptimizationRecommendation[] };
  },

  /**
   * 健康检查
   */
  getHealth: async () => {
    const response = await apiClient.get('/v1/multi-cloud/health');
    return response.data as { success: boolean; data: ResourceHealth };
  },

  /**
   * 云提供商信息
   */
  getCloudProviderInfo: async (provider: string) => {
    const response = await apiClient.get(`/v1/multi-cloud/providers/${provider}`);
    return response.data as { success: boolean; data: CloudProviderInfo };
  },
};

export default multiCloudApi;
