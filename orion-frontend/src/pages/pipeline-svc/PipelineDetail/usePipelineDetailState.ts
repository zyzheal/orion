/**
 * usePipelineDetailState.ts - PipelineDetail 状态钩子
 * 抽取自 pipeline-svc/PipelineDetail/index.tsx (P2-9 Phase 103)
 * P0-3 Fix: Removed silent mock fallback. On API failure, displays error
 * message and allows retry instead of silently showing mock data.
 */
import { useState, useEffect, useCallback } from 'react';
import { Modal, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { getPipelineRun, retryPipelineRun } from '@/api/pipelines';
import { retryFromStage } from '@/api/pipelineRuns';
import type { PipelineDetailModel, APIFlattenedResponse, StageDetail } from './types';

export const usePipelineDetailState = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('stages');
  const [isRerunning, setIsRerunning] = useState(false);
  const [retryingStageId, setRetryingStageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineDetailModel | null>(null);

  const loadPipelineDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setApiError(null);
    try {
      const response = await getPipelineRun(id);
      // response-wrapper wraps bare {run, stages, tasks} into {success, data: {run, stages, tasks}, meta, _legacy}
      const wrapperData = response.data as { data?: any };
      const apiData = wrapperData?.data ?? wrapperData;
      if (apiData && apiData instanceof Object && ('run' in apiData || 'stages' in apiData)) {
        const run = (apiData as APIFlattenedResponse).run || apiData;
        const flattened: PipelineDetailModel = {
          id: (run as PipelineDetailModel).id || '',
          name: (run as PipelineDetailModel).name || '',
          runNumber: (run as PipelineDetailModel).runNumber || 0,
          status: (run as PipelineDetailModel).status || '',
          branch:
            ((run as PipelineDetailModel).context?.branch as string) ||
            (run as PipelineDetailModel).branch ||
            'main',
          commit:
            ((run as PipelineDetailModel).context?.commitSha as string) ||
            (run as PipelineDetailModel).commit ||
            '-',
          version:
            ((run as PipelineDetailModel).context?.version as string) ||
            (run as PipelineDetailModel).pipelineVersion,
          stages: (apiData as APIFlattenedResponse).stages || [],
        };
        setPipeline(flattened);
      } else {
        setApiError('未找到该 Pipeline 运行记录');
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '加载失败，请稍后重试';
      setApiError(errorMsg);
      message.error(`加载 Pipeline 详情失败：${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadPipelineDetail();
    }
  }, [id, loadPipelineDetail]);

  const handleRerun = useCallback(async () => {
    if (!id) return;
    try {
      await retryPipelineRun(id);
      message.success('Pipeline 重新运行成功');
      await loadPipelineDetail();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`重新运行 Pipeline 失败：${error.message}`);
      } else {
        message.error('重新运行 Pipeline 失败，请稍后重试');
      }
    } finally {
      setIsRerunning(false);
    }
  }, [id, loadPipelineDetail]);

  const handleRetryFromStage = useCallback(
    (stageId: string, stageName: string) => {
      if (!id) return;
      Modal.confirm({
        title: '从该阶段重跑',
        content: `确认从阶段「${stageName}」开始重新运行？已完成的前置阶段将不会重新执行。`,
        okText: '确认重跑',
        cancelText: '取消',
        onOk: async () => {
          try {
            setRetryingStageId(stageId);
            const response = await retryFromStage(id, stageId);
            const newRun = response.data as { id?: string; run?: { id?: string } };
            message.success(`已从阶段「${stageName}」重新运行`);
            // Redirect to the new run's detail page
            if (newRun?.id || newRun?.run?.id) {
              const runId = newRun.id || newRun.run?.id;
              navigate(`/pipelines/runs/${runId}`);
            } else {
              // Fallback: reload current page to see updated status
              await loadPipelineDetail();
            }
          } catch (error: unknown) {
            if (error instanceof Error) {
              message.error(`从阶段「${stageName}」重跑失败：${error.message}`);
            } else {
              message.error(`从阶段「${stageName}」重跑失败，请稍后重试`);
            }
          } finally {
            setRetryingStageId(null);
          }
        },
      });
    },
    [id, navigate, loadPipelineDetail]
  );

  const totalStages = pipeline?.stages?.length || 0;
  const completedStages =
    pipeline?.stages?.filter((s: StageDetail) => s.status === 'success').length || 0;
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  return {
    id,
    activeTab,
    setActiveTab,
    isRerunning,
    setIsRerunning,
    retryingStageId,
    setRetryingStageId,
    loading,
    apiError,
    pipeline,
    setPipeline,
    loadPipelineDetail,
    handleRerun,
    handleRetryFromStage,
    totalStages,
    completedStages,
    progressPercent,
    navigate,
  };
};

export type PipelineDetailState = ReturnType<typeof usePipelineDetailState>;
