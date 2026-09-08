/**
 * useApiKeyManagementState.ts - API Key 管理状态 Hook
 * 抽取自 index.tsx (P2-9 Phase 204)
 */
import { useState } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  getApiKeys,
  createApiKey,
  revokeApiKey,
  getApiKeyStats,
  type ApiKey,
  type ApiKeyInput,
} from '@/api/api-key';
import type { ApiKeyDashboardData } from './types';

export function useApiKeyManagementState() {
  const [modalVisible, setModalVisible] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [form] = Form.useForm();

  const {
    data: dashboard,
    isLoading,
    isError,
    error,
    refetch: loadData,
  } = useQuery<ApiKeyDashboardData>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const [keysRes, statsRes] = await Promise.all([getApiKeys(), getApiKeyStats()]);
      return {
        keys: ((keysRes.data as { keys?: ApiKey[] })?.keys ?? []) as ApiKey[],
        stats: (statsRes.data as { stats?: ApiKeyDashboardData['stats'] })?.stats ?? null,
      };
    },
    staleTime: 30_000,
    retry: 0,
  });

  const keys = dashboard?.keys ?? [];
  const stats = dashboard?.stats ?? null;

  const handleCreate = async (values: ApiKeyInput) => {
    try {
      const res = await createApiKey(values);
      const newKey = ((res.data as { key?: { key?: string } })?.key?.key ?? '') as string;
      setCreatedKey(newKey);
      message.success('API Key 已创建，请妥善保存');
      form.resetFields();
      loadData();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeApiKey(id);
      message.success('API Key 已撤销');
      loadData();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '撤销失败');
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    message.success('已复制到剪贴板');
  };

  const openCreate = () => {
    setCreatedKey(null);
    setModalVisible(true);
  };

  return {
    isLoading,
    isError,
    error,
    keys,
    stats,
    modalVisible,
    setModalVisible,
    createdKey,
    form,
    loadData,
    handleCreate,
    handleRevoke,
    copyKey,
    openCreate,
  };
}
