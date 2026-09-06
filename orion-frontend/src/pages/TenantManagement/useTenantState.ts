/**
 * useTenantState.ts - Tenant Management 状态 Hook
 * 抽取自 TenantManagement/index.tsx (P2-9 Phase 57)
 * 全 state + loadData + useEffect + 3 handlers + usage helpers + usageItems memo
 */
import { useCallback, useEffect, useState } from 'react';
import { message, Modal } from 'antd';
import { colors } from '@/tokens';
import {
  getTenantQuota,
  updateTenantQuota,
  getNamespacePoolStatus,
  getTenantNamespaces,
  allocateNamespace,
  releaseNamespace,
  getTenantUsage,
  getNamespaceUsageDetail,
  type TenantQuota,
  type PoolStatus,
  type NamespacePoolEntry,
  type TenantUsage,
  type NamespaceUsageDetail,
  type ResourceUsage,
} from '@/api/tenant';

// API 响应包装接口
interface QuotaResponse { quota?: TenantQuota; }
interface PoolStatusResponse { status?: PoolStatus; }
interface NamespaceResponse { namespaces?: NamespacePoolEntry[]; }
interface UsageResponse { usage?: TenantUsage; }

interface UsageItem {
  label: string;
  icon: React.ReactNode;
  usage: ResourceUsage;
  unit: string;
  color: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
    history: number[];
  };
}

export const useTenantState = () => {
  // --- State ---
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<TenantQuota | null>(null);
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [namespaces, setNamespaces] = useState<NamespacePoolEntry[]>([]);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [namespaceDetails, setNamespaceDetails] = useState<NamespaceUsageDetail[]>([]);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [quotaUpdating, setQuotaUpdating] = useState(false);

  // P0-1: 无 tenantId 时提示用户
  const tenantId = localStorage.getItem('tenant_id');

  useEffect(() => {
    if (!tenantId) {
      message.error('租户 ID 不存在，请重新登录');
    }
  }, [tenantId]);

  // --- Loaders ---

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [quotaRes, poolRes, namespacesRes, usageRes, detailsRes] = await Promise.all([
        getTenantQuota(),
        getNamespacePoolStatus(),
        getTenantNamespaces(tenantId),
        getTenantUsage(),
        getNamespaceUsageDetail(tenantId),
      ]);
      const quotaBody = (quotaRes.data as QuotaResponse)?.quota ?? quotaRes.data;
      const poolBody = (poolRes.data as PoolStatusResponse)?.status ?? poolRes.data;
      const nsBody = (namespacesRes.data as NamespaceResponse) ?? namespacesRes.data;
      const usageBody = (usageRes.data as unknown as UsageResponse)?.usage ?? usageRes.data;
      const detailsBody = (detailsRes.data as unknown as NamespaceResponse) ?? detailsRes.data;

      setQuota((quotaBody as any)?.quota || quotaBody);
      setPoolStatus(poolBody);
      setNamespaces(nsBody?.namespaces || []);
      setUsage(
        (usageBody?.usage ? usageBody : { usage: usageBody, quota: usageBody?.quota }) as any
      );
      setNamespaceDetails((detailsBody?.namespaces || []) as unknown as NamespaceUsageDetail[]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载租户数据失败：${error.message}`);
      } else {
        message.error('加载租户数据失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Handlers ---

  const handleUpdateQuota = useCallback(
    async (values: any) => {
      setQuotaUpdating(true);
      try {
        await updateTenantQuota(values);
        message.success('配额更新成功');
        setQuotaModalOpen(false);
        loadData();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`更新配额失败：${error.message}`);
        } else {
          message.error('更新配额失败，请稍后重试');
        }
      } finally {
        setQuotaUpdating(false);
      }
    },
    [loadData],
  );

  const handleAllocateNamespace = useCallback(async () => {
    if (!tenantId) {
      message.error('租户 ID 不存在，请重新登录');
      return;
    }
    Modal.confirm({
      title: '分配 Namespace',
      content: `确认从 Namespace 池中分配一个 Namespace 给当前租户（ID: ${tenantId?.slice(0, 8)}...）？`,
      okText: '确认分配',
      cancelText: '取消',
      onOk: async () => {
        try {
          await allocateNamespace(tenantId);
          message.success('Namespace 分配成功');
          loadData();
        } catch (error: unknown) {
          const err = error as {
            response?: { status?: number; data?: { message?: string } };
            message?: string;
          };
          const status = err.response?.status;
          const errMsg = err.response?.data?.message || err.message;
          if (status === 403) {
            message.error('配额不足，无法分配更多 Namespace');
          } else if (status === 400) {
            message.error(`请求参数错误：${errMsg || '无法分配 Namespace'}`);
          } else if (error instanceof Error) {
            message.error(`分配 Namespace 失败：${error.message}`);
          } else {
            message.error('分配 Namespace 失败，请稍后重试');
          }
        }
      },
    });
  }, [tenantId, loadData]);

  const handleReleaseNamespace = useCallback(
    async (namespaceName: string) => {
      try {
        await releaseNamespace(namespaceName);
        message.success(`Namespace ${namespaceName} 已释放回池`);
        loadData();
      } catch (error: unknown) {
        const err = error as { response?: { status?: number; data?: { message?: string } } };
        if (err.response?.status === 403) {
          message.error('配额不足，无法释放 Namespace');
        } else if (error instanceof Error) {
          message.error(`释放 Namespace 失败：${error.message}`);
        } else {
          message.error('释放 Namespace 失败，请稍后重试');
        }
      }
    },
    [loadData],
  );

  // --- Usage helpers ---

  const getUsagePercent = useCallback((item: ResourceUsage) => {
    if (!item || item.limit === 0) return 0;
    return Math.round((item.used / item.limit) * 100);
  }, []);

  const getUsageColor = useCallback((percent: number) => {
    if (percent >= 90) return colors.error[500];
    if (percent >= 70) return colors.warning[500];
    return colors.success[500];
  }, []);

  const generateTrendData = useCallback((current: number): NonNullable<UsageItem['trend']> => {
    const history = Array.from({ length: 7 }, () =>
      Math.max(0, current + Math.floor(Math.random() * 10 - 5)),
    );
    const yesterday = history[5] || current;
    const changePercent = yesterday > 0 ? Math.round(((current - yesterday) / yesterday) * 100) : 0;
    return {
      direction: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
      changePercent: Math.abs(changePercent),
      history,
    };
  }, []);

  // --- Returns ---

  return {
    loading,
    quota,
    poolStatus,
    namespaces,
    usage,
    namespaceDetails,
    quotaModalOpen, setQuotaModalOpen,
    quotaUpdating,
    tenantId,
    loadData,
    handleUpdateQuota,
    handleAllocateNamespace,
    handleReleaseNamespace,
    getUsagePercent,
    getUsageColor,
    generateTrendData,
  };
};
