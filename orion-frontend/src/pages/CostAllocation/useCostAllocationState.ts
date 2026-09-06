/**
 * useCostAllocationState.ts - Cost Allocation 状态 Hook
 * 抽取自 CostAllocation/index.tsx (P2-9 Phase 72)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { message, Form } from 'antd';
import dayjs from 'dayjs';
import {
  getCostSummary,
  getCostTrend,
  getTopNamespaces,
  listBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  checkBudgetAlerts,
  type CostSummary,
  type CostTrend,
  type FinopsBudget,
  type CreateBudgetInput,
  type UpdateBudgetInput,
} from '@/api/cost-allocation';

export const useCostAllocationState = () => {
  // --- State ---
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [trend, setTrend] = useState<CostTrend[]>([]);
  const [topNamespaces, setTopNamespaces] = useState<{ namespace: string; cost: number }[]>([]);
  const [budgets, setBudgets] = useState<FinopsBudget[]>([]);
  const [alerts, setAlerts] = useState<
    {
      budgetId: string;
      budgetName: string;
      currentSpend: number;
      limit: number;
      exceeded: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetConfirmLoading, setBudgetConfirmLoading] = useState(false);
  const [editingBudget, setEditingBudget] = useState<FinopsBudget | null>(null);
  const [form] = Form.useForm();

  // --- Data Fetching ---
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, trendRes, nsRes, budgetRes, alertRes] = await Promise.all([
        getCostSummary({ month: selectedMonth }),
        getCostTrend({ months: 6 }),
        getTopNamespaces({ month: selectedMonth, limit: 10 }),
        listBudgets(),
        checkBudgetAlerts(),
      ]);
      setSummary(summaryRes.data ?? null);
      setTrend(trendRes.data ?? []);
      setTopNamespaces(nsRes.data ?? []);
      setBudgets(budgetRes.data ?? []);
      setAlerts(alertRes.data ?? []);
    } catch {
      message.error('获取成本数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // --- Month Options ---
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = dayjs().subtract(i, 'month');
        return { label: m.format('YYYY-MM'), value: m.format('YYYY-MM') };
      }),
    [],
  );

  // --- Budget CRUD Handlers ---
  const handleCreateBudget = useCallback(() => {
    setEditingBudget(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, alertThreshold: 80, currency: 'CNY' });
    setBudgetModalVisible(true);
  }, [form]);

  const handleEditBudget = useCallback(
    (record: FinopsBudget) => {
      setEditingBudget(record);
      form.setFieldsValue({
        name: record.name,
        scopeType: record.scopeType,
        scopeValue: record.scopeValue,
        monthlyLimit: record.monthlyLimit,
        currency: record.currency,
        alertThreshold: record.alertThreshold,
        enabled: record.enabled,
      });
      setBudgetModalVisible(true);
    },
    [form],
  );

  const handleSaveBudget = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setBudgetConfirmLoading(true);
      if (editingBudget) {
        const updateInput: UpdateBudgetInput = {
          name: values.name,
          monthlyLimit: values.monthlyLimit,
          alertThreshold: values.alertThreshold,
          enabled: values.enabled,
        };
        await updateBudget(editingBudget.id, updateInput);
        message.success('预算更新成功');
      } else {
        const createInput: CreateBudgetInput = {
          name: values.name,
          scopeType: values.scopeType,
          scopeValue: values.scopeValue,
          monthlyLimit: values.monthlyLimit,
          currency: values.currency,
          alertThreshold: values.alertThreshold,
          enabled: values.enabled,
        };
        await createBudget(createInput);
        message.success('预算创建成功');
      }
      setBudgetModalVisible(false);
      fetchAll();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('保存失败');
    } finally {
      setBudgetConfirmLoading(false);
    }
  }, [editingBudget, form, fetchAll]);

  const handleDeleteBudget = useCallback(
    async (id: string) => {
      try {
        await deleteBudget(id);
        message.success('预算删除成功');
        fetchAll();
      } catch {
        message.error('删除失败');
      }
    },
    [fetchAll],
  );

  // --- Derived ---
  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.currentSpend / a.limit >= (a.exceeded ? 1 : 0)),
    [alerts],
  );

  return {
    summary,
    trend,
    topNamespaces,
    budgets,
    alerts,
    loading,
    selectedMonth,
    setSelectedMonth,
    budgetModalVisible,
    setBudgetModalVisible,
    budgetConfirmLoading,
    editingBudget,
    setEditingBudget,
    form,
    fetchAll,
    monthOptions,
    handleCreateBudget,
    handleEditBudget,
    handleSaveBudget,
    handleDeleteBudget,
    activeAlerts,
  };
};
