/**
 * useMultiCloudState.ts - 多云管理状态 Hook
 * 抽取自 multi-cloud/MultiCloudPage.tsx (P2-9 Phase 71)
 */
import { useState, useEffect, useMemo } from 'react';
import { message, Modal, Form } from 'antd';
import {
  multiCloudApi,
  type CloudAccount,
  type CloudResource,
  type ResourceStatistics,
  type CostComparison,
} from '@/api/multi-cloud';
import { makeAccountColumns, resourceColumns } from './MultiCloudColumns';

export const useMultiCloudState = () => {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [statistics, setStatistics] = useState<ResourceStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CloudAccount | null>(null);
  const [editForm] = Form.useForm();
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [costComparison, setCostComparison] = useState<CostComparison[]>([]);
  const [costLoading, setCostLoading] = useState(false);
  const [form] = Form.useForm();
  const [costForm] = Form.useForm();
  const [costTrendData, setCostTrendData] = useState<
    Array<{ month: string; cost: number }>
  >([]);
  const [costTrendLoading, setCostTrendLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsRes, resourcesRes, statsRes] = await Promise.allSettled([
        multiCloudApi.listCloudAccounts(),
        multiCloudApi.listCloudResources(),
        multiCloudApi.getResourceStatistics(),
      ]);
      if (accountsRes.status === 'fulfilled') {
        const data = accountsRes.value as { data?: CloudAccount[] };
        setAccounts(Array.isArray(data?.data) ? data.data : []);
      }
      if (resourcesRes.status === 'fulfilled') {
        const data = resourcesRes.value as { data?: CloudResource[] };
        setResources(Array.isArray(data?.data) ? data.data : []);
      }
      if (statsRes.status === 'fulfilled') {
        const data = statsRes.value as { data?: ResourceStatistics };
        setStatistics(data?.data ?? null);
      }
    } catch (error: unknown) {
      message.error(`加载多云数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---- Cost Trend Data ----

  useEffect(() => {
    const fetchCostTrend = async () => {
      setCostTrendLoading(true);
      try {
        const res = await multiCloudApi.getCostStats();
        const data = (res.data as { months?: Array<{ month: string; cost: number }> }) || {};
        if (data.months && data.months.length > 0) {
          setCostTrendData(data.months);
        }
      } catch {
        setCostTrendData([]);
      } finally {
        setCostTrendLoading(false);
      }
    };
    fetchCostTrend();
  }, []);

  const maxCost = Math.max(...costTrendData.map((t) => t.cost), 1);

  // ---- Handlers ----

  const handleCreate = async (values: {
    name: string;
    provider: string;
    region: string;
    credentials_ref?: string;
  }) => {
    try {
      await multiCloudApi.registerCloudAccount({
        provider: values.provider,
        name: values.name,
        region: values.region,
        credentials_ref: values.credentials_ref ?? '',
        metadata: {},
      });
      message.success('云账号注册成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`注册失败: ${(error as Error).message}`);
    }
  };

  const handleSync = async (accountId: string) => {
    setSyncing(accountId);
    try {
      await multiCloudApi.syncAccountResources(accountId);
      message.success('资源同步已启动');
      loadData();
      setSyncing(null);
    } catch (error: unknown) {
      message.error(`同步失败: ${(error as Error).message}`);
      setSyncing(null);
    }
  };

  const handleEdit = (record: CloudAccount) => {
    setEditingAccount(record);
    editForm.setFieldsValue({
      name: record.account_name,
      provider: record.provider_id || record.credential_type,
      region: record.region,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (values: { name: string; provider: string; region: string }) => {
    if (!editingAccount) return;
    try {
      await multiCloudApi.updateCloudAccount(editingAccount.id, {
        name: values.name,
        region: values.region,
      });
      message.success('云账号更新成功');
      setEditModalOpen(false);
      setEditingAccount(null);
      editForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`更新失败: ${(error as Error).message}`);
    }
  };

  const handleDelete = (record: CloudAccount) => {
    Modal.confirm({
      title: '确认删除云账号？',
      content: `将删除云账号「${record.account_name}」(${record.provider_id || record.credential_type})，该操作不可恢复。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await multiCloudApi.deleteCloudAccount(record.id);
          message.success('云账号已删除');
          loadData();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const handleCostCompare = async (values: {
    vm_count: number;
    vm_type: string;
    storage_gb: number;
    bandwidth_gb_month: number;
  }) => {
    setCostLoading(true);
    try {
      const res = await multiCloudApi.compareCloudCosts({
        vm_count: values.vm_count,
        vm_type: values.vm_type,
        storage_gb: values.storage_gb,
        bandwidth_gb_month: values.bandwidth_gb_month,
      });
      setCostComparison((res.data as CostComparison[]) || []);
    } catch (error: unknown) {
      message.error(`成本对比失败: ${(error as Error).message}`);
    } finally {
      setCostLoading(false);
    }
  };

  // ---- Derived Memos ----

  const stats = useMemo(
    () => ({
      total: accounts.length,
      active: accounts.filter((a) => a.status === 'active').length,
      error: accounts.filter((a) => a.status === 'error').length,
      resources: resources.length,
      providers: new Set(accounts.map((a) => a.provider_id || a.credential_type)).size,
      regions: new Set(accounts.map((a) => a.region)).size,
    }),
    [accounts, resources],
  );

  const providerDistribution = useMemo(() => {
    const source = statistics?.byProvider ?? {};
    const entries = Object.entries(source);
    const total = entries.reduce((sum, [, count]) => sum + (count as number), 0);
    if (total === 0) {
      const providerCounts: Record<string, number> = {};
      accounts.forEach((a) => {
        const p = a.provider_id || a.credential_type || 'unknown';
        providerCounts[p] = (providerCounts[p] || 0) + 1;
      });
      const fallbackEntries = Object.entries(providerCounts);
      const fallbackTotal = fallbackEntries.reduce((sum, [, count]) => sum + count, 0);
      return fallbackEntries.map(([provider, count]) => ({
        provider,
        count,
        percentage: fallbackTotal > 0 ? Math.round((count / fallbackTotal) * 100) : 0,
      }));
    }
    return entries.map(([provider, count]) => ({
      provider,
      count: count as number,
      percentage: Math.round(((count as number) / total) * 100),
    }));
  }, [statistics, accounts]);

  const resourceTypeDistribution = useMemo(() => {
    const source = statistics?.byType ?? {};
    const entries = Object.entries(source);
    const total = entries.reduce((sum, [, count]) => sum + (count as number), 0);
    return entries.map(([type, count]) => ({
      type,
      count: count as number,
      percentage: total > 0 ? Math.round(((count as number) / total) * 100) : 0,
    }));
  }, [statistics]);

  const accountColumns = useMemo(
    () =>
      makeAccountColumns({
        resources,
        syncing,
        handleSync,
        handleEdit,
        handleDelete,
      }),
    [resources, syncing, handleSync, handleEdit, handleDelete],
  );

  return {
    accounts,
    resources,
    statistics,
    loading,
    syncing,
    createModalOpen,
    setCreateModalOpen,
    editModalOpen,
    setEditModalOpen,
    editingAccount,
    setEditingAccount,
    costModalOpen,
    setCostModalOpen,
    costComparison,
    setCostComparison,
    costLoading,
    costTrendData,
    costTrendLoading,
    maxCost,
    stats,
    providerDistribution,
    resourceTypeDistribution,
    accountColumns,
    resourceColumns,
    form,
    editForm,
    costForm,
    loadData,
    handleCreate,
    handleSync,
    handleEdit,
    handleEditSubmit,
    handleDelete,
    handleCostCompare,
  };
};
