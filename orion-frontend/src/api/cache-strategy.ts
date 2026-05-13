/**
 * Cache Strategy API
 * Pipeline 缓存策略管理
 */
import apiClient from './client';

export type CacheType = 'npm' | 'pip' | 'maven' | 'gradle' | 'go' | 'custom';

export interface CacheStrategy {
  id: string;
  tenantId: string;
  name: string;
  type: CacheType;
  keyTemplate: string;
  paths: string[];
  restoreKeys?: string[];
  ttlDays: number;
  enabled: boolean;
  hitCount?: number;
  missCount?: number;
  totalSize?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CacheStrategyCreateInput {
  name: string;
  type: CacheType;
  keyTemplate: string;
  paths: string[];
  restoreKeys?: string[];
  ttlDays: number;
  enabled?: boolean;
}

export interface CacheStrategyUpdateInput {
  name?: string;
  keyTemplate?: string;
  paths?: string[];
  restoreKeys?: string[];
  ttlDays?: number;
  enabled?: boolean;
}

export interface CacheRecommendation {
  type: CacheType;
  name: string;
  description: string;
  keyTemplate: string;
  paths: string[];
  restoreKeys: string[];
  ttlDays: number;
}

export interface CacheStats {
  strategyId: string;
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalSize: number;
  savedTime: number; // 节省的时间（秒）
}

// Cache Strategy API
export const cacheStrategyApi = {
  // List cache strategies
  list: async (params?: {
    type?: CacheType;
    enabled?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get('/api/v1/cache-strategies', { params });
    return response.data;
  },

  // Get cache strategy by ID
  get: async (id: string) => {
    const response = await apiClient.get(`/api/v1/cache-strategies/${id}`);
    return response.data as CacheStrategy;
  },

  // Create cache strategy
  create: async (data: CacheStrategyCreateInput) => {
    const response = await apiClient.post('/api/v1/cache-strategies', data);
    return response.data as CacheStrategy;
  },

  // Update cache strategy
  update: async (id: string, data: Partial<CacheStrategyUpdateInput>) => {
    const response = await apiClient.put(`/api/v1/cache-strategies/${id}`, data);
    return response.data as CacheStrategy;
  },

  // Delete cache strategy
  delete: async (id: string) => {
    const response = await apiClient.delete(`/api/v1/cache-strategies/${id}`);
    return response.data;
  },

  // Get cache recommendation for type
  getRecommendation: async (type: CacheType) => {
    const response = await apiClient.get(`/api/v1/cache-recommendations/${type}`);
    return response.data as CacheRecommendation;
  },

  // Get all recommendations
  getAllRecommendations: async () => {
    const response = await apiClient.get('/api/v1/cache-recommendations');
    return response.data as CacheRecommendation[];
  },

  // Create from recommendation
  createFromRecommendation: async (type: CacheType, name: string) => {
    const response = await apiClient.post('/api/v1/cache-strategies/recommended', { type, name });
    return response.data as CacheStrategy;
  },

  // Get cache stats
  getStats: async (id: string) => {
    const response = await apiClient.get(`/api/v1/cache-strategies/${id}/stats`);
    return response.data as CacheStats;
  },

  // Warm cache
  warmCache: async (id: string) => {
    const response = await apiClient.post(`/api/v1/cache-strategies/${id}/warm`);
    return response.data;
  },

  // Record hit
  recordHit: async (id: string) => {
    const response = await apiClient.post(`/api/v1/cache-strategies/${id}/hit`);
    return response.data;
  },

  // Record miss
  recordMiss: async (id: string) => {
    const response = await apiClient.post(`/api/v1/cache-strategies/${id}/miss`);
    return response.data;
  },

  // Generate cache key
  generateKey: async (id: string, context: Record<string, string>) => {
    const response = await apiClient.post(`/api/v1/cache-strategies/${id}/generate-key`, { context });
    return response.data as { key: string };
  },
};

export default cacheStrategyApi;