/**
 * ApiMarket API Service
 * Auto-generated from backend api-market-routes.ts
 * Prefix: /v1/market
 */
import { api } from './client';

export interface ApiMarket {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createApiMarketMarketProducts = async (data?: Partial<ApiMarket>): Promise<ApiMarket> => {
  const response = await api.post<ApiMarket>('/v1/market/market/products', data);
  return response.data;
};

export const listApiMarket = async (params?: Record<string, unknown>): Promise<{ data: ApiMarket[]; total: number }> => {
  const response = await api.get<{ data: ApiMarket[]; total: number }>('/v1/market/market/products', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getApiMarket = async (id: string): Promise<ApiMarket> => {
  const response = await api.get<ApiMarket>('/v1/market/market/products/' + id);
  return response.data;
};

export const createApiMarketMarketProductsPublish = async (id: string, data?: Partial<ApiMarket>): Promise<ApiMarket> => {
  const response = await api.post<ApiMarket>('/v1/market/market/products/' + id + '/publish', data);
  return response.data;
};

export const deleteApiMarket = async (id: string): Promise<void> => {
  await api.delete('/v1/market/market/products/' + id);
};

export const createApiMarketMarketApps = async (data?: Partial<ApiMarket>): Promise<ApiMarket> => {
  const response = await api.post<ApiMarket>('/v1/market/market/apps', data);
  return response.data;
};

export const createApiMarketMarketAppsKeys = async (appId: string, data?: Partial<ApiMarket>): Promise<ApiMarket> => {
  const response = await api.post<ApiMarket>('/v1/market/market/apps/' + appId + '/keys', data);
  return response.data;
};

export const getApiMarketMarketAppsKeys = async (appId: string): Promise<ApiMarket> => {
  const response = await api.get<ApiMarket>('/v1/market/market/apps/' + appId + '/keys');
  return response.data;
};

export const createApiMarketMarketAuthToken = async (data?: Partial<ApiMarket>): Promise<ApiMarket> => {
  const response = await api.post<ApiMarket>('/v1/market/market/auth/token', data);
  return response.data;
};

export const createApiMarketMarketSubscriptions = async (data?: Partial<ApiMarket>): Promise<ApiMarket> => {
  const response = await api.post<ApiMarket>('/v1/market/market/subscriptions', data);
  return response.data;
};
