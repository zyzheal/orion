/**
 * useBudgetGuardState - Budget Guard 页面状态容器
 * 抽取自 BudgetGuardPage.tsx (P2-9 Phase 45)
 *
 * 管理: guards 列表 + 3 过滤器 + submitting/evalLoading + forecast + evaluationCount/blockedCount
 * 提供: loadGuards/loadForecast + filteredGuards memo + handleCreate/Update/Delete/Toggle/Evaluate
 * Modal Form 实例由主页面持有（form owner），本 hook 只持有 submitting/loading/evalResult 状态
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import {
  getBudgetGuards,
  createBudgetGuard,
  updateBudgetGuard,
  deleteBudgetGuard,
  evaluateBudgetGuard,
  getCostForecast,
  type BudgetGuard,
  type BudgetGuardInput,
  type EvaluationResult,
  type CostForecastResult,
} from '@/api/cost-operations';

export interface UseBudgetGuardStateReturn {
  guards: BudgetGuard[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (f: string) => void;
  actionFilter: string;
  setActionFilter: (f: string) => void;
  filteredGuards: BudgetGuard[];
  submitting: boolean;
  forecast: CostForecastResult | null;
  forecastLoading: boolean;
  evaluationCount: number;
  blockedCount: number;
  evalLoading: boolean;
  evalResult: EvaluationResult | null;
  setEvalResult: (r: EvaluationResult | null) => void;
  loadGuards: () => Promise<void>;
  loadForecast: () => Promise<void>;
  handleCreate: (values: BudgetGuardInput) => Promise<void>;
  handleUpdate: (values: BudgetGuardInput, editingGuard: BudgetGuard) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleToggle: (guard: BudgetGuard) => Promise<void>;
  handleEvaluate: (values: { pipelineId: string; estimatedCost: number }) => Promise<void>;
}

export const useBudgetGuardState = (): UseBudgetGuardStateReturn => {
  const [guards, setGuards] = useState<BudgetGuard[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const [submitting, setSubmitting] = useState(false);

  const [evalLoading, setEvalLoading] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);

  const [forecast, setForecast] = useState<CostForecastResult | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const [evaluationCount, setEvaluationCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);

  const loadGuards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBudgetGuards();
      const data = res.data?.data;
      setGuards(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      setGuards([]);
      if (error instanceof Error) {
        message.error(`加载 Budget Guard 列表失败: ${error.message}`);
      } else {
        message.error('加载 Budget Guard 列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadForecast = useCallback(async () => {
    setForecastLoading(true);
    try {
      const res = await getCostForecast({ days: 30 });
      const apiResponse = res.data as unknown as { data?: CostForecastResult };
      setForecast(apiResponse?.data || null);
    } catch {
      setForecast(null);
    } finally {
      setForecastLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGuards();
    loadForecast();
  }, [loadGuards, loadForecast]);

  const filteredGuards = useMemo(() => {
    return guards.filter((g) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!g.name.toLowerCase().includes(q) && !(g.description || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (actionFilter !== 'all' && g.action !== actionFilter) return false;
      return true;
    });
  }, [guards, searchQuery, statusFilter, actionFilter]);

  const handleCreate = useCallback(
    async (values: BudgetGuardInput) => {
      setSubmitting(true);
      try {
        await createBudgetGuard({
          name: values.name,
          description: values.description,
          budgetAmount: values.budgetAmount,
          currency: values.currency || 'CNY',
          action: values.action,
          scope: values.scope,
        });
        message.success('Budget Guard 创建成功');
        await loadGuards();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`创建失败: ${error.message}`);
        } else {
          message.error('创建失败，请稍后重试');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [loadGuards]
  );

  const handleUpdate = useCallback(
    async (values: BudgetGuardInput, editingGuard: BudgetGuard) => {
      setSubmitting(true);
      try {
        await updateBudgetGuard(editingGuard.id, {
          name: values.name,
          description: values.description,
          budgetAmount: values.budgetAmount,
          currency: values.currency,
          action: values.action,
          scope: values.scope,
        });
        message.success('Budget Guard 更新成功');
        await loadGuards();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`更新失败: ${error.message}`);
        } else {
          message.error('更新失败，请稍后重试');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [loadGuards]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteBudgetGuard(id);
        message.success('Budget Guard 删除成功');
        await loadGuards();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`删除失败: ${error.message}`);
        } else {
          message.error('删除失败，请稍后重试');
        }
      }
    },
    [loadGuards]
  );

  const handleToggle = useCallback(
    async (guard: BudgetGuard) => {
      try {
        const newStatus = guard.status === 'active' ? 'inactive' : 'active';
        await updateBudgetGuard(guard.id, {
          name: guard.name,
          budgetAmount: guard.budgetAmount,
          currency: guard.currency,
          action: guard.action,
          scope: guard.scope
            ? { projectIds: guard.scope.projectIds, environment: guard.scope.environment ?? undefined }
            : undefined,
          status: newStatus,
        } as BudgetGuardInput);
        message.success(`Guard ${guard.name} ${newStatus === 'active' ? '已启用' : '已停用'}`);
        await loadGuards();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`操作失败: ${error.message}`);
        } else {
          message.error('操作失败，请稍后重试');
        }
      }
    },
    [loadGuards]
  );

  const handleEvaluate = useCallback(
    async (values: { pipelineId: string; estimatedCost: number }) => {
      setEvalLoading(true);
      setEvalResult(null);
      try {
        const res = await evaluateBudgetGuard(values.pipelineId, values.estimatedCost);
        setEvalResult(res.data?.data || null);
        setEvaluationCount((prev) => prev + 1);
        if (res.data?.data?.passed === false) {
          setBlockedCount((prev) => prev + 1);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`评估失败: ${error.message}`);
        } else {
          message.error('评估失败，请稍后重试');
        }
      } finally {
        setEvalLoading(false);
      }
    },
    []
  );

  return {
    guards,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    actionFilter,
    setActionFilter,
    filteredGuards,
    submitting,
    forecast,
    forecastLoading,
    evaluationCount,
    blockedCount,
    evalLoading,
    evalResult,
    setEvalResult,
    loadGuards,
    loadForecast,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleToggle,
    handleEvaluate,
  };
};
