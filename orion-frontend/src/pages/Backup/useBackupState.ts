/**
 * useBackupState.ts - Backup 状态 Hook
 * 抽取自 Backup/index.tsx (P2-9 Phase 68)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import {
  getBackupStats,
  listPlans,
  createPlan,
  deletePlan,
  executeBackup,
  listBackupRecords,
  deleteBackupRecord,
  createRecovery,
  executeRecovery,
  type CreatePlanInput,
} from '@/api/backup';
import { mapApiPlan, mapApiRecord } from './constants';
import type { BackupRecord, BackupPlanItem, BackupStats } from './types';

export const useBackupState = () => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<BackupPlanItem[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BackupRecord | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Record<string, BackupRecord[]>>({});
  const [submitting, setSubmitting] = useState(false);

  // ---- Data Loading ----

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPlans();
      const raw = res.data;
      const loadedPlans = Array.isArray(raw) ? raw : [];
      setPlans(loadedPlans.map(mapApiPlan));
    } catch (error: unknown) {
      message.error(`Failed to load plans: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await getBackupStats();
      const s = res.data ?? {};
      setStats({
        total: s.total_backups ?? 0,
        successful: s.completed_backups ?? 0,
        failed: s.failed_backups ?? 0,
        lastBackupTime: s.last_completed_at ?? undefined,
        totalSize: s.total_size_bytes ?? 0,
      });
    } catch (error: unknown) {
      message.error(`Failed to load backup stats: ${(error as Error).message}`);
    }
  }, []);

  const loadRecords = useCallback(async (planId: string) => {
    try {
      const res = await listBackupRecords(planId);
      const raw = res.data;
      const records = Array.isArray(raw) ? raw : [];
      setExpandedRecords((prev) => ({
        ...prev,
        [planId]: records.map(mapApiRecord),
      }));
    } catch {
      setExpandedRecords((prev) => ({ ...prev, [planId]: [] }));
    }
  }, []);

  useEffect(() => {
    loadData();
    loadStats();
  }, [loadData, loadStats]);

  // ---- Filtering ----

  const filteredData = useMemo(() => {
    return plans.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q)) return false;
      }
      if (filters.type && filters.type !== 'all' && p.type !== filters.type) return false;
      return true;
    });
  }, [searchQuery, filters, plans]);

  // ---- Actions ----

  const handleCreate = useCallback(
    async (values: { name: string; type: string; retentionDays?: number }) => {
      try {
        setSubmitting(true);
        await createPlan({
          name: values.name,
          type: values.type,
          retention_days: values.retentionDays ?? 7,
          enabled: true,
        } as CreatePlanInput);
        message.success('备份计划已创建');
        setCreateModalVisible(false);
        loadData();
        loadStats();
      } catch (error: unknown) {
        message.error(`创建备份计划失败：${(error as Error).message}`);
      } finally {
        setSubmitting(false);
      }
    },
    [loadData, loadStats],
  );

  const handleExecute = useCallback(
    async (planId: string) => {
      try {
        setSubmitting(true);
        await executeBackup(planId);
        message.success('备份任务已启动');
        loadStats();
      } catch (error: unknown) {
        message.error(`执行备份失败：${(error as Error).message}`);
      } finally {
        setSubmitting(false);
      }
    },
    [loadStats],
  );

  const handleDeletePlan = useCallback(
    async (id: string) => {
      try {
        await deletePlan(id);
        message.success('备份计划已删除');
        loadData();
        loadStats();
      } catch (error: unknown) {
        message.error(`删除失败：${(error as Error).message}`);
      }
    },
    [loadData, loadStats],
  );

  const handleDeleteRecord = useCallback(
    async (planId: string, recordId: string) => {
      try {
        await deleteBackupRecord(planId, recordId);
        message.success('备份记录已删除');
        loadRecords(planId);
        loadStats();
      } catch (error: unknown) {
        message.error(`删除失败：${(error as Error).message}`);
      }
    },
    [loadRecords, loadStats],
  );

  const handleRestore = useCallback(async () => {
    if (!selectedRecord) return;
    try {
      setSubmitting(true);
      const res = await createRecovery({ backup_id: selectedRecord.id });
      const recovery = res.data;
      if (recovery?.id) {
        await executeRecovery(recovery.id);
      }
      message.success(`备份恢复任务已启动 (${recovery?.id ?? 'ok'})`);
      setRestoreModalVisible(false);
      loadStats();
    } catch (error: unknown) {
      message.error(`恢复失败：${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }, [selectedRecord, loadStats]);

  const openRestore = useCallback((record: BackupRecord) => {
    setSelectedRecord(record);
    setRestoreModalVisible(true);
  }, []);

  const toggleRecords = useCallback(
    (planId: string) => {
      if (!expandedRecords[planId]) {
        loadRecords(planId);
      }
      setExpandedRecords((prev) => {
        const next = { ...prev };
        if (next[planId]) {
          delete next[planId];
        } else {
          next[planId] = [];
          setTimeout(() => loadRecords(planId), 0);
        }
        return next;
      });
    },
    [expandedRecords, loadRecords],
  );

  return {
    loading,
    plans,
    stats,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    restoreModalVisible,
    setRestoreModalVisible,
    selectedRecord,
    expandedRecords,
    submitting,
    loadData,
    loadStats,
    filteredData,
    handleCreate,
    handleExecute,
    handleDeletePlan,
    handleDeleteRecord,
    handleRestore,
    openRestore,
    toggleRecords,
  };
};
