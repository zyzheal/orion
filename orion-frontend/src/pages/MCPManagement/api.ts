/**
 * MCP Management API wrapper
 * 抽取自 index.tsx (P2-9 Phase 147)
 *
 * 委托 axios 实例（src/api/client.ts）：请求拦截器注入 authStore token 并支持
 * 401 自动刷新重放，响应拦截器统一解包 { success, data }，另带重试与请求取消注册。
 * 保留原有 fetch 风格签名与"失败抛出 Error(message)"语义，调用方 catch 无需修改。
 */
import { api } from '@/api/client';
import type {
  MCPService,
  MCPServiceFormValues,
  ListServersResponse,
  ListToolsResponse,
} from './types';

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const data = typeof options?.body === 'string' ? JSON.parse(options.body) : undefined;
  const url = `/mcp${path}`;
  try {
    const resp =
      method === 'POST'
        ? await api.post<unknown>(url, data)
        : method === 'PUT'
          ? await api.put<unknown>(url, data)
          : method === 'PATCH'
            ? await api.patch<unknown>(url, data)
            : method === 'DELETE'
              ? await api.delete<unknown>(url)
              : await api.get<unknown>(url);
    return resp.data as T;
  } catch (err) {
    const ax = err as {
      message?: string;
      response?: { status: number; data?: { error?: string; message?: string; Message?: string } };
    };
    const body = ax.response?.data;
    throw new Error(
      body?.error ||
        body?.message ||
        body?.Message ||
        ax.message ||
        (ax.response ? `HTTP ${ax.response.status}` : '网络请求失败'),
    );
  }
}

export const mcpApi = {
  listServers: () => apiCall<ListServersResponse>('/servers'),
  createServer: (values: MCPServiceFormValues) =>
    apiCall<MCPService>('/servers', { method: 'POST', body: JSON.stringify(values) }),
  updateServer: (id: string, values: Partial<MCPServiceFormValues>) =>
    apiCall<MCPService>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(values) }),
  deleteServer: (id: string) => apiCall<void>(`/servers/${id}`, { method: 'DELETE' }),
  listTools: (serverId: string) =>
    apiCall<ListToolsResponse>(`/tools?server_id=${serverId}`),
};
