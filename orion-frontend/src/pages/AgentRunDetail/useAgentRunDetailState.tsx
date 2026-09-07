/**
 * useAgentRunDetailState - AgentRunDetail 状态 hook
 * 抽取自 index.tsx (P2-9 Phase 120)
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import dayjs from 'dayjs';
import {
  getAgentRun,
  getAgentRunDecisions,
  getAgentApprovals,
  cancelAgentRun,
  retryAgentRun,
  type AgentRun,
  type AgentDecision,
  type AgentApproval,
} from '@/api/agents';
import { actionIconMap, defaultActionIcon } from './constants';
import type { TimelineEvent } from '@/components/Timeline';

export const useAgentRunDetailState = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [approvals, setApprovals] = useState<AgentApproval[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = async (runId: string) => {
    setLoading(true);
    try {
      const [runRes, decisionsRes, approvalsRes] = await Promise.all([
        getAgentRun(runId).catch(() => ({ data: { data: null } })),
        getAgentRunDecisions(runId).catch(() => ({ data: { data: [] } })),
        getAgentApprovals({ status: 'pending' }).catch(() => ({ data: { data: [] } })),
      ]);
      setRun(((runRes as { data?: { data?: unknown } })?.data?.data ?? null) as AgentRun | null);
      setDecisions(
        ((decisionsRes as { data?: { data?: unknown[] } })?.data?.data ?? []) as AgentDecision[]
      );
      setApprovals(
        (
          ((approvalsRes as { data?: { data?: unknown[] } })?.data?.data as AgentApproval[]) || []
        ).filter((a: AgentApproval) => a.runId === runId)
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(`加载运行数据失败：${err.message}`);
      } else {
        message.error('加载运行数据失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const handleCancel = async () => {
    if (!run) return;
    setActionLoading('cancel');
    try {
      await cancelAgentRun(run.id);
      message.success('运行已取消');
      await loadData(run.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error(`取消失败：${msg}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async () => {
    if (!run) return;
    setActionLoading('retry');
    try {
      await retryAgentRun(run.id);
      message.success('运行已重试');
      await loadData(run.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error(`重试失败：${msg}`);
    } finally {
      setActionLoading(null);
    }
  };

  const progress =
    run && run.totalSteps > 0 ? Math.round((run.currentStep / run.totalSteps) * 100) : 0;
  const isRunning = run?.status === 'running';
  const duration = run
    ? run.completedAt
      ? dayjs(run.completedAt).diff(dayjs(run.startedAt), 'second')
      : dayjs().diff(dayjs(run.startedAt), 'second')
    : 0;

  const timelineEvents: TimelineEvent[] = useMemo(() => {
    return decisions
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((decision) => {
        let status: 'success' | 'failed' | 'warning' | 'running' | 'pending' = 'success';
        if (decision.error) status = 'failed';
        else if (decision.action === 'request_approval') status = 'warning';

        const descriptionParts: string[] = [];
        if (decision.reasoning) descriptionParts.push(decision.reasoning);
        if (decision.actionInput && Object.keys(decision.actionInput).length > 0) {
          descriptionParts.push(`输入: ${JSON.stringify(decision.actionInput)}`);
        }
        if (decision.actionOutput && Object.keys(decision.actionOutput).length > 0) {
          descriptionParts.push(`输出: ${JSON.stringify(decision.actionOutput)}`);
        }
        if (decision.error) descriptionParts.push(`错误: ${decision.error}`);

        return {
          id: decision.id,
          time: decision.createdAt,
          title: `步骤 ${decision.stepNumber}: ${decision.action}`,
          description: descriptionParts.join('\n'),
          status,
          icon: actionIconMap[decision.action] || defaultActionIcon,
        };
      });
  }, [decisions]);

  return {
    id,
    navigate,
    loading,
    run,
    decisions,
    approvals,
    actionLoading,
    loadData,
    handleCancel,
    handleRetry,
    progress,
    isRunning,
    duration,
    timelineEvents,
  };
};

export type AgentRunDetailState = ReturnType<typeof useAgentRunDetailState>;
