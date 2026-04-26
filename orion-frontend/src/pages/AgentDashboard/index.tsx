/**
 * AgentDashboard Page
 * - Summary cards: active agents, today's runs, success rate, avg duration
 * - Agent profile table with enable/disable toggle
 * - Pending approvals queue
 * - Trigger run modal
 * - Create agent profile modal
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Tag,
  Badge,
  Modal,
  message,
  Form,
  Input,
  Select,
  Switch,
  Descriptions,
  Divider,
  Drawer,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import StatusBadge from '@/components/StatusBadge';
import {
  getAgentProfiles,
  createAgentProfile,
  deleteAgentProfile,
  toggleAgentProfile,
  getAgentRuns,
  getAgentApprovals,
  triggerAgentRun,
  respondToApproval,
  type AgentProfile,
  type AgentRun,
  type AgentApproval,
} from '@/api/agents';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// Role options
// ============================================================================

const ROLE_OPTIONS = [
  { label: 'BugFixer', value: 'bug_fixer' },
  { label: 'CodeFixer', value: 'code_fixer' },
  { label: 'TestWriter', value: 'test_writer' },
  { label: 'PRSubmitter', value: 'pr_submitter' },
  { label: 'SecurityPatcher', value: 'security_patcher' },
  { label: 'DocWriter', value: 'doc_writer' },
];

const TRIGGER_EVENT_OPTIONS = [
  { label: 'Issue Created', value: 'issue_created' },
  { label: 'Build Failed', value: 'build_failed' },
  { label: 'Security Alert', value: 'security_alert' },
  { label: 'PR Requested', value: 'pr_requested' },
  { label: 'Manual', value: 'manual' },
];

const statusToBadge: Record<string, 'running' | 'pending' | 'success' | 'failed' | 'warning' | 'cancelled' | 'unknown'> = {
  running: 'running',
  completed: 'success',
  failed: 'failed',
  cancelled: 'cancelled',
  waiting_approval: 'warning',
};

// ============================================================================
// Create Agent Profile Modal
// ============================================================================

interface CreateAgentModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const CreateAgentModal: React.FC<CreateAgentModalProps> = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);

      const toolsStr = values.tools || '[]';
      let tools: Array<{ toolName: string; permission: string; config?: Record<string, unknown> }> = [];
      try {
        tools = JSON.parse(toolsStr);
      } catch {
        message.error('工具配置必须是有效的 JSON 数组');
        setCreating(false);
        return;
      }

      await createAgentProfile({
        name: values.name,
        role: values.role,
        description: values.description,
        tools,
        enabled: values.enabled ?? true,
        capabilities: values.capabilities ? JSON.parse(values.capabilities) : undefined,
        constraints: values.constraints ? JSON.parse(values.constraints) : undefined,
        llmConfig: values.llmModel
          ? {
              model: values.llmModel,
              temperature: values.temperature ? parseFloat(values.temperature) : undefined,
              maxTokens: values.maxTokens ? parseInt(values.maxTokens, 10) : undefined,
            }
          : undefined,
      });

      message.success(`Agent ${values.name} 创建成功`);
      form.resetFields();
      setCreating(false);
      onSuccess();
    } catch (err: unknown) {
      setCreating(false);
      if (err instanceof Error && 'errorFields' in err) return;
      const message_text = err instanceof Error ? err.message : 'Unknown error';
      message.error(`创建失败：${message_text}`);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <PlusOutlined />
          创建 Agent Profile
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleCreate}
      confirmLoading={creating}
      okText="创建"
      cancelText="取消"
      width={700}
      data-testid="create-agent-modal"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="Agent 名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="例如：BugFixer-v1" />
        </Form.Item>

        <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
          <Select placeholder="选择 Agent 角色" options={ROLE_OPTIONS} />
        </Form.Item>

        <Form.Item label="描述" name="description">
          <Input.TextArea rows={2} placeholder="Agent 的描述信息" />
        </Form.Item>

        <Form.Item label="工具集 (JSON 数组)" name="tools" rules={[{ required: true, message: '请配置工具集' }]}>
          <Input.TextArea
            rows={3}
            placeholder='[{"toolName": "git_read", "permission": "read"}]'
          />
        </Form.Item>

        <Form.Item label="LLM 模型" name="llmModel">
          <Select placeholder="选择模型" allowClear>
            <Select.Option value="gpt-4">GPT-4</Select.Option>
            <Select.Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Select.Option>
            <Select.Option value="claude-3-opus">Claude 3 Opus</Select.Option>
            <Select.Option value="claude-3-sonnet">Claude 3 Sonnet</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="Temperature" name="temperature">
          <Input type="number" placeholder="0.0 - 1.0" />
        </Form.Item>

        <Form.Item label="Max Tokens" name="maxTokens">
          <Input type="number" placeholder="4096" />
        </Form.Item>

        <Form.Item label="能力配置 (JSON)" name="capabilities">
          <Input.TextArea rows={2} placeholder='{"maxSteps": 20, "timeoutSec": 3600, "retryCount": 3}' />
        </Form.Item>

        <Form.Item label="约束配置 (JSON)" name="constraints">
          <Input.TextArea rows={2} placeholder='{"maxTokens": 8192, "allowedBranches": ["main", "develop"]}' />
        </Form.Item>

        <Form.Item label="启用" name="enabled" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ============================================================================
// Trigger Run Modal
// ============================================================================

interface TriggerRunModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const TriggerRunModal: React.FC<TriggerRunModalProps> = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [triggering, setTriggering] = useState(false);

  const handleTrigger = async () => {
    try {
      const values = await form.validateFields();
      setTriggering(true);

      let payload: Record<string, unknown> = {};
      if (values.payload) {
        try {
          payload = JSON.parse(values.payload);
        } catch {
          message.error('触发载荷必须是有效的 JSON');
          setTriggering(false);
          return;
        }
      }

      await triggerAgentRun({
        workflowId: values.workflowId || undefined,
        triggerEvent: values.triggerEvent,
        triggerPayload: payload,
      });

      message.success('Agent 运行已触发');
      form.resetFields();
      setTriggering(false);
      onSuccess();
    } catch (err: unknown) {
      setTriggering(false);
      if (err instanceof Error && 'errorFields' in err) return;
      const message_text = err instanceof Error ? err.message : 'Unknown error';
      message.error(`触发失败：${message_text}`);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <PlayCircleOutlined />
          触发 Agent 运行
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleTrigger}
      confirmLoading={triggering}
      okText="触发"
      cancelText="取消"
      width={600}
      data-testid="trigger-run-modal"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="触发事件" name="triggerEvent" rules={[{ required: true, message: '请选择触发事件' }]}>
          <Select placeholder="选择触发事件" options={TRIGGER_EVENT_OPTIONS} />
        </Form.Item>

        <Form.Item label="工作流 ID" name="workflowId">
          <Input placeholder="可选，指定工作流" />
        </Form.Item>

        <Form.Item label="触发载荷 (JSON)" name="payload">
          <Input.TextArea rows={6} placeholder='{"issue_id": "123", "repo": "org/repo"}' />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ============================================================================
// Agent Profile Detail Drawer
// ============================================================================

interface AgentDetailDrawerProps {
  agent: AgentProfile | null;
  open: boolean;
  onClose: () => void;
}

const AgentDetailDrawer: React.FC<AgentDetailDrawerProps> = ({ agent, open, onClose }) => {
  if (!agent) return null;

  return (
    <Drawer
      title={`Agent 详情 - ${agent.name}`}
      placement="right"
      width={600}
      onClose={onClose}
      open={open}
      data-testid="agent-detail-drawer"
    >
      <Descriptions title="基本信息" column={1} bordered size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label="名称">{agent.name}</Descriptions.Item>
        <Descriptions.Item label="角色">
          <Tag color="blue">{agent.role}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="描述">{agent.description || '-'}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Badge status={agent.enabled ? 'success' : 'default'} text={agent.enabled ? '已启用' : '已禁用'} />
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(agent.createdAt).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {dayjs(agent.updatedAt).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Title level={5}>工具集</Title>
      {agent.tools.length > 0 ? (
        <Table
          columns={[
            { key: 'toolName', title: '工具名称', dataIndex: 'toolName', width: 160 },
            {
              key: 'permission',
              title: '权限',
              dataIndex: 'permission',
              width: 100,
              render: (v: unknown) => <Tag color={String(v) === 'read' ? 'green' : 'orange'}>{String(v)}</Tag>,
            },
          ]}
          dataSource={agent.tools}
          rowKey="toolName"
          size="small"
          clientPagination={false}
        />
      ) : (
        <Text type="secondary">无工具配置</Text>
      )}

      {agent.llmConfig && (
        <>
          <Divider />
          <Title level={5}>LLM 配置</Title>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="模型">{agent.llmConfig.model || '-'}</Descriptions.Item>
            <Descriptions.Item label="Temperature">{agent.llmConfig.temperature ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Max Tokens">{agent.llmConfig.maxTokens ?? '-'}</Descriptions.Item>
          </Descriptions>
        </>
      )}

      {agent.capabilities && (
        <>
          <Divider />
          <Title level={5}>能力配置</Title>
          <Descriptions column={3} size="small" bordered>
            <Descriptions.Item label="最大步骤">{agent.capabilities.maxSteps ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="超时(秒)">{agent.capabilities.timeoutSec ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="重试次数">{agent.capabilities.retryCount ?? '-'}</Descriptions.Item>
          </Descriptions>
        </>
      )}
    </Drawer>
  );
};

// ============================================================================
// Main AgentDashboard Component
// ============================================================================

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
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
      console.error('Failed to load data:', err);
      message.error('加载数据失败');
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
  const todayRunCount = runs.filter((r) => dayjs(r.startedAt).isAfter(dayjs().startOf('day'))).length;
  const completedRuns = runs.filter((r) => r.status === 'completed');
  const successRate = runs.length > 0 ? Math.round((completedRuns.length / runs.length) * 100) : 0;
  const avgDuration = completedRuns.length > 0
    ? Math.round(
        completedRuns.reduce((acc, r) => {
          const start = dayjs(r.startedAt);
          const end = r.completedAt ? dayjs(r.completedAt) : dayjs();
          return acc + end.diff(start, 'second');
        }, 0) / completedRuns.length
      )
    : 0;

  const filterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '已启用', value: 'enabled' },
        { label: '已禁用', value: 'disabled' },
      ],
    },
    {
      key: 'role',
      label: '角色',
      options: [
        { label: '全部', value: 'all' },
        ...ROLE_OPTIONS,
      ],
    },
  ];

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

  const handleViewDetail = async (agent: AgentProfile) => {
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

  const handleReject = async (approval: AgentApproval) => {
    Modal.confirm({
      title: '拒绝审批',
      content: '确定要拒绝此操作吗？',
      okText: '拒绝',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await respondToApproval(approval.id, { approved: false, rejectionReason: 'Rejected via dashboard' });
          message.success('审批已拒绝');
          await loadData();
        } catch (err: unknown) {
          const message_text = err instanceof Error ? err.message : 'Unknown error';
          message.error(`拒绝失败：${message_text}`);
        }
      },
    });
  };

  const agentColumns: TableColumn<AgentProfile>[] = [
    {
      key: 'name',
      title: 'Agent 名称',
      dataIndex: 'name',
      width: 180,
      render: (value: unknown) => (
        <Space>
          <ThunderboltOutlined style={{ color: colors.purple[500] }} />
          <Text strong>{String(value)}</Text>
        </Space>
      ),
    },
    {
      key: 'role',
      title: '角色',
      dataIndex: 'role',
      width: 140,
      render: (value: unknown) => <Tag color="blue">{String(value)}</Tag>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      render: (value: unknown) => (
        <Badge status={value ? 'success' : 'default'} text={value ? '已启用' : '已禁用'} />
      ),
    },
    {
      key: 'tools',
      title: '工具数',
      dataIndex: 'tools',
      width: 80,
      render: (value: unknown) => <Tag>{(value as Array<{ toolName: string; permission: string }>).length}</Tag>,
    },
    {
      key: 'llmModel',
      title: 'LLM 模型',
      dataIndex: 'llmConfig',
      width: 160,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {(value as { model?: string })?.model || '-'}
        </Text>
      ),
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (value: unknown) => (
        <Space>
          <ClockCircleOutlined style={{ color: colors.neutral[400] }} />
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {value ? dayjs(String(value)).format('YYYY-MM-DD HH:mm') : '-'}
          </Text>
        </Space>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: AgentProfile) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            data-testid={`view-agent-${record.id}`}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleToggleAgent(record)}
            data-testid={`toggle-agent-${record.id}`}
          >
            {record.enabled ? '禁用' : '启用'}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteAgent(record)}
            data-testid={`delete-agent-${record.id}`}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const runColumns: TableColumn<AgentRun>[] = [
    {
      key: 'id',
      title: '运行 ID',
      dataIndex: 'id',
      width: 120,
      render: (value: unknown) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/agent-runs/${String(value)}`)}
        >
          {String(value).slice(0, 8)}...
        </Button>
      ),
    },
    {
      key: 'triggerEvent',
      title: '触发事件',
      dataIndex: 'triggerEvent',
      width: 160,
      render: (value: unknown) => <Tag>{String(value)}</Tag>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 160,
      render: (value: unknown) => {
        const status = String(value);
        return <StatusBadge status={statusToBadge[status] || 'unknown'} />;
      },
    },
    {
      key: 'progress',
      title: '进度',
      width: 180,
      render: (_: unknown, record: AgentRun) => (
        <span style={{ fontSize: spacing[3] }}>
          步骤 {record.currentStep}/{record.totalSteps}
        </span>
      ),
    },
    {
      key: 'startedAt',
      title: '开始时间',
      dataIndex: 'startedAt',
      width: 160,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {value ? dayjs(String(value)).format('YYYY-MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
  ];

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
          <Title level={3} style={{ margin: 0 }}>
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
        data-testid="agent-summary-cards"
      >
        <MetricCard
          title="活跃 Agent"
          value={activeAgentCount}
          icon={<AppstoreOutlined />}
          color="colors.purple[500]"
          footer="已启用的 Agent 数量"
        />
        <MetricCard
          title="今日运行"
          value={todayRunCount}
          icon={<PlayCircleOutlined />}
          color="colors.primary[500]"
          footer="今天触发的运行次数"
        />
        <MetricCard
          title="成功率"
          value={`${successRate}%`}
          icon={<CheckCircleOutlined />}
          color="colors.success[500]"
          footer="运行成功占比"
        />
        <MetricCard
          title="平均耗时"
          value={`${avgDuration}s`}
          icon={<ClockCircleOutlined />}
          color="colors.warning[500]"
          footer="成功运行的平均时长"
        />
      </div>

      {/* Pending approvals section */}
      {approvals.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 12 }}>
            <Space>
              <PauseCircleOutlined style={{ color: colors.warning[500] }} />
              待审批队列 ({approvals.length})
            </Space>
          </Title>
          <Table
            columns={[
              {
                key: 'id',
                title: '审批 ID',
                dataIndex: 'id',
                width: 120,
                render: (v: unknown) => <Text code style={{ fontSize: spacing[2] }}>{String(v).slice(0, 8)}</Text>,
              },
              {
                key: 'agentId',
                title: 'Agent',
                dataIndex: 'agentId',
                width: 120,
                render: (v: unknown) => <Tag color="purple">{String(v).slice(0, 8)}</Tag>,
              },
              {
                key: 'action',
                title: '操作',
                dataIndex: 'action',
                width: 180,
                render: (v: unknown) => <Text strong>{String(v)}</Text>,
              },
              {
                key: 'reason',
                title: '原因',
                dataIndex: 'reason',
                render: (v: unknown) => (
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    {String(v || '-')}
                  </Text>
                ),
              },
              {
                key: 'createdAt',
                title: '创建时间',
                dataIndex: 'createdAt',
                width: 160,
                render: (v: unknown) => (
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    {v ? dayjs(String(v)).format('YYYY-MM-DD HH:mm') : '-'}
                  </Text>
                ),
              },
              {
                key: 'actions',
                title: '操作',
                width: 140,
                render: (_v: unknown, record: AgentApproval) => (
                  <Space size="small">
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleApprove(record)}
                    >
                      通过
                    </Button>
                    <Button
                      danger
                      size="small"
                      icon={<CloseCircleOutlined />}
                      onClick={() => handleReject(record)}
                    >
                      拒绝
                    </Button>
                  </Space>
                ),
              },
            ]}
            dataSource={approvals}
            rowKey="id"
            size="small"
            striped
          />
        </div>
      )}

      {/* Agent profiles table */}
      <Title level={5} style={{ marginBottom: 12 }}>
        Agent Profiles
      </Title>
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索 Agent 名称、角色、描述..."
        />
      </div>
      <Table
        columns={agentColumns}
        dataSource={filteredAgents}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        data-testid="agent-table"
      />

      {/* Recent runs table */}
      <Title level={5} style={{ marginBottom: 12, marginTop: 24 }}>
        最近运行
      </Title>
      <Table
        columns={runColumns}
        dataSource={runs}
        rowKey="id"
        size="small"
        striped
        data-testid="recent-runs-table"
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
