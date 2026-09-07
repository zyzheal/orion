/**
 * Pipeline Budget state hook
 * 抽取自 index.tsx (P2-9 Phase 152)
 */
import { useCallback, useEffect, useState } from 'react';
import { Form } from 'antd';
import { message } from 'antd';
import { useParams, useSearchParams } from 'react-router-dom';
import { pipelineBudgetApi } from '@/api/pipeline-budget';
import type { BudgetConfig, BudgetUsage } from './types';

export function usePipelineBudgetState() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId') || undefined;

  const [config, setConfig] = useState<BudgetConfig | null>(null);
  const [usage, setUsage] = useState<BudgetUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadUsage = useCallback(
    async (rid: string) => {
      if (!pipelineId || !rid) return;
      try {
        const usageData = await pipelineBudgetApi.getUsage(pipelineId, rid);
        setUsage(usageData);
      } catch (error: unknown) {
        message.error(`加载预算使用数据失败: ${(error as Error).message}`);
      }
    },
    [pipelineId],
  );

  const loadBudget = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const budgetConfig = await pipelineBudgetApi.get(pipelineId);
      setConfig(budgetConfig || {});
      form.setFieldsValue(budgetConfig || {});
      if (runId) {
        await loadUsage(runId);
      } else {
        setUsage(null);
      }
    } catch (error: unknown) {
      message.error(`加载预算配置失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, runId, form, loadUsage]);

  useEffect(() => {
    loadBudget();
  }, [loadBudget]);

  const handleSave = useCallback(
    async (values: BudgetConfig) => {
      if (!pipelineId) return;
      setSaving(true);
      try {
        await pipelineBudgetApi.set(pipelineId, values);
        message.success('预算配置已保存');
        loadBudget();
      } catch (error: unknown) {
        message.error(`保存失败: ${(error as Error).message}`);
      } finally {
        setSaving(false);
      }
    },
    [pipelineId, loadBudget],
  );

  const handleReset = useCallback(() => {
    if (config) {
      form.setFieldsValue(config);
      message.info('已重置为上次保存的配置');
    }
  }, [config, form]);

  return {
    pipelineId,
    runId,
    config,
    usage,
    loading,
    saving,
    form,
    loadBudget,
    handleSave,
    handleReset,
  };
}

export type PipelineBudgetState = ReturnType<typeof usePipelineBudgetState>;
