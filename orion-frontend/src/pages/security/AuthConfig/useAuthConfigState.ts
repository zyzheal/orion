/**
 * useAuthConfigState.ts - 认证配置状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 203)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { api } from '@/api/client';
import { useQuery } from '@/providers/QueryProvider';
import type { AuthProvider, AuthPolicy, CreateProviderFormValues } from './types';

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const data = typeof options?.body === 'string' ? JSON.parse(options.body) : undefined;
  const url = `/auth${path}`;
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

export function useAuthConfigState() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<CreateProviderFormValues>();

  const { data: rawData, isLoading: loading, isError, refetch } = useQuery<{
    providers: AuthProvider[];
    policies: AuthPolicy[];
  }>({
    queryKey: ['auth-config'],
    queryFn: async () => {
      const [providersRes, policiesRes] = await Promise.all([
        apiCall<AuthProvider[]>('/providers'),
        apiCall<AuthPolicy[]>('/policies'),
      ]);
      return {
        providers: Array.isArray(providersRes) ? providersRes : [],
        policies: Array.isArray(policiesRes) ? policiesRes : [],
      };
    },
    retry: 0,
    staleTime: 30_000,
  });

  const providers = rawData?.providers ?? [];
  const policies = rawData?.policies ?? [];

  useEffect(() => {
    if (isError) {
      message.warning('认证配置数据加载失败，显示默认状态');
    }
  }, [isError]);

  const totalUsers = providers.reduce((sum, p) => sum + p.users, 0);
  const activeProviders = providers.filter((p) => p.status === 'active').length;

  const handleCreateSubmit = async () => {
    const values = await createForm.validateFields();
    setCreating(true);
    try {
      await apiCall<AuthProvider>('/providers', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success(`认证源 "${values.name}" 创建成功`);
      setCreateModalOpen(false);
      createForm.resetFields();
      refetch();
    } catch (_err: unknown) {
      message.warning('认证源创建失败，请联系管理员');
    } finally {
      setCreating(false);
    }
  };

  const closeCreate = () => {
    setCreateModalOpen(false);
    createForm.resetFields();
  };

  return {
    loading,
    providers,
    policies,
    totalUsers,
    activeProviders,
    createModalOpen,
    creating,
    createForm,
    refetch,
    setCreateModalOpen,
    handleCreateSubmit,
    closeCreate,
  };
}
