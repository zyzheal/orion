/**
 * ProductLine API Service
 * Auto-generated from backend product-line-routes.ts
 * Prefix: /v1/product-lines
 */
import { api } from './client';

export interface ProductLine {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createProductLine = async (data?: Partial<ProductLine>): Promise<ProductLine> => {
  const response = await api.post<ProductLine>('/v1/product-lines/', data);
  return response.data;
};

export const listProductLine = async (params?: Record<string, unknown>): Promise<{ data: ProductLine[]; total: number }> => {
  const response = await api.get<{ data: ProductLine[]; total: number }>('/v1/product-lines/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getProductLine = async (id: string): Promise<ProductLine> => {
  const response = await api.get<ProductLine>('/v1/product-lines/' + id);
  return response.data;
};

export const updateProductLine = async (id: string, data: Partial<ProductLine>): Promise<ProductLine> => {
  const response = await api.put<ProductLine>('/v1/product-lines/' + id, data);
  return response.data;
};

export const deleteProductLine = async (id: string): Promise<void> => {
  await api.delete('/v1/product-lines/' + id);
};

export const createProductLineActivate = async (id: string, data?: Partial<ProductLine>): Promise<ProductLine> => {
  const response = await api.post<ProductLine>('/v1/product-lines/' + id + '/activate', data);
  return response.data;
};

export const createProductLineSuspend = async (id: string, data?: Partial<ProductLine>): Promise<ProductLine> => {
  const response = await api.post<ProductLine>('/v1/product-lines/' + id + '/suspend', data);
  return response.data;
};

export const createProductLineReleaseTrains = async (id: string, data?: Partial<ProductLine>): Promise<ProductLine> => {
  const response = await api.post<ProductLine>('/v1/product-lines/' + id + '/release-trains', data);
  return response.data;
};

export const createProductLineHotfixChannels = async (id: string, data?: Partial<ProductLine>): Promise<ProductLine> => {
  const response = await api.post<ProductLine>('/v1/product-lines/' + id + '/hotfix-channels', data);
  return response.data;
};
