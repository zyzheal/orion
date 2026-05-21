/**
 * AgentDashboard Page
 * - Summary cards: active agents, today's runs, success rate, avg duration
 * - Agent profile table with enable/disable toggle
 * - Pending approvals queue
 * - Trigger run modal
 * - Create agent profile modal
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, message, Modal } from 'antd';
import { PlusOutlined, ReloadOutlined, PlayCircleOutlined, RobotOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import dayjs from 'dayjs';
import type { AgentProfile, AgentRun, AgentApproval } from '@/api/agents';
import {
  getAgentProfiles,
  deleteAgentProfile,
  toggleAgentProfile,
  getAgentRuns,
  getAgentApprovals,
  respondToApproval,
} from '@/api/agents';

// Sub-components
import AgentMetrics from './AgentMetrics';
import AgentTable from './AgentTable';
import AgentRunList from './AgentRunList';
import AgentDetailDrawer from './AgentDetailDrawer';
import CreateAgentModal from './CreateAgentModal';
import TriggerRunModal from './TriggerRunModal';

const { Title, Text } = Typography;

// ============================================================================
// Main AgentDashboard Component
// ============================================================================

const AgentDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [approvals, setApprovals] = useState<AgentApproval[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [agentsRes, runsRes] = await Promise.all([
        getAgentProfiles(),
        getAgentRuns({ pageSize: 10 }),
      ]);
      setAgents(agentsRes.data?.data || []);
      setRuns(runsRes.data?.data || []);
      // getAgentApprovals returns data directly (not wrapped in AxiosResponse)
      const approvalsData = await getAgentApprovals({ status: 'pending' });
      setApprovals(approvalsData);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.includes('403')) {
          message.error('权限不足，请重新登录或联系管理员');
        } else {
          message.error(`加载数据失败：${err.message}`);
        }
      } else {
        message.error('加载数据失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

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

  // Summary metrics
  const activeAgentCount = agents.filter((a) => a.enabled).length;
  const todayRunCount = runs.filter((r) =>
    dayjs(r.startedAt).isAfter(dayjs().startOf('day'))
  ).length;
  const completedRuns = runs.filter((r) => r.status === 'completed');
  const successRate = runs.length > 0 ? Math.round((completedRuns.length / runs.length) * 100) : 0;
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
      const message_text = err instanceof Error ? err.message : 'Unknown error';
      message.error(`操作失败：${message_text}`);
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
          const message_text = err instanceof Error ? err.message : 'Unknown error';
          message.error(`删除失败：${message_text}`);
        }
      },
    });
  };

  const handleViewDetail = (agent: AgentProfile) => {
    setSelectedAgent(agent);
    setDetailDrawerOpen(true);
  };

  const handleApprove = async (approval: AgentApproval) => {
    try {
      await respondToApproval(approval.id, { approved: true, reason: 'Approved via dashboard' });
      message.success('审批已通过');
      await loadData();
    } catch (err: unknown) {
      const message_text = err instanceof Error ? err.message : 'Unknown error';
      message.error(`审批失败：${message_text}`);
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
          const message_text = err instanceof Error ? err.message : 'Unknown error';
          message.error(`拒绝失败：${message_text}`);
        }
      },
    });
  };

  return (
    <div style={{ padding: 0 }} data-testid="agent-dashboard-page">
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <RobotOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            AI Agent 编排
          </Title>
          <Text type="secondary">
            共 {filteredAgents.length} 个 Agent · {approvals.length} 个待审批
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={() => setTriggerModalOpen(true)}
            data-testid="trigger-run-button"
          >
            触发运行
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            data-testid="create-agent-button"
          >
            创建 Agent
          </Button>
        </Space>
      </div>

      {/* Summary cards */}
      <AgentMetrics
        activeAgentCount={activeAgentCount}
        todayRunCount={todayRunCount}
        successRate={successRate}
        avgDuration={avgDuration}
      />

      {/* Agent profiles table */}
      <AgentTable
        agents={agents}
        filteredAgents={filteredAgents}
        loading={loading}
        searchQuery={searchQuery}
        filters={filters}
        onSearch={setSearchQuery}
        onFilter={setFilters}
        onViewDetail={handleViewDetail}
        onToggleAgent={handleToggleAgent}
        onDeleteAgent={handleDeleteAgent}
      />

      {/* Recent runs and pending approvals */}
      <AgentRunList
        runs={runs}
        approvals={approvals}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {/* Modals */}
      <CreateAgentModal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          loadData();
        }}
      />
      <TriggerRunModal
        open={triggerModalOpen}
        onCancel={() => setTriggerModalOpen(false)}
        onSuccess={() => {
          setTriggerModalOpen(false);
          loadData();
        }}
      />
      <AgentDetailDrawer
        agent={selectedAgent}
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedAgent(null);
        }}
      />
    </div>
  );
};

export default AgentDashboard;
