/**
 * Plugin API Service
 * Auto-generated from backend plugin-routes.ts
 * Prefix: /api/plugins
 */
import { api } from './client';

export interface Plugin {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listPlugin = async (params?: Record<string, unknown>): Promise<{ data: Plugin[]; total: number }> => {
  const response = await api.get<{ data: Plugin[]; total: number }>('/api/plugins/healthz', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getPlugin = async (pluginId: string): Promise<Plugin> => {
  const response = await api.get<Plugin>('/api/plugins/' + pluginId);
  return response.data;
};

export const createPluginInstall = async (pluginId: string, data?: Partial<Plugin>): Promise<Plugin> => {
  const response = await api.post<Plugin>('/api/plugins/' + pluginId + '/install', data);
  return response.data;
};

export const createPluginEnable = async (pluginId: string, data?: Partial<Plugin>): Promise<Plugin> => {
  const response = await api.post<Plugin>('/api/plugins/' + pluginId + '/enable', data);
  return response.data;
};

export const createPluginDisable = async (pluginId: string, data?: Partial<Plugin>): Promise<Plugin> => {
  const response = await api.post<Plugin>('/api/plugins/' + pluginId + '/disable', data);
  return response.data;
};

export const deletePlugin = async (pluginId: string): Promise<void> => {
  await api.delete('/api/plugins/' + pluginId);
};

export const createPluginDebugPause = async (runId: string, data?: Partial<Plugin>): Promise<Plugin> => {
  const response = await api.post<Plugin>('/api/plugins/' + runId + '/debug/pause', data);
  return response.data;
};

export const createPluginDebugResume = async (runId: string, data?: Partial<Plugin>): Promise<Plugin> => {
  const response = await api.post<Plugin>('/api/plugins/' + runId + '/debug/resume', data);
  return response.data;
};

export const createPluginDebugStep = async (runId: string, data?: Partial<Plugin>): Promise<Plugin> => {
  const response = await api.post<Plugin>('/api/plugins/' + runId + '/debug/step', data);
  return response.data;
};

export const createPluginAiDiagnose = async (data?: Partial<Plugin>): Promise<Plugin> => {
  const response = await api.post<Plugin>('/api/plugins/ai-diagnose', data);
  return response.data;
};
