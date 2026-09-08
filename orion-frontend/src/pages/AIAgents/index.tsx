/**
 * AI Agent 管理模块入口
 *
 * 提供 Agent 列表、详情、执行、审计日志查看等功能
 *
 * 页面结构：
 * - /ai/agents - Agent 管理主页面
 *
 * 拆分自 index.tsx (P2-9 Phase 207)
 * - useAIAgentsState.ts: state + loadAgents + handlers
 * - Components/PageHeader.tsx: title + reload button
 * - Components/ExecuteAgentModal.tsx: modal + form + result
 */
import { Card, Tabs, Spin, Empty, Drawer } from 'antd';
import { RobotOutlined, FileTextOutlined } from '@ant-design/icons';
import AgentList from './AgentList';
import AgentDetail from './AgentDetail';
import AuditLogViewer from './AuditLogViewer';
import { useAIAgentsState } from './useAIAgentsState';
import { PageHeader } from './Components/PageHeader';
import { ExecuteAgentModal } from './Components/ExecuteAgentModal';

const AIAgentsManagement = () => {
  const {
    activeTab,
    setActiveTab,
    agents,
    loading,
    detailDrawerOpen,
    selectedAgent,
    auditLogs,
    auditLogLoading,
    executeModalOpen,
    executing,
    executionResult,
    form,
    loadAgents,
    handleViewDetail,
    handleViewAuditLog,
    handleExecute,
    handleExecuteSubmit,
    handleCloseDetail,
    handleCloseExecute,
  } = useAIAgentsState();

  const tabItems = [
    {
      key: 'list',
      label: (
        <span>
          <RobotOutlined />
          Agent 列表
        </span>
      ),
      children: (
        <AgentList
          agents={agents}
          loading={loading}
          onViewDetail={handleViewDetail}
          onExecute={handleExecute}
          onViewAuditLog={handleViewAuditLog}
        />
      ),
    },
    {
      key: 'audit',
      label: (
        <span>
          <FileTextOutlined />
          审计日志
        </span>
      ),
      children: (
        <AuditLogViewer
          logs={auditLogs}
          loading={auditLogLoading}
          onExecuteAgent={() => {
            if (selectedAgent) handleExecute(selectedAgent);
          }}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <PageHeader loading={loading} onRefresh={loadAgents} />

      <Spin spinning={loading}>
        <Card
          style={{
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          {agents.length > 0 || loading ? (
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              defaultActiveKey="list"
              items={tabItems}
            />
          ) : (
            <Empty description="暂无 Agent 数据" />
          )}
        </Card>
      </Spin>

      <Drawer
        title="Agent 详情"
        placement="right"
        width={600}
        open={detailDrawerOpen}
        onClose={handleCloseDetail}
      >
        <AgentDetail agent={selectedAgent} />
      </Drawer>

      <ExecuteAgentModal
        open={executeModalOpen}
        form={form}
        selectedAgent={selectedAgent}
        executing={executing}
        executionResult={executionResult}
        onSubmit={handleExecuteSubmit}
        onClose={handleCloseExecute}
      />
    </div>
  );
};

export default AIAgentsManagement;
