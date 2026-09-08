/**
 * useAIAgentsState.ts - AI Agent 管理状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 207)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import type { AgentInfo, AuditLogEntry, AgentExecutionResult } from '@/api/ai-agents';
import { aiAgentApi } from '@/api/ai-agents';

export function useAIAgentsState() {
  const [activeTab, setActiveTab] = useState('list');
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<AgentExecutionResult | null>(null);
  const [form] = Form.useForm();

  // 加载 Agent 列表
  const loadAgents = async () => {
    setLoading(true);
    try {
      const response = await aiAgentApi.getList();
      const apiData = response.data as { success?: boolean; data?: AgentInfo[] };
      if (apiData.success && apiData.data) {
        setAgents(apiData.data);
      } else {
        setAgents([]);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
      message.error('加载 Agent 列表失败');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  // 查看详情
  const handleViewDetail = (agent: AgentInfo) => {
    setSelectedAgent(agent);
    setDetailDrawerOpen(true);
  };

  // 查看审计日志
  const handleViewAuditLog = async (agent: AgentInfo) => {
    setSelectedAgent(agent);
    setAuditLogs([]);
    setAuditLogLoading(true);
    setActiveTab('audit');
    try {
      const response = await aiAgentApi.getAuditLogs(agent.id);
      const apiData = response.data as { success?: boolean; data?: AuditLogEntry[] };
      if (apiData.success && apiData.data) {
        setAuditLogs(apiData.data);
      } else {
        setAuditLogs([]);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      message.error('加载审计日志失败');
      setAuditLogs([]);
    } finally {
      setAuditLogLoading(false);
    }
  };

  // 执行 Agent
  const handleExecute = (agent: AgentInfo) => {
    setSelectedAgent(agent);
    setExecutionResult(null);
    form.resetFields();
    setExecuteModalOpen(true);
  };

  // 提交执行
  const handleExecuteSubmit = async () => {
    if (!selectedAgent) return;
    setExecuting(true);
    try {
      const values = form.getFieldsValue();
      let input: Record<string, unknown> = {};
      try {
        if (values.input && typeof values.input === 'string') {
          input = JSON.parse(values.input);
        } else if (values.input && typeof values.input === 'object') {
          input = values.input;
        }
      } catch {
        message.error('请输入合法的 JSON 格式');
        setExecuting(false);
        return;
      }

      const response = await aiAgentApi.execute(selectedAgent.id, input);
      const apiData = response.data as {
        success?: boolean;
        data?: AgentExecutionResult;
        error?: string;
      };
      if (apiData.success) {
        setExecutionResult(apiData.data as AgentExecutionResult);
        message.success('Agent 执行成功');
      } else {
        setExecutionResult({
          success: false,
          error: apiData.error || '执行失败',
        });
        message.error('Agent 执行失败');
      }
    } catch (error) {
      console.error('Failed to execute agent:', error);
      setExecutionResult({
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      });
      message.error('Agent 执行失败');
    } finally {
      setExecuting(false);
    }
  };

  const handleCloseDetail = () => setDetailDrawerOpen(false);
  const handleCloseExecute = () => setExecuteModalOpen(false);

  return {
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
  };
}
