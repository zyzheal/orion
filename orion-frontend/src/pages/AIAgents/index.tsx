/**
 * AI Agent 管理模块入口
 *
 * 提供 Agent 列表、详情、执行、审计日志查看等功能
 *
 * 页面结构：
 * - /ai/agents - Agent 管理主页面
 */
import React, { useState, useEffect } from 'react';
import { Card, Tabs, Typography, Drawer, Modal, Form, Input, Button, message, Spin, Empty } from 'antd';
import {
  RobotOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { AgentInfo, AuditLogEntry, AgentExecutionResult } from '@/api/ai-agents';
import { aiAgentApi } from '@/api/ai-agents';
import AgentList from './AgentList';
import AgentDetail from './AgentDetail';
import AuditLogViewer from './AuditLogViewer';
import { colors, spacing } from '@/tokens';

const { Title, Paragraph } = Typography;

/**
 * AI Agent 管理主页面
 * 包含 Agent 列表、详情、执行、审计日志
 */
const AIAgentsManagement: React.FC = () => {
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
      let input: Record<string, any> = {};
      try {
        // 尝试解析 JSON 输入
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
      const apiData = response.data as { success?: boolean; data?: AgentExecutionResult; error?: string };
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
        <AuditLogViewer logs={auditLogs} loading={auditLogLoading} onExecuteAgent={() => { if (selectedAgent) handleExecute(selectedAgent); }} />
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <div
        style={{
          marginBottom: spacing.lg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <RobotOutlined style={{ marginRight: spacing.sm, color: colors.purple[500] }} />
            AI Agent 管理
          </Title>
          <Paragraph type="secondary">
            管理 AI Agent 配置、执行任务、查看审计日志
          </Paragraph>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadAgents}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {/* 功能标签页 */}
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

      {/* Agent 详情抽屉 */}
      <Drawer
        title="Agent 详情"
        placement="right"
        width={600}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
      >
        <AgentDetail agent={selectedAgent} />
      </Drawer>

      {/* 执行 Agent 对话框 */}
      <Modal
        title={
          <span>
            <PlayCircleOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
            执行 Agent: {selectedAgent?.config?.name || selectedAgent?.id}
          </span>
        }
        open={executeModalOpen}
        onCancel={() => setExecuteModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            label="输入参数 (JSON)"
            name="input"
            rules={[{ required: true, message: '请输入执行参数' }]}
          >
            <Input.TextArea
              rows={6}
              placeholder='{"key": "value"}'
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecuteSubmit}
              loading={executing}
              block
            >
              {executing ? '执行中...' : '执行 Agent'}
            </Button>
          </Form.Item>
        </Form>

        {/* 执行结果 */}
        {executionResult && (
          <Card
            size="small"
            title="执行结果"
            style={{
              marginTop: spacing.md,
              backgroundColor: executionResult.success
                ? colors.light.bg.secondary
                : colors.error[50],
              borderColor: executionResult.success ? colors.success[500] : colors.error[500],
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {JSON.stringify(executionResult, null, 2)}
            </pre>
          </Card>
        )}
      </Modal>
    </div>
  );
};

export default AIAgentsManagement;
