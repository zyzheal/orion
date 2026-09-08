/**
 * DeploymentList state hook
 * 抽取自 index.tsx (P2-9 Phase 198)
 */
import { useState, useMemo, useEffect } from 'react';
import { message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import { getDeployments } from '@/api/deployments';
import type { DeploymentRecord } from './types';

export const useDeploymentListState = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});

  const {
    data: rawDeployments,
    isLoading: loading,
    isError,
    error,
    refetch: loadDeployments,
  } = useQuery<DeploymentRecord[]>({
    queryKey: ['deployments'],
    queryFn: async () => {
      const response = await getDeployments();
      const apiData = response.data;
      return Array.isArray(apiData) ? apiData : (apiData as { items?: DeploymentRecord[] })?.items || [];
    },
    staleTime: 30_000,
  });

  const deployments = rawDeployments ?? [];

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  useEffect(() => {
    if (!isError) return;
    if (error instanceof Error) {
      message.error(`加载部署列表失败：${error.message}`);
    } else {
      message.error('加载部署列表失败，请稍后重试');
    }
  }, [isError, error]);

  const filteredDeployments = useMemo(() => {
    return deployments.filter((deployment) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          deployment.appName,
          deployment.version,
          deployment.triggeredBy,
          deployment.commit || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && deployment.status !== statusFilter) {
        return false;
      }
      const envFilter = filters.environment;
      if (envFilter && deployment.environment !== envFilter) {
        return false;
      }
      return true;
    });
  }, [searchQuery, filters, deployments]);

  const handleRefresh = () => {
    loadDeployments();
  };

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    loading,
    deployments,
    filteredDeployments,
    loadDeployments,
    handleRefresh,
  };
};
