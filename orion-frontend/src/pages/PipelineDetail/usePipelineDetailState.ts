/**
 * PipelineDetail State Hook
 * 从 index.tsx 抽取的状态 + 加载器 + 处理器集中管理
 */
import { useState, useCallback, useEffect } from 'react';
import { message, Modal } from 'antd';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { useNavigate, useParams } from 'react-router-dom';
import { getPipeline, getPipelineRuns, triggerPipeline } from '@/api/pipelines';
import {
  getPipelineRunDetail,
  getPipelineRunStages,
  retryFromStage,
  type PipelineRunSummary,
} from '@/api/pipelineRuns';
import { extractData, extractList } from './helpers';
import type { PipelineDisplay, PipelineStage, PipelineStep, RunDetailPayload } from './types';

dayjs.extend(duration);

export interface UsePipelineDetailStateReturn {
  id: string | undefined;
  navigate: ReturnType<typeof useNavigate>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isRerunning: boolean;
  retryingStageId: string | null;
  loading: boolean;
  apiError: string | null;
  pipeline: PipelineDisplay | null;
  runs: PipelineRunSummary[];
  runsLoading: boolean;
  totalStages: number;
  completedStages: number;
  progressPercent: number;
  formatDuration: (value?: number | string) => string;
  handleRerun: () => Promise<void>;
  handleReloadPipeline: () => Promise<void>;
  handleRetryFromStage: (stageId: string, stageName: string) => void;
  loadPipeline: (pipelineId?: string) => Promise<void>;
}

export function usePipelineDetailState(): UsePipelineDetailStateReturn {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('stages');
  const [isRerunning, setIsRerunning] = useState(false);
  const [retryingStageId, setRetryingStageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineDisplay | null>(null);
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // Load pipeline detail from API
  const loadPipeline = useCallback(
    async (pipelineId?: string) => {
      const pid = pipelineId || id;
      if (!pid) return;
      setLoading(true);
      setApiError(null);
      try {
        // Fetch pipeline definition
        const pipelineRes = await getPipeline(pid);
        const pipelineData = extractData(pipelineRes);

        if (!pipelineData) {
          setApiError('未找到该 Pipeline');
          return;
        }

        // Fetch latest runs for this pipeline
        let latestRun: PipelineRunSummary | null = null;
        let runStages: PipelineStage[] = [];
        let runsCount = 0;
        try {
          const runsRes = await getPipelineRuns(pid);
          const runsData = extractList<PipelineRunSummary>(runsRes);
          runsCount = runsData.length;

          if (runsData.length > 0) {
            latestRun = runsData[0];

            // Fetch full run detail including stages and tasks
            // Backend returns: { run: {...}, stages: [...], tasks: [...] }
            // Axios wraps: response.data = { code, message, data: { run, stages, tasks } }
            try {
              const runDetailRes = await getPipelineRunDetail(latestRun.id);
              const runDetail = extractData<RunDetailPayload>(runDetailRes);

              const rawStagesArr =
                ((runDetail as RunDetailPayload)?.stages as unknown as PipelineStage[]) || [];
              const rawTasks =
                ((runDetail as RunDetailPayload)?.tasks as unknown as PipelineStep[]) || [];

              // Fallback: if stages are empty, try the dedicated stages endpoint
              let stagesToProcess = rawStagesArr;
              if (stagesToProcess.length === 0) {
                try {
                  const stagesRes = await getPipelineRunStages(latestRun.id);
                  const stagesData = extractData(stagesRes);
                  const fallbackStages =
                    (stagesData as { data?: unknown[]; stages?: unknown[] })?.data ??
                    (stagesData as { stages?: unknown[] })?.stages ??
                    stagesData ??
                    [];
                  stagesToProcess = Array.isArray(fallbackStages) ? fallbackStages : [];
                } catch (stagesErr) {
                  console.error('[PipelineDetail] Dedicated stages endpoint failed:', stagesErr);
                }
              }

              // Merge tasks into stages as steps
              runStages = stagesToProcess.map((stage: PipelineStage) => {
                const stageTasks = rawTasks.filter(
                  (t: PipelineStep) => t.stageId === stage.id || t.stageName === stage.name
                );
                const durationSec = stage.durationMs
                  ? parseInt(String(stage.durationMs), 10) / 1000
                  : undefined;
                return {
                  ...stage,
                  duration: durationSec,
                  steps: stageTasks.map((t: PipelineStep) => ({
                    ...t,
                    duration: t.durationMs ? parseInt(String(t.durationMs), 10) / 1000 : undefined,
                  })),
                  logs: stageTasks.flatMap((t: PipelineStep) => t.logs || []),
                };
              });
            } catch (err) {
              console.error('[PipelineDetail] Failed to get run detail:', err);
            }
          }
        } catch (err) {
          console.error('[PipelineDetail] Failed to get runs:', err);
        }

        setPipeline({
          ...(pipelineData as Omit<
            PipelineDisplay,
            'runNumber' | 'branch' | 'status' | 'trigger' | 'stages'
          >),
          // Merge latest run data for display
          status: latestRun?.status || 'pending',
          runNumber: runsCount || 1,
          branch: (latestRun as PipelineRunSummary & { branch?: string })?.branch || 'main',
          commit: (latestRun as PipelineRunSummary & { commit?: string })?.commit,
          author:
            (latestRun as PipelineRunSummary & { author?: string })?.author ||
            latestRun?.triggerBy ||
            '-',
          trigger:
            (latestRun as PipelineRunSummary & { trigger?: string })?.trigger ||
            latestRun?.triggerType ||
            'manual',
          startTime:
            (latestRun as PipelineRunSummary & { startTime?: string })?.startTime ||
            latestRun?.startedAt,
          endTime:
            (latestRun as PipelineRunSummary & { endTime?: string })?.endTime ||
            latestRun?.completedAt,
          duration:
            (latestRun as PipelineRunSummary & { duration?: number | string })?.duration ??
            latestRun?.durationMs,
          stages: runStages,
        });
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '加载失败，请稍后重试';
        setApiError(errorMsg);
        message.error(`加载 Pipeline 详情失败：${errorMsg}`);
      } finally {
        setLoading(false);
      }
    },
    [id, navigate]
  );

  // Load pipeline on mount
  useEffect(() => {
    if (id) {
      loadPipeline();
    }
  }, [id, loadPipeline]);

  // Calculate progress percentage
  const totalStages = pipeline?.stages?.length || 0;
  const completedStages =
    pipeline?.stages?.filter((s: PipelineStage) => s.status === 'success').length || 0;
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  // Format duration — handles both seconds (number) and durationMs (string)
  const formatDuration = (value?: number | string) => {
    if (!value || !pipeline) return '-';
    // If it's a string (durationMs from backend), convert to seconds
    let seconds: number;
    if (typeof value === 'string') {
      seconds = parseInt(value, 10) / 1000;
    } else {
      seconds = value;
    }
    if (!seconds) return '-';
    const dur = dayjs.duration(seconds, 'seconds');
    const minutes = Math.floor(dur.asMinutes());
    const secs = dur.seconds();
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  // Handle re-run
  const handleRerun = async () => {
    try {
      setIsRerunning(true);
      await triggerPipeline(id!);
      message.success('Pipeline 重新运行成功');
      // Reload pipeline runs
      const runsRes = await getPipelineRuns(id!);
      const runsData = extractList<PipelineRunSummary>(runsRes);
      const latestRun = runsData[0] || null;
      setPipeline((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: latestRun?.status || 'running',
          runNumber:
            (latestRun as PipelineRunSummary & { runNumber?: number })?.runNumber ??
            prev.runNumber + 1,
          stages: [],
        };
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`重新运行 Pipeline 失败：${error.message}`);
      } else {
        message.error('重新运行 Pipeline 失败，请稍后重试');
      }
    } finally {
      setIsRerunning(false);
    }
  };

  // Handle reload from error detail retry
  const handleReloadPipeline = async () => {
    try {
      const runsRes = await getPipelineRuns(id!);
      const runsData = extractList<PipelineRunSummary>(runsRes);
      const latestRun = runsData[0] || null;
      setPipeline((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: latestRun?.status || prev.status,
        };
      });
    } catch {
      // Silent reload failure — the error detail component handles its own retry
    }
  };

  // Load all runs for this pipeline
  const loadRuns = useCallback(async () => {
    if (!id) return;
    setRunsLoading(true);
    try {
      const response = await getPipelineRuns(id, { pageSize: 50 });
      const data = extractList<PipelineRunSummary>(response);
      setRuns(data);
    } catch (error) {
      console.error('Failed to load runs:', error);
    } finally {
      setRunsLoading(false);
    }
  }, [id]);

  // Load runs when pipeline is loaded
  useEffect(() => {
    if (pipeline?.id) {
      loadRuns();
    }
  }, [pipeline?.id, loadRuns]);

  // Handle retry from a specific stage
  const handleRetryFromStage = (_stageId: string, stageName: string) => {
    Modal.confirm({
      title: '从该阶段重跑',
      content: `确认从阶段「${stageName}」开始重新运行？已完成的前置阶段将不会重新执行。`,
      okText: '确认重跑',
      cancelText: '取消',
      onOk: async () => {
        try {
          setRetryingStageId(_stageId);
          // 使用 retryFromStage 从指定阶段重试
          const res = await retryFromStage(id!, _stageId);
          const newRun = extractData(res) as { id?: string; pipelineId?: string } | undefined;
          message.success(`已从阶段「${stageName}」重新运行`);
          // 跳转到该 Pipeline 详情页（查看新运行的结果）
          // 注意：navigate 到 pipelineId 而非 runId，因为详情页会自动加载最新运行
          if (newRun?.pipelineId) {
            navigate(`/pipelines/${newRun.pipelineId}`);
          } else {
            // 回退：刷新当前页面
            await loadPipeline();
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            message.error(`从阶段重跑失败：${error.message}`);
          } else {
            message.error('从阶段重跑失败，请稍后重试');
          }
        } finally {
          setRetryingStageId(null);
        }
      },
    });
  };

  return {
    id,
    navigate,
    activeTab,
    setActiveTab,
    isRerunning,
    retryingStageId,
    loading,
    apiError,
    pipeline,
    runs,
    runsLoading,
    totalStages,
    completedStages,
    progressPercent,
    formatDuration,
    handleRerun,
    handleReloadPipeline,
    handleRetryFromStage,
    loadPipeline,
  };
}
