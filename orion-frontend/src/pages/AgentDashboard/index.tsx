/**
 * AgentDashboard Page
 * - Summary cards: active agents, today's runs, success rate, avg duration
 * - Agent profile table with enable/disable toggle
 * - Pending approvals queue
 * - Trigger run modal
 * - Create agent profile modal
 *
 * 拆分自 index.tsx (P2-9 Phase 205)
 * - useAgentDashboardState.ts: state + queries + handlers + metrics
 * - Components/PageHeader.tsx: title + 3 buttons
 */
import { Spin, Empty } from 'antd';
import { componentRadius, shadows, themeVars } from '@/tokens';
import { useAgentDashboardState } from './useAgentDashboardState';
import AgentMetrics from './AgentMetrics';
import AgentTable from './AgentTable';
import AgentRunList from './AgentRunList';
import AgentDetailDrawer from './AgentDetailDrawer';
import CreateAgentModal from './CreateAgentModal';
import TriggerRunModal from './TriggerRunModal';
import { PageHeader } from './Components/PageHeader';

const AgentDashboard = () => {
  const {
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
  } = useAgentDashboardState();

  return (
    <div style={ { padding: 0 } } data-testid="agent-dashboard-page">
      <PageHeader
        agentCount={filteredAgents.length}
        approvalCount={approvals.length}
        loading={loading}
        onRefresh={loadData}
        onTrigger={() => setTriggerModalOpen(true)}
        onCreate={() => setCreateModalOpen(true)}
      />

      <Spin spinning={loading}>
        <AgentMetrics
          activeAgentCount={activeAgentCount}
          todayRunCount={todayRunCount}
          successRate={successRate}
          avgDuration={avgDuration}
        />

        {agents.length > 0 || loading ? (
          <AgentTable
            agents={agents}
            filteredAgents={filteredAgents}
            loading={loading}
            searchQuery={searchQuery}
            filters={filters}
            onSearch={setSearchQuery}
            onFilter={setFilters}
            onViewDetail={handleViewDetail}
            onEditAgent={handleEditAgent}
            onToggleAgent={handleToggleAgent}
            onDeleteAgent={handleDeleteAgent}
          />
        ) : (
          <div
            style={ {
              background: themeVars.bgPrimary,
              borderRadius: componentRadius.card,
              boxShadow: shadows.card,
              padding: '48px 0',
            } }
          >
            <Empty description="暂无 Agent 数据" />
          </div>
        )}

        <AgentRunList
          runs={runs}
          approvals={approvals}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </Spin>

      <CreateAgentModal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          loadData();
        }}
      />
      <CreateAgentModal
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        agent={selectedAgent}
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
        onEdit={handleEditAgent}
      />
    </div>
  );
};

export default AgentDashboard;
