/**
 * useAgentDashboardState.ts - Agent 编排状态 Hook
 * 抽取自 index.tsx (P2-9 Phase 205)
 */
import { useState, useEffect, useMemo } from 'react';
import { message, Modal } from 'antd';
import dayjs from 'dayjs';
import { useQuery, useQueryClient } from '@/providers/QueryProvider';
import type { AgentProfile, AgentRun, AgentApproval } from '@/api/agents';
import {
  getAgentProfiles,
  deleteAgentProfile,
  toggleAgentProfile,
  getAgentRuns,
  getAgentApprovals,
  respondToApproval,
} from '@/api/agents';

export function useAgentDashboardState() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);

  const queryClient = useQueryClient();
  const {
    data: agentData,
    isLoading: loading,
    error: queryError,
    isError,
  } = useQuery<{ agents: AgentProfile[]; runs: AgentRun[]; approvals: AgentApproval[] }>({
    queryKey: ['agent-dashboard'],
    queryFn: async () => {
      const [agentsRes, runsRes] = await Promise.all([
        getAgentProfiles(),
        getAgentRuns({ pageSize: 10 }),
      ]);
      const approvalsData = await getAgentApprovals({ status: 'pending' });
      return {
        agents: agentsRes.data || [],
        runs: runsRes.data || [],
        approvals: approvalsData?.data ?? [],
      };
    },
    staleTime: 30_000,
    retry: 0,
  });

  // 用户主动操作（刷新/增删改审批后）必须强制重新拉取：
  // staleTime 30s 内 refetch()/invalidateQueries() 默认跳过 fresh 数据。
  // refetchQueries 的 stale:false 显式重拉所有匹配查询，确保「刷新」真正重新请求。
  const loadData = () =>
    queryClient.refetchQueries({ queryKey: ['agent-dashboard'], type: 'active', stale: false });

  const agents = agentData?.agents ?? [];
  const runs = agentData?.runs ?? [];
  const approvals = agentData?.approvals ?? [];

  useEffect(() => {
    if (!isError) return;
    if (
      queryError instanceof Error &&
      (queryError.message.includes('401') || queryError.message.includes('403'))
    ) {
      message.error('权限不足，请重新登录或联系管理员');
    } else {
      message.error(
        queryError instanceof Error ? `加载数据失败：${queryError.message}` : '加载数据失败，请稍后重试'
      );
    }
  }, [isError, queryError]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [agent.name, agent.role, agent.description].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'enabled' && !agent.enabled) return false;
        if (statusFilter === 'disabled' && agent.enabled) return false;
      }
      const roleFilter = filters.role;
      if (roleFilter && roleFilter !== 'all' && agent.role !== roleFilter) return false;
      return true;
    });
  }, [searchQuery, filters, agents]);

  const activeAgentCount = agents.filter((a) => a.enabled).length;
  const todayRunCount = runs.filter((r) => dayjs(r.startedAt).isAfter(dayjs().startOf('day'))).length;
  const completedRuns = runs.filter((r) => r.status === 'completed');
  const successRate =
    runs.length > 0 ? Math.round((completedRuns.length / runs.length) * 100) : 0;
  const avgDuration =
    completedRuns.length > 0
      ? Math.round(
          completedRuns.reduce((acc, r) => {
            const start = dayjs(r.startedAt);
            const end = r.completedAt ? dayjs(r.completedAt) : dayjs();
            return acc + end.diff(start, 'second');
          }, 0) / completedRuns.length
        )
      : 0;

  const handleToggleAgent = async (agent: AgentProfile) => {
    try {
      await toggleAgentProfile(agent.id);
      message.success(`Agent ${agent.name} 已${agent.enabled ? '禁用' : '启用'}`);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      message.error(`操作失败：${msg}`);
    }
  };

  const handleDeleteAgent = (agent: AgentProfile) => {
    Modal.confirm({
      title: '删除 Agent',
      content: `确定要删除 Agent "${agent.name}" 吗？此操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteAgentProfile(agent.id);
          message.success(`Agent ${agent.name} 已删除`);
          await loadData();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          message.error(`删除失败：${msg}`);
        }
      },
    });
  };

  const handleViewDetail = (agent: AgentProfile) => {
    setSelectedAgent(agent);
    setDetailDrawerOpen(true);
  };

  const handleEditAgent = (agent: AgentProfile) => {
    setSelectedAgent(agent);
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setSelectedAgent(null);
    loadData();
  };

  const handleApprove = async (approval: AgentApproval) => {
    try {
      await respondToApproval(approval.id, { approved: true, reason: 'Approved via dashboard' });
      message.success('审批已通过');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      message.error(`审批失败：${msg}`);
    }
  };

  const handleReject = (approval: AgentApproval) => {
    Modal.confirm({
      title: '拒绝审批',
      content: '确定要拒绝此操作吗？',
      okText: '拒绝',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await respondToApproval(approval.id, {
            approved: false,
            rejectionReason: 'Rejected via dashboard',
          });
          message.success('审批已拒绝');
          await loadData();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          message.error(`拒绝失败：${msg}`);
        }
      },
    });
  };

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    createModalOpen,
    setCreateModalOpen,
    editModalOpen,
    setEditModalOpen,
    triggerModalOpen,
    setTriggerModalOpen,
    detailDrawerOpen,
    setDetailDrawerOpen,
    selectedAgent,
    setSelectedAgent,
    loading,
    agents,
    filteredAgents,
    runs,
    approvals,
    activeAgentCount,
    todayRunCount,
    successRate,
    avgDuration,
    loadData,
    handleToggleAgent,
    handleDeleteAgent,
    handleViewDetail,
    handleEditAgent,
    handleEditSuccess,
    handleApprove,
    handleReject,
  };
}
