/**
 * PluginHotreload API Service
 * Auto-generated from backend plugin-hotreload-routes.ts
 * Prefix: /api/v1/plugins
 */
import { api } from './client';

export interface PluginHotreload {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createPluginHotreloadPluginsHotreload = async (pluginId: string, data?: Partial<PluginHotreload>): Promise<PluginHotreload> => {
  const response = await api.post<PluginHotreload>('/api/v1/plugins/plugins/hotreload/' + pluginId, data);
  return response.data;
};

export const createPluginHotreloadPluginsHotreloadRollback = async (pluginId: string, data?: Partial<PluginHotreload>): Promise<PluginHotreload> => {
  const response = await api.post<PluginHotreload>('/api/v1/plugins/plugins/hotreload/' + pluginId + '/rollback', data);
  return response.data;
};

export const getPluginHotreloadPluginsHotreloadHistory = async (pluginId: string): Promise<PluginHotreload> => {
  const response = await api.get<PluginHotreload>('/api/v1/plugins/plugins/hotreload/' + pluginId + '/history');
  return response.data;
};

export const createPluginHotreloadPluginsHotreloadWatchStart = async (data?: Partial<PluginHotreload>): Promise<PluginHotreload> => {
  const response = await api.post<PluginHotreload>('/api/v1/plugins/plugins/hotreload/watch/start', data);
  return response.data;
};

export const createPluginHotreloadPluginsHotreloadWatchStop = async (data?: Partial<PluginHotreload>): Promise<PluginHotreload> => {
  const response = await api.post<PluginHotreload>('/api/v1/plugins/plugins/hotreload/watch/stop', data);
  return response.data;
};

export const listPluginHotreload = async (params?: Record<string, unknown>): Promise<{ data: PluginHotreload[]; total: number }> => {
  const response = await api.get<{ data: PluginHotreload[]; total: number }>('/api/v1/plugins/plugins/hotreload/stats', { params });
  return { data: response.data.data, total: response.data.total };
};
