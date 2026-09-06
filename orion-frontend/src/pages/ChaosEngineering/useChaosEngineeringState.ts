/**
 * useChaosEngineeringState.ts - 混沌工程状态 Hook
 * 抽取自 ChaosEngineering/index.tsx (P2-9 Phase 91)
 */
import { useState, useEffect, useMemo } from 'react';
import { message, Form } from 'antd';
import { chaosApi, resilienceApi, type ChaosExperiment, type ChaosFault, type ResilienceScore } from '@/api/chaos';

interface CreateExperimentFormValues {
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
  const [form] = Form.useForm<CreateExperimentFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunExperiment = async (experimentId: string) => {
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
  };

  const handleCreateExperiment = async (values: CreateExperimentFormValues) => {
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
        steadyStateHypothesis: values.steadyState ? { description: values.steadyState } : undefined,
      };
      await chaosApi.createExperiment(payload);
      message.success('混沌实验创建成功');
      setCreateModal(false);
      form.resetFields();
      loadData();
    } catch (err: unknown) {
      const errorAny = err as { errorFields?: unknown };
      if (!errorAny.errorFields) {
        message.error(`创建失败: ${(err as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = (exp: ChaosExperiment) => {
    setSelectedExperiment(exp);
    setDetailDrawer(true);
  };

  const openCreate = () => {
    form.resetFields();
    setCreateModal(true);
  };

  const stats = useMemo(
    () => ({
      total: experiments.length,
      active: experiments.filter((e) => e.status === 'active').length,
      completed: experiments.filter((e) => e.status === 'completed').length,
      archived: experiments.filter((e) => e.status === 'archived').length,
      hasProductionActive: experiments.some(
        (e) => e.scope?.environment === 'production' && e.status === 'active'
      ),
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
    openDetail,
    openCreate,
    stats,
  };
};
