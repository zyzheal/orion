/**
 * useRunnerState.ts - RunnerManagement 状态 Hook
 * 抽取自 RunnerManagement/index.tsx (P2-9 Phase 59)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import {
  getRunners,
  deregisterRunner,
  type Runner,
} from '@/api/runners';
import { isHeartbeatStale } from './constants';
import type { FilterDefinition } from '@/components/SearchFilterBar';

export const useRunnerState = () => {
  const [runners, setRunners] = useState<Runner[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [registerVisible, setRegisterVisible] = useState(false);
  const [editingRunner, setEditingRunner] = useState<Runner | null>(null);
  const [selectedRunner, setSelectedRunner] = useState<Runner | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const loadRunners = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRunners();
      const apiData = response.data;
      const runnerList = Array.isArray(apiData)
        ? apiData
        : (apiData as { items?: Runner[] })?.items || [];
      setRunners(runnerList);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载 Runner 列表失败：${error.message}`);
      } else {
        message.error('加载 Runner 列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRunners();
  }, [loadRunners]);

  const filteredRunners = useMemo(() => {
    return runners.filter((runner) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          runner.name,
          runner.labels.join(' '),
          runner.metadata?.os || '',
          runner.metadata?.arch || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'stale') {
          if (!isHeartbeatStale(runner.lastHeartbeat)) return false;
        } else if (runner.status !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, filters, runners]);

  const handleDeregister = useCallback(
    async (id: string) => {
      try {
        await deregisterRunner(id);
        message.success('Runner 已注销');
        loadRunners();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`注销失败：${error.message}`);
        } else {
          message.error('注销失败，请稍后重试');
        }
      }
    },
    [loadRunners],
  );

  const handleViewDetail = useCallback((runner: Runner) => {
    setSelectedRunner(runner);
    setDrawerVisible(true);
  }, []);

  const handleEditRunner = useCallback((runner: Runner) => {
    setEditingRunner(runner);
    setRegisterVisible(true);
  }, []);

  const filterDefs = useMemo<FilterDefinition[]>(
    () => [
      {
        key: 'status',
        label: '状态',
        options: [
          { label: '全部', value: 'all' },
          { label: '在线', value: 'online' },
          { label: '忙碌', value: 'busy' },
          { label: '离线', value: 'offline' },
          { label: '下线中', value: 'draining' },
          { label: '心跳超时', value: 'stale' },
        ],
      },
    ],
    [],
  );

  return {
    runners,
    loading,
    searchQuery, setSearchQuery,
    filters, setFilters,
    registerVisible, setRegisterVisible,
    editingRunner, setEditingRunner,
    selectedRunner, setSelectedRunner,
    drawerVisible, setDrawerVisible,
    filteredRunners,
    loadRunners,
    handleDeregister,
    handleViewDetail,
    handleEditRunner,
    filterDefs,
  };
};
