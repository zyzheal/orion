/**
 * useEphemeralEnvState.ts - EphemeralEnvList 状态 Hook
 * 抽取自 EphemeralEnvList/index.tsx (P2-9 Phase 69)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  getEphemeralEnvs,
  wakeEphemeralEnv,
  teardownEphemeralEnv,
} from '@/api/ephemeral-envs';
import type { EphemeralEnvironment } from '@/api/ephemeral-envs';
import { STATUS_FILTER_DEF, REPO_FILTER_BASE } from './constants';
import type { EnvSummary } from './types';
import type { FilterDefinition } from '@/components/SearchFilterBar';

export const useEphemeralEnvState = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [envs, setEnvs] = useState<EphemeralEnvironment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [costDrawerOpen, setCostDrawerOpen] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<EphemeralEnvironment | null>(null);

  // ---- Data Loading ----

  const loadEnvs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getEphemeralEnvs({});
      setEnvs(response.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载环境列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEnvs();
  }, [loadEnvs]);

  // ---- Filtering ----

  const filteredEnvs = useMemo(() => {
    return envs.filter((env) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [env.prId, env.repoId, env.branchName, env.namespace, env.commitSha]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && env.status !== statusFilter) return false;

      const repoFilter = filters.repo;
      if (repoFilter && repoFilter !== 'all' && env.repoId !== repoFilter) return false;

      return true;
    });
  }, [searchQuery, filters, envs]);

  // ---- Unique repos for filter ----

  const uniqueRepos = useMemo(() => {
    const repos = [...new Set(envs.map((e) => e.repoId))];
    return repos.map((r) => ({ label: r, value: r }));
  }, [envs]);

  const filterDefs = useMemo<FilterDefinition[]>(
    () => [
      STATUS_FILTER_DEF,
      { ...REPO_FILTER_BASE, options: [{ label: '全部', value: 'all' }, ...uniqueRepos] },
    ],
    [uniqueRepos],
  );

  // ---- Summary metrics ----

  const summary: EnvSummary = useMemo(() => ({
    totalCount: envs.length,
    runningCount: envs.filter((e) => e.status === 'running').length,
    idleCount: envs.filter((e) => e.status === 'idle').length,
    activeCount: envs.filter((e) => ['provisioning', 'running'].includes(e.status)).length,
  }), [envs]);

  // ---- Actions ----

  const handleViewDetail = useCallback(
    (env: EphemeralEnvironment) => {
      navigate(`/ephemeral-envs/${env.id}`);
    },
    [navigate],
  );

  const handleOpenPreview = useCallback((env: EphemeralEnvironment) => {
    if (env.previewUrl) {
      window.open(env.previewUrl, '_blank');
    } else {
      message.warning('该环境暂无 Preview URL');
    }
  }, []);

  const handleWake = useCallback(
    async (env: EphemeralEnvironment) => {
      try {
        await wakeEphemeralEnv(env.id);
        message.success('环境已唤醒');
        await loadEnvs();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '唤醒失败';
        message.error(`唤醒失败：${msg}`);
      }
    },
    [loadEnvs],
  );

  const handleTeardown = useCallback(
    async (env: EphemeralEnvironment) => {
      try {
        await teardownEphemeralEnv(env.id);
        message.success('环境销毁已触发');
        await loadEnvs();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '销毁失败';
        message.error(`销毁失败：${msg}`);
      }
    },
    [loadEnvs],
  );

  const handleViewCost = useCallback((env: EphemeralEnvironment) => {
    setSelectedEnv(env);
    setCostDrawerOpen(true);
  }, []);

  const closeCostDrawer = useCallback(() => {
    setCostDrawerOpen(false);
    setSelectedEnv(null);
  }, []);

  return {
    loading,
    envs,
    filteredEnvs,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    filterDefs,
    summary,
    costDrawerOpen,
    selectedEnv,
    loadEnvs,
    handleViewDetail,
    handleOpenPreview,
    handleWake,
    handleTeardown,
    handleViewCost,
    closeCostDrawer,
  };
};
