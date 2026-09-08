/**
 * workspaceApi.ts - Workspace 页面 API 封装
 * 抽取自 index.tsx (P2-9 Phase 221)
 */
import { api } from '@/api/client';

export interface Workspace {
  id: string;
  name: string;
  description: string;
  clusterId: string;
  status: 'active' | 'disabled';
  cpuQuota: number;
  cpuUsed: number;
  memoryQuota: number;
  memoryUsed: number;
  storageQuota: number;
  storageUsed: number;
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceUpsertPayload {
  id?: string;
  name: string;
  description: string;
  clusterId: string;
  cpuQuota: number;
  memoryQuota: number;
  storageQuota: number;
}

// 委托 axios 实例（src/api/client.ts）：请求拦截器注入 authStore token 并支持
// 401 自动刷新重放，响应拦截器统一解包 { success, data }，另带重试与请求取消注册。
export async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const data = typeof options?.body === 'string' ? JSON.parse(options.body) : undefined;
  const url = `/workspaces${path}`;
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
        (ax.response ? `HTTP ${ax.response.status}` : '网络请求失败')
    );
  }
}
