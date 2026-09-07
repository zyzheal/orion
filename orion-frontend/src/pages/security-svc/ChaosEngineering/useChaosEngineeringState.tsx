/**
 * ChaosEngineering state hook
 * 抽取自 index.tsx (P2-9 Phase 132)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, message } from 'antd';
import { chaosApi, resilienceApi } from '@/api/chaos';
import type { ChaosExperiment, ChaosFault, ResilienceScore } from '@/api/chaos';

export interface ChaosCreateValues {
  name: string;
  description?: string;
  serviceId?: string;
  environment: string;
  faultTypes: string[];
  duration?: number;
  severity?: string;
  labels?: string;
  steadyState?: string;
}

export const useChaosEngineeringState = () => {
  const [experiments, setExperiments] = useState<ChaosExperiment[]>([]);
  const [score, setScore] = useState<ResilienceScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<ChaosExperiment | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expResponse, scoreData] = await Promise.all([
        chaosApi.listExperiments(),
        resilienceApi.getScore(),
      ]);
      setExperiments(expResponse.data || []);
      setScore(scoreData);
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || '未知错误';
      setError(`加载数据失败: ${errorMsg}`);
      message.error(`加载数据失败: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunExperiment = useCallback(
    async (experimentId: string) => {
      setRunningId(experimentId);
      setRunError(null);
      try {
        await chaosApi.runExperiment(experimentId);
        message.success('混沌实验已启动');
        loadData();
      } catch (err: unknown) {
        const errorMsg = (err as Error).message || '未知错误';
        setRunError(`启动实验失败: ${errorMsg}`);
        message.error(`启动实验失败: ${errorMsg}`);
      } finally {
        setRunningId(null);
      }
    },
    [loadData]
  );

  const handleCreateExperiment = useCallback(
    async (values: ChaosCreateValues) => {
      setSubmitting(true);
      try {
        const payload = {
          name: values.name,
          description: values.description,
          scope: {
            tenant_id: 'default',
            service_id: values.serviceId || undefined,
            environment: values.environment,
          },
          faults: values.faultTypes.map((type: string) => ({
            type: type as ChaosFault['type'],
            target: values.serviceId || '*',
            config: {
              duration_ms: (values.duration || 60) * 1000,
              severity: values.severity || 'medium',
            },
            duration_ms: (values.duration || 60) * 1000,
            delay_ms: 0,
          })),
          steadyStateHypothesis: values.steadyState
            ? { description: values.steadyState }
            : undefined,
        };
        await chaosApi.createExperiment(payload as Parameters<typeof chaosApi.createExperiment>[0]);
        message.success('混沌实验创建成功');
        setCreateModal(false);
        form.resetFields();
        loadData();
      } catch (error: unknown) {
        const err = error as { errorFields?: unknown };
        if (!err.errorFields) {
          message.error(`创建失败: ${(error as Error).message}`);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [form, loadData]
  );

  const openCreate = useCallback(() => {
    form.resetFields();
    setCreateModal(true);
  }, [form]);

  const openDetail = useCallback((exp: ChaosExperiment) => {
    setSelectedExperiment(exp);
    setDetailDrawer(true);
  }, []);

  const stats = useMemo(
    () => ({
      total: experiments.length,
      active: experiments.filter((e) => e.status === 'active').length,
      completed: experiments.filter((e) => e.status === 'completed').length,
      archived: experiments.filter((e) => e.status === 'archived').length,
    }),
    [experiments]
  );

  return {
    experiments,
    score,
    loading,
    error,
    setError,
    createModal,
    setCreateModal,
    detailDrawer,
    setDetailDrawer,
    selectedExperiment,
    form,
    submitting,
    runningId,
    runError,
    setRunError,
    loadData,
    handleRunExperiment,
    handleCreateExperiment,
    openCreate,
    openDetail,
    stats,
  };
};

export type ChaosEngineeringState = ReturnType<typeof useChaosEngineeringState>;
