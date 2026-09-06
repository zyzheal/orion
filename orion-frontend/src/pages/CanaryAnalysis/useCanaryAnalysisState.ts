/**
 * useCanaryAnalysisState.ts - ML 金丝雀分析状态 Hook
 * 抽取自 CanaryAnalysis/index.tsx (P2-9 Phase 80)
 */
import { useState, useMemo, useEffect } from 'react';
import { message, Form } from 'antd';
import {
  getCanaryRuns,
  getCanaryConfigs,
  getCanaryMetrics,
  getCanaryMlResults,
  triggerCanaryAnalysis,
  createCanaryConfig,
  forcePromote,
  forceRollback,
  type CanaryAnalysisRun,
  type CanaryMetricResult,
  type CanaryMlResult,
  type CanaryTriggerInput,
  type CanaryConfigInput,
} from '@/api/canary-analysis';
import { type TriggerFormValues, type ConfigFormValues } from './types';

export const useCanaryAnalysisState = () => {
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<CanaryAnalysisRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<CanaryAnalysisRun | null>(null);
  const [metrics, setMetrics] = useState<CanaryMetricResult[]>([]);
  const [mlResults, setMlResults] = useState<CanaryMlResult[]>([]);
  const [runDetailVisible, setRunDetailVisible] = useState(false);
  const [triggerModalVisible, setTriggerModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [triggerForm] = Form.useForm();
  const [configForm] = Form.useForm();
  const [triggerSubmitting, setTriggerSubmitting] = useState(false);
  const [configSubmitting, setConfigSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const runRes = await getCanaryRuns();
      await getCanaryConfigs();
      setRuns(Array.isArray(runRes.data) ? runRes.data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载金丝雀分析数据失败：${error.message}`);
      } else {
        message.error('Failed to load canary analysis data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!r.deploymentId.toLowerCase().includes(q)) return false;
      }
      if (filters.status && filters.status !== 'all' && r.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, runs]);

  const runningCount = runs.filter((r) => r.status === 'running').length;
  const promotedCount = runs.filter((r) => r.status === 'promote').length;
  const rolledbackCount = runs.filter((r) => r.status === 'rollback').length;

  const handleViewRun = async (run: CanaryAnalysisRun) => {
    setSelectedRun(run);
    try {
      const [metricRes, mlRes] = await Promise.all([
        getCanaryMetrics(run.id),
        getCanaryMlResults(run.id),
      ]);
      setMetrics(Array.isArray(metricRes.data) ? metricRes.data : []);
      setMlResults(Array.isArray(mlRes.data) ? mlRes.data : []);
      setRunDetailVisible(true);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载运行详情失败：${error.message}`);
      } else {
        message.error('Failed to load run detail');
      }
    }
  };

  const handleTrigger = async (values: TriggerFormValues) => {
    setTriggerSubmitting(true);
    try {
      await triggerCanaryAnalysis(values as CanaryTriggerInput);
      message.success('Canary analysis triggered');
      setTriggerModalVisible(false);
      triggerForm.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`触发分析失败：${error.message}`);
      } else {
        message.error('Failed to trigger analysis');
      }
    } finally {
      setTriggerSubmitting(false);
    }
  };

  const handleForcePromote = async (runId: string) => {
    try {
      await forcePromote({ runId, reason: 'Manual promote by user' });
      message.success('Force promoted');
      loadData();
      setRunDetailVisible(false);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`强制升级失败：${error.message}`);
      } else {
        message.error('Failed to force promote');
      }
    }
  };

  const handleForceRollback = async (runId: string) => {
    try {
      await forceRollback({ runId, reason: 'Manual rollback by user' });
      message.success('Force rolled back');
      loadData();
      setRunDetailVisible(false);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`强制回滚失败：${error.message}`);
      } else {
        message.error('Failed to force rollback');
      }
    }
  };

  const handleSaveConfig = async (values: ConfigFormValues) => {
    setConfigSubmitting(true);
    try {
      await createCanaryConfig(values as CanaryConfigInput);
      message.success('Config created');
      setConfigModalVisible(false);
      configForm.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建配置失败：${error.message}`);
      } else {
        message.error('Failed to create config');
      }
    } finally {
      setConfigSubmitting(false);
    }
  };

  return {
    loading,
    runs,
    selectedRun,
    setSelectedRun,
    metrics,
    mlResults,
    runDetailVisible,
    setRunDetailVisible,
    triggerModalVisible,
    setTriggerModalVisible,
    configModalVisible,
    setConfigModalVisible,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    triggerForm,
    configForm,
    triggerSubmitting,
    configSubmitting,
    filteredRuns,
    runningCount,
    promotedCount,
    rolledbackCount,
    loadData,
    handleViewRun,
    handleTrigger,
    handleForcePromote,
    handleForceRollback,
    handleSaveConfig,
  };
};
