/**
 * Console state hook
 * 抽取自 index.tsx (P2-9 Phase 196)
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { getInstalledPlugins } from '@/api/plugins';
import { getFeatureFlags } from '@/api/feature-flags';

export interface ConsoleStats {
  totalPlugins: number;
  activePlugins: number;
  totalFlags: number;
  enabledFlags: number;
}

const DEFAULT_STATS: ConsoleStats = {
  totalPlugins: 0,
  activePlugins: 0,
  totalFlags: 0,
  enabledFlags: 0,
};

const FALLBACK_STATS: ConsoleStats = {
  totalPlugins: 5,
  activePlugins: 3,
  totalFlags: 8,
  enabledFlags: 6,
};

export const useConsoleState = () => {
  const [stats, setStats] = useState<ConsoleStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pluginsRes, flagsRes] = await Promise.all([getInstalledPlugins(), getFeatureFlags()]);
      const plugins = pluginsRes.data || [];
      const flags = flagsRes.data || [];
      setStats({
        totalPlugins: (plugins as any).length,
        activePlugins: (plugins as any).filter((p: any) => p.status === 'enabled').length,
        totalFlags: flags.length,
        enabledFlags: flags.filter((f: any) => f.enabled).length,
      });
    } catch (err) {
      console.error('加载控制台数据失败:', err);
      setError('部分数据加载失败，使用演示数据');
      setStats(FALLBACK_STATS);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleRefresh = () => {
    setInitialLoading(true);
    loadStats();
    message.info('正在刷新数据...');
  };

  return { stats, loading, initialLoading, error, loadStats, handleRefresh };
};
