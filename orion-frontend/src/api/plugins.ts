/**
 * Plugin Management API Service
 * - CRUD operations for plugins
 * - Plugin configuration management
 * - Health status checks
 */
import { api } from './client';
import type { MockPlugin } from '@/pages/__mocks__/mockPluginData';

// ============================================================================
// Types
// ============================================================================

export interface PluginListParams {
  category?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PluginListResponse {
  data: MockPlugin[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InstallPluginData {
  name: string;
  version: string;
  source: 'marketplace' | 'local';
  file?: File;
}

export interface PluginConfigUpdate {
  config: Record<string, string>;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get list of plugins with optional filters
 */
export const getPlugins = async (
  params?: PluginListParams
): Promise<PluginListResponse> => {
  const response = await api.get<PluginListResponse>('/v1/plugins', { params });
  return response.data.data as PluginListResponse;
};

/**
 * Get a single plugin by ID
 */
export const getPlugin = async (id: string): Promise<MockPlugin> => {
  const response = await api.get<MockPlugin>(`/v1/plugins/${id}`);
  return response.data.data as MockPlugin;
};

/**
 * Install a new plugin
 */
export const installPlugin = async (
  data: InstallPluginData
): Promise<MockPlugin> => {
  const response = await api.post<MockPlugin>('/v1/plugins/install', data);
  return response.data.data as MockPlugin;
};

/**
 * Update an existing plugin to the latest version
 */
export const updatePlugin = async (id: string): Promise<MockPlugin> => {
  const response = await api.put<MockPlugin>(`/v1/plugins/${id}/update`);
  return response.data.data as MockPlugin;
};

/**
 * Enable a plugin
 */
export const enablePlugin = async (id: string): Promise<MockPlugin> => {
  const response = await api.post<MockPlugin>(`/v1/plugins/${id}/enable`);
  return response.data.data as MockPlugin;
};

/**
 * Disable a plugin
 */
export const disablePlugin = async (id: string): Promise<MockPlugin> => {
  const response = await api.post<MockPlugin>(`/v1/plugins/${id}/disable`);
  return response.data.data as MockPlugin;
};

/**
 * Delete a plugin
 */
export const deletePlugin = async (id: string): Promise<void> => {
  await api.delete(`/v1/plugins/${id}`);
};

/**
 * Get plugin configuration
 */
export const getPluginConfig = async (
  id: string
): Promise<Record<string, string>> => {
  const response = await api.get<Record<string, string>>(
    `/v1/plugins/${id}/config`
  );
  return response.data.data as Record<string, string>;
};

/**
 * Update plugin configuration
 */
export const updatePluginConfig = async (
  id: string,
  config: Record<string, string>
): Promise<Record<string, string>> => {
  const response = await api.put<Record<string, string>>(
    `/v1/plugins/${id}/config`,
    { config }
  );
  return response.data.data as Record<string, string>;
};

/**
 * Get plugin health status
 */
export const getPluginHealth = async (
  id: string
): Promise<{ status: 'healthy' | 'warning' | 'error'; details: string }> => {
  const response = await api.get<{
    status: 'healthy' | 'warning' | 'error';
    details: string;
  }>(`/v1/plugins/${id}/health`);
  return response.data.data as {
    status: 'healthy' | 'warning' | 'error';
    details: string;
  };
};
