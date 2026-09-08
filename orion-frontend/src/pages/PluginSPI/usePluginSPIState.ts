/**
 * usePluginSPIState.ts - Plugin SPI 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 213)
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  getSPIStats,
  getExtensionPoints,
  getPluginRegistrations,
  getSPIConfigs,
  createRegistration,
  updatePluginConfig,
  deleteRegistration,
  toggleExtensionPoint,
  type SPIStats as APISPIStats,
  type SPIExtensionPoint as APISPIExtensionPoint,
  type PluginRegistration as APIPluginRegistration,
  type SPIConfig as APISPIConfig,
} from '@/api/plugin-spi';
import type {
  SPIExtensionPoint,
  PluginRegistration,
  SPIConfig as SPIConfigType,
  SPIStats,
} from './types';

/** Map API SPIExtensionPoint to UI shape */
function mapApiExtensionPoint(p: APISPIExtensionPoint): SPIExtensionPoint {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    spiType: p.id,
    registeredPlugins: p.registrationCount,
    status: p.enabled ? 'active' : 'inactive',
    interfaceName: p.interface,
    version: '1.0.0',
    lastUpdated: p.createdAt,
  };
}

/** Map API PluginRegistration to UI shape */
function mapApiRegistration(r: APIPluginRegistration): PluginRegistration {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = r as any;
  return {
    id: raw.id || raw.pluginName || '',
    pluginName: raw.pluginName || raw.name || '',
    spiPoint: raw.extensionPointName || raw.spiPoint || raw.capabilities?.[0] || 'Unknown',
    provider: raw.author || raw.provider || '',
    priority: raw.priority || 0,
    status: (raw.status || (raw.enabled ? 'enabled' : 'disabled')) as PluginRegistration['status'],
    version: raw.version || raw.manifest?.version || '1.0.0',
    registeredAt: raw.createdAt || raw.enabledAt || new Date().toISOString(),
  };
}

/** Map API SPIConfig to UI shape */
function mapApiSPIConfig(c: APISPIConfig): SPIConfigType {
  return {
    id: c.id,
    spiType: c.key,
    enabled: true,
    maxPlugins: 10,
    timeout: 5000,
    fallbackStrategy: 'default',
  };
}

/** Map API stats to UI stats */
function mapApiStats(s: APISPIStats): SPIStats {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = s as any;
  return {
    totalExtensionPoints: raw.totalExtensionPoints || raw.totalPlugins || 0,
    activePoints: raw.activePoints || raw.enabledPlugins || 0,
    totalRegistrations: raw.totalRegistrations || raw.totalPlugins || 0,
    enabledPlugins: raw.enabledPlugins || 0,
  };
}

export function usePluginSPIState() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [activeTab, setActiveTab] = useState<'extensions' | 'plugins' | 'config'>('extensions');
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SPIConfigType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [configForm] = Form.useForm();

  const {
    data: spiData,
    isLoading: loading,
    error: queryError,
    isError,
    refetch: loadData,
  } = useQuery<{
    extensionPoints: SPIExtensionPoint[];
    pluginRegistrations: PluginRegistration[];
    spiConfigs: SPIConfigType[];
    stats: SPIStats | null;
  }>({
    queryKey: ['plugin-spi'],
    queryFn: async () => {
      const [extRes, regRes, cfgRes, statsRes] = await Promise.all([
        getExtensionPoints(),
        getPluginRegistrations(),
        getSPIConfigs(),
        getSPIStats(),
      ]);
      const extPoints = Array.isArray(extRes)
        ? extRes
        : (extRes as { data?: { extensionPoints?: unknown[] } }).data?.extensionPoints || [];
      const regs = Array.isArray(regRes)
        ? regRes
        : (regRes as { data?: { registrations?: unknown[] } }).data?.registrations || [];
      const cfgs = Array.isArray(cfgRes)
        ? cfgRes
        : (cfgRes as { data?: { configs?: unknown[] } }).data?.configs || [];
      const statsData = ((statsRes as { stats?: unknown }).stats || statsRes || {}) as APISPIStats;
      return {
        extensionPoints: (extPoints as APISPIExtensionPoint[]).map(mapApiExtensionPoint),
        pluginRegistrations: (regs as APIPluginRegistration[]).map(mapApiRegistration),
        spiConfigs: (cfgs as APISPIConfig[]).map(mapApiSPIConfig),
        stats: mapApiStats(statsData),
      };
    },
    staleTime: 30_000,
  });

  const extensionPoints = spiData?.extensionPoints ?? [];
  const pluginRegistrations = spiData?.pluginRegistrations ?? [];
  const spiConfigs = spiData?.spiConfigs ?? [];
  const stats = spiData?.stats ?? null;

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) message.error(`加载 SPI 数据失败: ${(queryError as Error).message}`);
  }, [isError, queryError]);

  const openEditConfig = useCallback(
    (config: SPIConfigType) => {
      setEditingConfig(config);
      configForm.setFieldsValue({
        spiType: config.spiType,
        enabled: config.enabled,
        maxPlugins: config.maxPlugins,
        timeout: config.timeout,
        fallbackStrategy: config.fallbackStrategy,
      });
      setConfigModalVisible(true);
    },
    [configForm]
  );

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      setSubmitting(true);
      if (editingConfig) {
        await updatePluginConfig(editingConfig.id, {
          key: values.spiType || editingConfig.id,
          value: String(values.maxPlugins || ''),
          description: `SPI config for ${values.spiType}`,
          category: values.spiType || 'general',
          encrypted: false,
        });
        message.success('SPI 配置已更新');
      } else {
        await createRegistration({
          key: values.spiType || 'new-config',
          value: String(values.maxPlugins || ''),
          description: 'New SPI config',
          category: values.spiType || 'general',
          encrypted: false,
        } as never);
        message.success('SPI 配置已添加');
      }
      setConfigModalVisible(false);
      configForm.resetFields();
      setEditingConfig(null);
      loadData();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`保存配置失败：${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      await deleteRegistration(id);
      message.success('配置已删除');
      loadData();
    } catch (error: unknown) {
      message.error(`删除配置失败：${(error as Error).message}`);
    }
  };

  const handleTogglePlugin = async (record: PluginRegistration) => {
    const newEnabled = record.status === 'enabled' ? 'disabled' : 'enabled';
    try {
      await toggleExtensionPoint(record.id, newEnabled === 'enabled');
      message.success(
        `插件 "${record.pluginName}" 已${newEnabled === 'enabled' ? '启用' : '禁用'}`
      );
      loadData();
    } catch (error: unknown) {
      message.error(`状态更新失败：${(error as Error).message}`);
    }
  };

  const handleTabChange = (tab: 'extensions' | 'plugins' | 'config') => {
    setActiveTab(tab);
    setSearchQuery('');
    setFilters({});
  };

  return {
    // State
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    activeTab,
    setActiveTab,
    configModalVisible,
    setConfigModalVisible,
    editingConfig,
    setEditingConfig,
    submitting,
    configForm,
    extensionPoints,
    pluginRegistrations,
    spiConfigs,
    stats,
    loading,
    // Actions
    loadData,
    openEditConfig,
    handleSaveConfig,
    handleDeleteConfig,
    handleTogglePlugin,
    handleTabChange,
  };
}
