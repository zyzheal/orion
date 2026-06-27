/**
 * HookChain API Service
 * Auto-generated from backend hook-chain-routes.ts
 * Prefix: /v1/hook-chains
 */
import { api } from './client';

export interface HookChain {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createHookChainHookChains = async (data?: Partial<HookChain>): Promise<HookChain> => {
  const response = await api.post<HookChain>('/v1/hook-chains/hook-chains', data);
  return response.data;
};

export const listHookChain = async (params?: Record<string, unknown>): Promise<{ data: HookChain[]; total: number }> => {
  const response = await api.get<{ data: HookChain[]; total: number }>('/v1/hook-chains/hook-chains', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getHookChain = async (chainId: string): Promise<HookChain> => {
  const response = await api.get<HookChain>('/v1/hook-chains/hook-chains/' + chainId);
  return response.data;
};

export const updateHookChain = async (chainId: string, data: Partial<HookChain>): Promise<HookChain> => {
  const response = await api.put<HookChain>('/v1/hook-chains/hook-chains/' + chainId, data);
  return response.data;
};

export const deleteHookChain = async (chainId: string): Promise<void> => {
  await api.delete('/v1/hook-chains/hook-chains/' + chainId);
};

export const createHookChainHookChainsExecute = async (chainId: string, data?: Partial<HookChain>): Promise<HookChain> => {
  const response = await api.post<HookChain>('/v1/hook-chains/hook-chains/' + chainId + '/execute', data);
  return response.data;
};

export const createHookChainHookChainsExecutors = async (data?: Partial<HookChain>): Promise<HookChain> => {
  const response = await api.post<HookChain>('/v1/hook-chains/hook-chains/executors', data);
  return response.data;
};
