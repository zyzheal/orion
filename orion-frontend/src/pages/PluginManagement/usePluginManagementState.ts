/**
 * usePluginManagementState.ts - PluginManagement 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 249)
 */
import { useState, useEffect } from 'react';
import { message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  getInstalledPlugins,
  getPlugin,
  configurePlugin,
  type PluginExecutionResult,
} from '@/api/plugins';
import { type ApiPlugin, type PluginConfig } from './types';

export function usePluginManagementState() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<ApiPlugin | null>(null);

  const {
    data: plugins = [] as ApiPlugin[],
    isLoading: loading,
    isError,
    error,
    refetch: reloadPlugins,
  } = useQuery<ApiPlugin[]>({
    queryKey: ['plugins', 'installed'],
    queryFn: async () => {
      const response = await getInstalledPlugins({});
      return (response.data || []) as unknown as ApiPlugin[];
    },
    staleTime: 30_000,
  });

  // 加载失败反馈
  useEffect(() => {
    if (!isError) return;
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
      message.error('权限不足，请重新登录或联系管理员');
    } else if (error instanceof Error) {
      message.error(`加载插件列表失败：${error.message}`);
    } else {
      message.error('加载插件列表失败，请稍后重试');
    }
  }, [isError, error]);

  const handleConfigure = async (plugin: ApiPlugin) => {
    setSelectedPlugin(plugin);
    setDetailDrawerOpen(true);
    try {
      const response = await getPlugin(plugin.id);
      setSelectedPlugin(response.data as unknown as ApiPlugin);
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(`加载插件详情失败：${err.message}`);
      } else {
        message.error('加载插件详情失败，请稍后重试');
      }
    }
  };

  const handleExecuteTask = (plugin: ApiPlugin) => {
    setSelectedPlugin(plugin);
    setExecuteModalOpen(true);
  };

  const handleExecuteSuccess = (result: PluginExecutionResult) => {
    setExecuteModalOpen(false);
    setSelectedPlugin(null);
    message.success(`任务执行完成：${result.status}`);
  };

  const handleSaveConfig = async (config: PluginConfig) => {
    if (!selectedPlugin) return;
    try {
      await configurePlugin(selectedPlugin.id, { config });
      message.success('配置保存成功');
      const response = await getPlugin(selectedPlugin.id);
      setSelectedPlugin(response.data as unknown as ApiPlugin);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存配置失败';
      message.error(`保存配置失败：${msg}`);
    }
  };

  const handleInstallSuccess = () => {
    setInstallModalOpen(false);
    reloadPlugins();
  };

  return {
    plugins,
    loading,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    installModalOpen,
    setInstallModalOpen,
    detailDrawerOpen,
    setDetailDrawerOpen,
    executeModalOpen,
    setExecuteModalOpen,
    selectedPlugin,
    setSelectedPlugin,
    reloadPlugins,
    handleConfigure,
    handleExecuteTask,
    handleExecuteSuccess,
    handleSaveConfig,
    handleInstallSuccess,
  };
}
