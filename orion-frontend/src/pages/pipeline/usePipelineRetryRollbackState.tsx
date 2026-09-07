/**
 * Pipeline 重试与回滚 state hook
 * 抽取自 PipelineRetryRollback.tsx (P2-9 Phase 111)
 */
import { useState, useMemo } from 'react';
import { message } from 'antd';
import type { PipelineRunItem } from './types';
import { mockRuns } from './runRetryConstants';

export const usePipelineRetryRollbackState = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRun, setSelectedRun] = useState<PipelineRunItem | null>(null);
  const [retryModalVisible, setRetryModalVisible] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [retryStage, setRetryStage] = useState<string | undefined>(undefined);
  const [rollbackTargetRunId, setRollbackTargetRunId] = useState('');
  const [retryLoading, setRetryLoading] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // 过滤数据
  const filteredRuns = useMemo(() => {
    if (statusFilter === 'all') return mockRuns;
    return mockRuns.filter((r) => r.status === statusFilter);
  }, [statusFilter]);

  // 统计数据
  const stats = useMemo(() => {
    const total = mockRuns.length;
    const success = mockRuns.filter((r) => r.status === 'success').length;
    const failed = mockRuns.filter((r) => r.status === 'failed').length;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    return { total, success, failed, successRate };
  }, []);

  // 获取失败阶段列表（用于重试时选择）
  const getFailedStages = (run: PipelineRunItem) => {
    return run.stages.filter((s) => s.status === 'failed');
  };

  // ============ 操作处理 ============

  const handleRetry = (run: PipelineRunItem) => {
    setSelectedRun(run);
    setRetryStage(undefined);
    setRetryModalVisible(true);
  };

  const handleRollback = (run: PipelineRunItem) => {
    setSelectedRun(run);
    setRollbackTargetRunId('');
    setRollbackModalVisible(true);
  };

  const handleCancel = (run: PipelineRunItem) => {
    setSelectedRun(run);
    setCancelModalVisible(true);
  };

  const handleRetryConfirm = async () => {
    setRetryLoading(true);
    try {
      // 模拟 API 调用
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (!selectedRun) return;

      // 模拟重试已触发（实际项目中应调用 retryPipelineRun API）
      message.success(
        retryStage
          ? `Pipeline "${selectedRun.pipelineName}" 重试已发起，从阶段 "${retryStage}" 开始执行`
          : `Pipeline "${selectedRun.pipelineName}" 重试已发起，执行 Run #${selectedRun.runNumber}`
      );
      setRetryModalVisible(false);
      setRetryLoading(false);
    } catch (_error) {
      message.error('重试失败，请重试');
      setRetryLoading(false);
    }
  };

  const handleRollbackConfirm = async () => {
    if (!rollbackTargetRunId) {
      message.error('请选择目标版本 Run ID');
      return;
    }
    setRollbackLoading(true);
    try {
      // 模拟 API 调用
      await new Promise((resolve) => setTimeout(resolve, 1000));
      message.success(
        `Pipeline "${selectedRun?.pipelineName}" 已成功回滚到 ${rollbackTargetRunId}`
      );
      setRollbackModalVisible(false);
      setRollbackLoading(false);
    } catch (_error) {
      message.error('回滚失败，请重试');
      setRollbackLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!selectedRun) return;
    setCancelLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      message.success(`Pipeline Run "${selectedRun.id}" 已取消`);
      setCancelModalVisible(false);
      setCancelLoading(false);
    } catch (_error) {
      message.error('取消失败，请重试');
      setCancelLoading(false);
    }
  };

  return {
    // state
    statusFilter,
    setStatusFilter,
    selectedRun,
    setSelectedRun,
    retryModalVisible,
    setRetryModalVisible,
    rollbackModalVisible,
    setRollbackModalVisible,
    cancelModalVisible,
    setCancelModalVisible,
    retryStage,
    setRetryStage,
    rollbackTargetRunId,
    setRollbackTargetRunId,
    retryLoading,
    rollbackLoading,
    cancelLoading,
    // computed
    filteredRuns,
    stats,
    getFailedStages,
    // handlers
    handleRetry,
    handleRollback,
    handleCancel,
    handleRetryConfirm,
    handleRollbackConfirm,
    handleCancelConfirm,
  };
};

export type PipelineRetryRollbackState = ReturnType<typeof usePipelineRetryRollbackState>;
