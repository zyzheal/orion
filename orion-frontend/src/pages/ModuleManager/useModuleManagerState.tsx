/**
 * useModuleManagerState - 模块管理页面状态 hook
 * 抽取自 index.tsx (P2-9 Phase 117)
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  getModules,
  toggleModule,
  validateDependencies,
  getStartupOrder,
  type ModuleDescriptor,
  type DependencyValidationResult,
} from '@/api/module-manager';

export const useModuleManagerState = () => {
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState<ModuleDescriptor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [validationResult, setValidationResult] = useState<DependencyValidationResult | null>(null);
  const [startupOrder, setStartupOrder] = useState<string[]>([]);
  const [validationLoading, setValidationLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('list');

  const loadModules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getModules();
      setModules(response.data || []);
    } catch (error: unknown) {
      message.error(`加载模块列表失败: ${(error as Error).message}`);
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadValidation = useCallback(async () => {
    setValidationLoading(true);
    try {
      const [validationRes, orderRes] = await Promise.all([
        validateDependencies(),
        getStartupOrder(),
      ]);
      setValidationResult(validationRes.data?.validation || null);
      setStartupOrder(orderRes.data?.order || []);
    } catch (error: unknown) {
      message.error(`加载校验数据失败: ${(error as Error).message}`);
    } finally {
      setValidationLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadModules(), loadValidation()]);
  }, [loadModules, loadValidation]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredModules = useMemo(() => {
    return modules.filter((mod) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [mod.id, mod.name, mod.description, mod.domain]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (levelFilter !== 'all' && mod.level !== levelFilter) return false;
      if (statusFilter !== 'all' && mod.state !== statusFilter) return false;
      return true;
    });
  }, [modules, searchQuery, levelFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = modules.length;
    const active = modules.filter((m) => m.state === 'active').length;
    const enabled = modules.filter((m) => m.config.enabled).length;
    const failed = modules.filter((m) => m.state === 'failed').length;
    return { total, active, enabled, failed };
  }, [modules]);

  const handleToggleModule = async (module: ModuleDescriptor, newEnabled: boolean) => {
    if (module.level === 'core' && !newEnabled) {
      message.warning('核心模块不能被禁用');
      return;
    }

    setToggleLoading((prev) => ({ ...prev, [module.id]: true }));
    try {
      await toggleModule(module.id, newEnabled);
      message.success(`模块 "${module.name}" 已${newEnabled ? '启用' : '禁用'}`);
      setModules((prev) =>
        prev.map((m) =>
          m.id === module.id ? { ...m, config: { ...m.config, enabled: newEnabled } } : m
        )
      );
      await loadValidation();
    } catch (error: unknown) {
      const err = error as Error;
      message.error(`操作失败: ${err.message}`);
    } finally {
      setToggleLoading((prev) => ({ ...prev, [module.id]: false }));
    }
  };

  return {
    loading,
    modules,
    searchQuery, setSearchQuery,
    levelFilter, setLevelFilter,
    statusFilter, setStatusFilter,
    validationResult,
    startupOrder,
    validationLoading,
    toggleLoading,
    activeTab, setActiveTab,
    loadModules, loadValidation, loadAll,
    filteredModules, stats,
    handleToggleModule,
  };
};

export type ModuleManagerState = ReturnType<typeof useModuleManagerState>;
